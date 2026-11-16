import { Observable, Subject, Subscription, mergeMap } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { MediaCombinatorBridge } from '../bridge/media-combinator.bridge';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import { MediaAssetNeuron } from '../neurons/media-asset.neuron';
import {
  MediaAsset,
  MediaAssetNeuronState,
  MediaUsageFlushBatch,
  MediaViewRequest,
  MediaViewResolved,
} from '../types/media.types';

export interface MediaViewFlowOptions {
  apiClient: MediaHubApiClient;
  sseBus?: MediaSseBus;
  bridge?: MediaCombinatorBridge;
  /** Flush window for coalesced view-usage telemetry (ms). Default: 1500ms */
  usageBatchWindowMs?: number;
  /** Default signed URL TTL for PRIVATE/SCOPED assets. Default: 3600s */
  defaultSignedTtlSeconds?: number;
}

interface CachedSignedEntry {
  url: string;
  relativeUrl: string;
  expiresAt: string;
  expiresAtMs: number;
}

/**
 * Поток просмотра медиа (Media Viewing, Access Resolution & Usage Telemetry Flow).
 *
 * Responsibilities:
 * 1. Access-aware URL resolution: returns direct URL for PUBLIC media or cached/auto-renewed
 *    HMAC signed URLs (`POST /api/assets/:id/signed-url`) for PRIVATE/SCOPED media.
 * 2. Live reactive viewing (`watchPlayback$(assetId)`): wraps MediaAssetNeuron and reacts to
 *    processing completion, access grants/revokes, and asset deletion.
 * 3. Coalesced usage telemetry stream: buffers rapid views in `usageBatchWindowMs` windows,
 *    flushes `POST /api/assets/:id/usage`, and forwards telemetry to Core Combinator Batch/Chronicle.
 */
export class MediaViewFlow {
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus?: MediaSseBus;
  private readonly bridge?: MediaCombinatorBridge;
  private readonly usageBatchWindowMs: number;
  private readonly defaultSignedTtlSeconds: number;

  private readonly viewRawSubject = new Subject<{
    assetId: string;
    variant: string;
    viewerContext?: string;
  }>();
  private readonly resolvedSubject = new Subject<MediaViewResolved>();
  private readonly usageFlushedSubject = new Subject<MediaUsageFlushBatch>();
  private readonly errorsSubject = new Subject<{ assetId: string; error: Error }>();

  private readonly signedCache = new Map<string, CachedSignedEntry>();
  private cacheEvictionSub: Subscription | null = null;
  private batchFlushSub: Subscription | null = null;

  constructor(options: MediaViewFlowOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.bridge = options.bridge;
    this.usageBatchWindowMs = Math.max(50, options.usageBatchWindowMs ?? 1500);
    this.defaultSignedTtlSeconds = options.defaultSignedTtlSeconds ?? 3600;

    this.startUsageBatchPipeline();
    this.subscribeCacheInvalidation();
  }

  get resolved$(): Observable<MediaViewResolved> {
    return this.resolvedSubject.asObservable();
  }

  get viewed$(): Observable<{ assetId: string; variant: string; viewerContext?: string }> {
    return this.viewRawSubject.asObservable();
  }

  get usageFlushed$(): Observable<MediaUsageFlushBatch> {
    return this.usageFlushedSubject.asObservable();
  }

  get errors$(): Observable<{ assetId: string; error: Error }> {
    return this.errorsSubject.asObservable();
  }

  async resolveView(request: MediaViewRequest): Promise<MediaViewResolved> {
    const asset = await this.apiClient.getAsset(request.assetId);
    const variant = request.variant || this.pickPreferredVariant(asset);

    let url: string;
    let relativeUrl: string;
    let signed = false;
    let expiresAt: string | undefined;

    if (asset.visibility === 'PUBLIC') {
      relativeUrl = `/api/media/${asset.id}/file/${variant}`;
      url = this.apiClient.resolveUrl(relativeUrl);
    } else {
      const cacheKey = `${asset.id}:${variant}`;
      const cached = this.signedCache.get(cacheKey);
      const now = Date.now();
      if (cached && cached.expiresAtMs - now > 15_000) {
        url = cached.url;
        relativeUrl = cached.relativeUrl;
        expiresAt = cached.expiresAt;
        signed = true;
      } else {
        const res = await this.apiClient.createSignedUrl(asset.id, {
          variant,
          ttlSeconds: request.ttlSeconds ?? this.defaultSignedTtlSeconds,
        });
        relativeUrl = res.relativeUrl;
        url = this.apiClient.resolveUrl(relativeUrl);
        expiresAt = res.expiresAt;
        signed = true;
        this.signedCache.set(cacheKey, {
          url,
          relativeUrl,
          expiresAt,
          expiresAtMs: new Date(expiresAt).getTime(),
        });
      }
    }

    const resolved: MediaViewResolved = {
      asset,
      variant,
      url,
      relativeUrl,
      signed,
      expiresAt,
    };

    this.resolvedSubject.next(resolved);
    if (request.trackUsage !== false) {
      this.recordView(asset.id, variant, request.viewerContext);
    }

    return resolved;
  }

  recordView(assetId: string, variant = 'auto', viewerContext?: string): void {
    this.viewRawSubject.next({ assetId, variant, viewerContext });
  }

  /**
   * Returns a live Observable of single-asset state (resolved playable URL, processing progress, delete state).
   */
  watchAsset$(
    assetId: string,
    defaultVariant?: string,
  ): Observable<MediaAssetNeuronState<MediaAsset>> {
    return new Observable<MediaAssetNeuronState<MediaAsset>>((subscriber) => {
      const bus = this.sseBus ?? new MediaSseBus({ apiClient: this.apiClient });
      const neuron = new MediaAssetNeuron({
        assetId,
        apiClient: this.apiClient,
        sseBus: bus,
        defaultVariant,
        signedUrlTtlSeconds: this.defaultSignedTtlSeconds,
      });

      const sub = neuron.stateObservable$.subscribe(subscriber);
      void neuron.connect(true);

      return () => {
        sub.unsubscribe();
        neuron.disconnect();
      };
    });
  }

  invalidateCache(assetId?: string): void {
    if (!assetId) {
      this.signedCache.clear();
      return;
    }
    for (const key of Array.from(this.signedCache.keys())) {
      if (key.startsWith(`${assetId}:`)) {
        this.signedCache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.batchFlushSub) {
      this.batchFlushSub.unsubscribe();
      this.batchFlushSub = null;
    }
    if (this.cacheEvictionSub) {
      this.cacheEvictionSub.unsubscribe();
      this.cacheEvictionSub = null;
    }
    this.signedCache.clear();
  }

  private pickPreferredVariant(asset: MediaAsset): string {
    const types = new Set((asset.variants || []).map((v) => v.variantType));
    if (asset.kind === 'VIDEO' && types.has('MP4_720P')) return 'mp4_720p';
    if (asset.kind === 'AUDIO' && types.has('AUDIO_MP3')) return 'audio_mp3';
    if (asset.kind === 'IMAGE' && types.has('FULL_WEBP')) return 'full';
    return 'original';
  }

  private startUsageBatchPipeline(): void {
    if (this.batchFlushSub) return;

    this.batchFlushSub = this.viewRawSubject
      .pipe(
        bufferTime(this.usageBatchWindowMs),
        filter((events) => events.length > 0),
        mergeMap(async (events) => {
          const countsByAsset: Record<string, number> = {};
          for (const ev of events) {
            countsByAsset[ev.assetId] = (countsByAsset[ev.assetId] || 0) + 1;
          }

          for (const [assetId, count] of Object.entries(countsByAsset)) {
            try {
              for (let i = 0; i < count; i += 1) {
                await this.apiClient.incrementUsage(assetId);
              }
              if (this.bridge) {
                await this.bridge.pushBatchTelemetry(
                  'view',
                  { assetId, viewsCount: count },
                  `view:${assetId}:${Math.floor(Date.now() / this.usageBatchWindowMs)}`,
                );
              }
            } catch (rawErr: any) {
              const error = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
              this.errorsSubject.next({ assetId, error });
            }
          }

          const batch: MediaUsageFlushBatch = {
            flushedAt: new Date().toISOString(),
            countsByAsset,
            totalViews: events.length,
          };
          this.usageFlushedSubject.next(batch);

          if (this.bridge) {
            await this.bridge.emitChronicle('view', 'MEDIA_VIEWED', batch);
          }
        }),
      )
      .subscribe();
  }

  private subscribeCacheInvalidation(): void {
    if (!this.sseBus) return;
    this.cacheEvictionSub = this.sseBus
      .selectType$('MEDIA_DELETED', 'MEDIA_ACCESS_CHANGED', 'MEDIA_READY')
      .subscribe((impulse) => {
        if (impulse.assetId) {
          this.invalidateCache(impulse.assetId);
        }
      });
  }
}
