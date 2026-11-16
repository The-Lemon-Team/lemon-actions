import { BehaviorSubject, Observable, Subscription, firstValueFrom, interval } from 'rxjs';
import { filter, switchMap, takeWhile } from 'rxjs/operators';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import {
  MediaAsset,
  MediaAssetNeuronState,
  MediaEventImpulse,
} from '../types/media.types';

export interface MediaAssetNeuronOptions {
  assetId: string;
  apiClient: MediaHubApiClient;
  sseBus: MediaSseBus;
  defaultVariant?: string;
  signedUrlTtlSeconds?: number;
}

/**
 * Reactive Single-Asset Neuron ("Нейрон Медиа-Ассета").
 * Manages live state, processing progression (PENDING -> PROCESSING -> READY | FAILED),
 * playable/viewable URL resolution (public direct URL or auto-renewed HMAC signed URL),
 * and deletion awareness for a single media asset.
 */
export class MediaAssetNeuron<TAsset extends MediaAsset = MediaAsset> {
  public readonly assetId: string;
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus: MediaSseBus;
  private readonly defaultVariant?: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly state$: BehaviorSubject<MediaAssetNeuronState<TAsset>>;
  private sseSub: Subscription | null = null;
  private renewSub: Subscription | null = null;

  constructor(options: MediaAssetNeuronOptions) {
    this.assetId = options.assetId;
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.defaultVariant = options.defaultVariant;
    this.signedUrlTtlSeconds = options.signedUrlTtlSeconds ?? 3600;

    this.state$ = new BehaviorSubject<MediaAssetNeuronState<TAsset>>({
      assetId: this.assetId,
      asset: null,
      resolvedUrl: null,
      thumbnailUrl: null,
      signedExpiresAt: null,
      processingStatus: null,
      deleted: false,
      isLoading: false,
      error: null,
      lastImpulse: null,
    });
  }

  get value(): MediaAssetNeuronState<TAsset> {
    return this.state$.getValue();
  }

  get stateObservable$(): Observable<MediaAssetNeuronState<TAsset>> {
    return this.state$.asObservable();
  }

  async connect(resolvePlayableUrl = true): Promise<MediaAssetNeuronState<TAsset>> {
    if (this.sseSub) this.sseSub.unsubscribe();
    this.sseSub = this.sseBus.selectAsset$(this.assetId).subscribe((impulse) => {
      void this.handleImpulse(impulse, resolvePlayableUrl);
    });

    return this.refresh(resolvePlayableUrl);
  }

  disconnect(): void {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
      this.sseSub = null;
    }
    if (this.renewSub) {
      this.renewSub.unsubscribe();
      this.renewSub = null;
    }
  }

  async refresh(resolvePlayableUrl = true): Promise<MediaAssetNeuronState<TAsset>> {
    this.state$.next({ ...this.state$.getValue(), isLoading: true, error: null });
    try {
      const asset = (await this.apiClient.getAsset(this.assetId)) as TAsset;
      const resolved = resolvePlayableUrl
        ? await this.resolveAccessUrls(asset)
        : {
            resolvedUrl: this.apiClient.resolveUrl(asset.url),
            thumbnailUrl: this.apiClient.resolveUrl(asset.thumbnailUrl),
            signedExpiresAt: null,
          };

      const next: MediaAssetNeuronState<TAsset> = {
        ...this.state$.getValue(),
        asset,
        resolvedUrl: resolved.resolvedUrl,
        thumbnailUrl: resolved.thumbnailUrl,
        signedExpiresAt: resolved.signedExpiresAt,
        processingStatus: asset.processingStatus,
        deleted: false,
        isLoading: false,
        error: asset.processingError ?? null,
      };
      this.state$.next(next);
      this.scheduleSignedRenewalIfNeeded(next);
      return next;
    } catch (err: any) {
      const next: MediaAssetNeuronState<TAsset> = {
        ...this.state$.getValue(),
        isLoading: false,
        error: err?.message || String(err),
      };
      this.state$.next(next);
      return next;
    }
  }

  async waitUntilReady(timeoutMs = 60000): Promise<TAsset> {
    const current = this.state$.getValue();
    if (current.asset?.processingStatus === 'READY') return current.asset;
    if (current.asset?.processingStatus === 'FAILED') {
      throw new Error(current.asset.processingError || 'Media processing failed');
    }

    const started = Date.now();
    return new Promise<TAsset>((resolve, reject) => {
      let pollSub: Subscription | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        stateSub.unsubscribe();
        pollSub?.unsubscribe();
        if (timer) clearTimeout(timer);
      };

      const stateSub = this.state$.subscribe((state) => {
        if (state.deleted) {
          cleanup();
          reject(new Error(`Media asset '${this.assetId}' was deleted while processing`));
          return;
        }
        if (state.asset?.processingStatus === 'READY') {
          cleanup();
          resolve(state.asset);
          return;
        }
        if (state.asset?.processingStatus === 'FAILED') {
          cleanup();
          reject(new Error(state.asset.processingError || 'Media processing failed'));
        }
      });

      // Poll fallback in case SSE is disconnected
      pollSub = interval(1500)
        .pipe(
          takeWhile(() => Date.now() - started < timeoutMs),
          filter(() => !this.sseBus.isConnected),
          switchMap(() => this.refresh(true)),
        )
        .subscribe();

      timer = setTimeout(async () => {
        try {
          const finalState = await this.refresh(true);
          if (finalState.asset?.processingStatus === 'READY') {
            cleanup();
            resolve(finalState.asset);
            return;
          }
        } catch {
          // ignore
        }
        cleanup();
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for asset '${this.assetId}'`));
      }, timeoutMs);
    });
  }

  async toggleFavorite(): Promise<TAsset> {
    const updated = (await this.apiClient.toggleFavorite(this.assetId)) as TAsset;
    const current = this.state$.getValue();
    this.state$.next({ ...current, asset: updated });
    return updated;
  }

  async awaitPlayableUrl(): Promise<string> {
    const state = await firstValueFrom(
      this.state$.pipe(filter((s) => !s.isLoading && Boolean(s.resolvedUrl || s.deleted))),
    );
    if (state.deleted || !state.resolvedUrl) {
      throw new Error(`Asset '${this.assetId}' has no playable URL`);
    }
    return state.resolvedUrl;
  }

  private async handleImpulse(
    impulse: MediaEventImpulse,
    resolvePlayableUrl: boolean,
  ): Promise<void> {
    const current = this.state$.getValue();
    if (impulse.type === 'MEDIA_DELETED') {
      if (this.renewSub) {
        this.renewSub.unsubscribe();
        this.renewSub = null;
      }
      this.state$.next({
        ...current,
        deleted: true,
        resolvedUrl: null,
        lastImpulse: impulse,
      });
      return;
    }

    const updatedAsset = (impulse.asset as TAsset | undefined) ?? current.asset;
    if (!updatedAsset) {
      await this.refresh(resolvePlayableUrl);
      return;
    }

    let resolvedUrl = current.resolvedUrl;
    let thumbnailUrl = this.apiClient.resolveUrl(updatedAsset.thumbnailUrl);
    let signedExpiresAt = current.signedExpiresAt;

    if (
      resolvePlayableUrl &&
      (impulse.type === 'MEDIA_READY' || impulse.type === 'MEDIA_ACCESS_CHANGED' || !resolvedUrl)
    ) {
      const urls = await this.resolveAccessUrls(updatedAsset);
      resolvedUrl = urls.resolvedUrl;
      thumbnailUrl = urls.thumbnailUrl;
      signedExpiresAt = urls.signedExpiresAt;
    }

    const next: MediaAssetNeuronState<TAsset> = {
      ...current,
      asset: updatedAsset,
      resolvedUrl,
      thumbnailUrl,
      signedExpiresAt,
      processingStatus: updatedAsset.processingStatus,
      error: updatedAsset.processingError ?? null,
      lastImpulse: impulse,
    };
    this.state$.next(next);
    this.scheduleSignedRenewalIfNeeded(next);
  }

  private async resolveAccessUrls(asset: MediaAsset): Promise<{
    resolvedUrl: string;
    thumbnailUrl: string;
    signedExpiresAt: string | null;
  }> {
    if (asset.visibility === 'PUBLIC' && !this.defaultVariant) {
      return {
        resolvedUrl: this.apiClient.resolveUrl(asset.url),
        thumbnailUrl: this.apiClient.resolveUrl(asset.thumbnailUrl),
        signedExpiresAt: null,
      };
    }

    if (asset.visibility === 'PUBLIC' && this.defaultVariant) {
      return {
        resolvedUrl: this.apiClient.resolveUrl(`/api/media/${asset.id}/file/${this.defaultVariant}`),
        thumbnailUrl: this.apiClient.resolveUrl(asset.thumbnailUrl),
        signedExpiresAt: null,
      };
    }

    const mainSigned = await this.apiClient.createSignedUrl(asset.id, {
      variant: this.defaultVariant,
      ttlSeconds: this.signedUrlTtlSeconds,
    });
    return {
      resolvedUrl: this.apiClient.resolveUrl(mainSigned.relativeUrl),
      thumbnailUrl: this.apiClient.resolveUrl(asset.thumbnailUrl),
      signedExpiresAt: mainSigned.expiresAt,
    };
  }

  private scheduleSignedRenewalIfNeeded(state: MediaAssetNeuronState<TAsset>): void {
    if (this.renewSub) {
      this.renewSub.unsubscribe();
      this.renewSub = null;
    }
    if (!state.signedExpiresAt || !state.asset || state.asset.visibility === 'PUBLIC') return;

    const msLeft = new Date(state.signedExpiresAt).getTime() - Date.now();
    const renewAfterMs = Math.max(5000, msLeft - 30_000);
    this.renewSub = interval(renewAfterMs)
      .pipe(switchMap(() => this.refresh(true)))
      .subscribe();
  }
}
