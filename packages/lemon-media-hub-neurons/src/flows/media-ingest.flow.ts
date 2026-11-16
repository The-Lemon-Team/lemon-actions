import { Observable, Subject, Subscription } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { MediaCombinatorBridge } from '../bridge/media-combinator.bridge';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import { MediaAssetNeuron } from '../neurons/media-asset.neuron';
import {
  MediaAsset,
  MediaIngestRequest,
  MediaIngestResult,
} from '../types/media.types';

export interface MediaIngestFlowOptions {
  apiClient: MediaHubApiClient;
  sseBus?: MediaSseBus;
  bridge?: MediaCombinatorBridge;
  concurrency?: number;
}

export interface MediaIngestError {
  request: MediaIngestRequest;
  error: Error;
}

/**
 * Поток добавления медиа (Media Addition / Ingest Reactive Flow).
 *
 * Accepts media upload intents imperatively (`ingest`, `push`) or via connected RxJS streams
 * (`connectSource`), enforces concurrency & deduplication, uploads to Lemon Media Hub,
 * optionally awaits background video/audio transcoding until READY, and emits reactive events +
 * Core Combinator Chronicle telemetry.
 */
export class MediaIngestFlow {
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus?: MediaSseBus;
  private readonly bridge?: MediaCombinatorBridge;
  private readonly concurrency: number;

  private readonly queueSubject = new Subject<{
    request: MediaIngestRequest;
    resolve?: (result: MediaIngestResult) => void;
    reject?: (err: Error) => void;
  }>();
  private readonly submittedSubject = new Subject<MediaIngestRequest>();
  private readonly addedSubject = new Subject<MediaAsset>();
  private readonly completedSubject = new Subject<MediaIngestResult>();
  private readonly errorsSubject = new Subject<MediaIngestError>();

  private readonly inflightDedup = new Map<string, Promise<MediaIngestResult>>();
  private readonly sourceSubs: Subscription[] = [];
  private workerSub: Subscription | null = null;

  constructor(options: MediaIngestFlowOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.bridge = options.bridge;
    this.concurrency = Math.max(1, options.concurrency ?? 3);
    this.startWorker();
  }

  get submitted$(): Observable<MediaIngestRequest> {
    return this.submittedSubject.asObservable();
  }

  get added$(): Observable<MediaAsset> {
    return this.addedSubject.asObservable();
  }

  get completed$(): Observable<MediaIngestResult> {
    return this.completedSubject.asObservable();
  }

  get errors$(): Observable<MediaIngestError> {
    return this.errorsSubject.asObservable();
  }

  connectSource(source$: Observable<MediaIngestRequest>): Subscription {
    const sub = source$.subscribe({
      next: (req) => this.push(req),
    });
    this.sourceSubs.push(sub);
    return sub;
  }

  push(request: MediaIngestRequest): void {
    this.submittedSubject.next(request);
    this.queueSubject.next({ request });
  }

  ingest(request: MediaIngestRequest): Promise<MediaIngestResult> {
    if (request.dedupKey) {
      const existing = this.inflightDedup.get(request.dedupKey);
      if (existing) return existing;
    }

    const promise = new Promise<MediaIngestResult>((resolve, reject) => {
      this.submittedSubject.next(request);
      this.queueSubject.next({ request, resolve, reject });
    });

    if (request.dedupKey) {
      this.inflightDedup.set(request.dedupKey, promise);
      void promise.finally(() => {
        if (this.inflightDedup.get(request.dedupKey!) === promise) {
          this.inflightDedup.delete(request.dedupKey!);
        }
      });
    }

    return promise;
  }

  async ingestMany(requests: MediaIngestRequest[]): Promise<MediaIngestResult[]> {
    return Promise.all(requests.map((req) => this.ingest(req)));
  }

  destroy(): void {
    for (const sub of this.sourceSubs) sub.unsubscribe();
    this.sourceSubs.length = 0;
    if (this.workerSub) {
      this.workerSub.unsubscribe();
      this.workerSub = null;
    }
  }

  private startWorker(): void {
    if (this.workerSub) return;

    this.workerSub = this.queueSubject
      .pipe(
        mergeMap(async (entry) => {
          const startedAt = Date.now();
          const { request } = entry;
          try {
            let asset = await this.apiClient.upload(request);
            this.addedSubject.next(asset);

            if (this.bridge) {
              await this.bridge.pushBatchTelemetry(
                'ingest',
                {
                  assetId: asset.id,
                  kind: asset.kind,
                  folderPath: asset.folderPath,
                  filename: asset.filename,
                },
                request.dedupKey,
              );
              await this.bridge.emitChronicle(
                'ingest',
                'MEDIA_ADDED',
                {
                  assetId: asset.id,
                  kind: asset.kind,
                  folderPath: asset.folderPath,
                  visibility: asset.visibility,
                },
                request.combinatorFlowId,
              );
            }

            let waitedForProcessing = false;
            if (
              request.waitForReady &&
              asset.processingStatus !== 'READY' &&
              this.sseBus
            ) {
              waitedForProcessing = true;
              const assetNeuron = new MediaAssetNeuron({
                assetId: asset.id,
                apiClient: this.apiClient,
                sseBus: this.sseBus,
              });
              try {
                await assetNeuron.connect(false);
                asset = await assetNeuron.waitUntilReady(request.readyTimeoutMs ?? 60_000);
              } finally {
                assetNeuron.disconnect();
              }

              if (this.bridge) {
                await this.bridge.emitChronicle(
                  'ingest',
                  'MEDIA_READY',
                  {
                    assetId: asset.id,
                    kind: asset.kind,
                    durationMs: Date.now() - startedAt,
                  },
                  request.combinatorFlowId,
                );
              }
            }

            const result: MediaIngestResult = {
              asset,
              dedupKey: request.dedupKey,
              waitedForProcessing,
              elapsedMs: Date.now() - startedAt,
            };
            this.completedSubject.next(result);
            entry.resolve?.(result);
          } catch (rawErr: any) {
            const error = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
            this.errorsSubject.next({ request, error });
            if (this.bridge) {
              await this.bridge.emitChronicle(
                'ingest',
                'FAILURE',
                {
                  filename: request.filename,
                  folderPath: request.folderPath,
                  error: error.message,
                },
                request.combinatorFlowId,
              );
            }
            entry.reject?.(error);
          }
        }, this.concurrency),
      )
      .subscribe();
  }
}
