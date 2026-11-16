import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import {
  MediaAsset,
  MediaEventImpulse,
  MediaLibraryNeuronState,
  QueryAssetsOptions,
} from '../types/media.types';
import { FolderNeuron } from './folder.neuron';
import { MediaAssetNeuron } from './media-asset.neuron';

export interface MediaLibraryNeuronOptions {
  apiClient: MediaHubApiClient;
  sseBus: MediaSseBus;
  pageSize?: number;
  baseQuery?: Omit<QueryAssetsOptions, 'limit' | 'offset'>;
}

/**
 * Reactive Media Library Neuron ("Нейрон Библиотеки").
 * Direct analogy of StreamNeuron:
 * - Coordinates global library items over paginated GET /api/assets + live SSE impulses.
 * - Spawns and caches child FolderNeuron and MediaAssetNeuron instances sharing the same bus.
 */
export class MediaLibraryNeuron<TAsset extends MediaAsset = MediaAsset> {
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus: MediaSseBus;
  private readonly pageSize: number;
  private readonly baseQuery: Omit<QueryAssetsOptions, 'limit' | 'offset'>;

  private readonly state$: BehaviorSubject<MediaLibraryNeuronState<TAsset>>;
  private readonly folderNeurons = new Map<string, FolderNeuron<TAsset>>();
  private readonly assetNeurons = new Map<string, MediaAssetNeuron<TAsset>>();
  private sseSub: Subscription | null = null;

  constructor(options: MediaLibraryNeuronOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.pageSize = Math.min(200, Math.max(1, options.pageSize || 30));
    this.baseQuery = options.baseQuery || {};

    this.state$ = new BehaviorSubject<MediaLibraryNeuronState<TAsset>>({
      activeFolderPath: this.baseQuery.folderPath || 'all',
      items: [],
      total: 0,
      limit: this.pageSize,
      offset: 0,
      hasMore: false,
      isLoading: false,
      lastImpulse: null,
    });
  }

  get value(): MediaLibraryNeuronState<TAsset> {
    return this.state$.getValue();
  }

  get stateObservable$(): Observable<MediaLibraryNeuronState<TAsset>> {
    return this.state$.asObservable();
  }

  async connect(loadFirstPage = true): Promise<MediaLibraryNeuronState<TAsset>> {
    if (this.sseSub) this.sseSub.unsubscribe();
    this.sseSub = this.sseBus.impulses$.subscribe((impulse) => {
      this.handleImpulse(impulse);
    });
    if (loadFirstPage) {
      return this.loadInitialPage();
    }
    return this.state$.getValue();
  }

  disconnect(): void {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
      this.sseSub = null;
    }
    for (const folder of this.folderNeurons.values()) {
      folder.disconnect();
    }
    for (const asset of this.assetNeurons.values()) {
      asset.disconnect();
    }
  }

  getOrCreateFolderNeuron(
    folderPath: string,
    filters?: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>,
  ): FolderNeuron<TAsset> {
    const key = folderPath.trim().toLowerCase() || 'all';
    const existing = this.folderNeurons.get(key);
    if (existing) return existing;

    const neuron = new FolderNeuron<TAsset>({
      folderPath: key,
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      pageSize: this.pageSize,
      filters,
    });
    this.folderNeurons.set(key, neuron);
    return neuron;
  }

  getOrCreateAssetNeuron(
    assetId: string,
    defaultVariant?: string,
  ): MediaAssetNeuron<TAsset> {
    const key = `${assetId}:${defaultVariant || 'auto'}`;
    const existing = this.assetNeurons.get(key);
    if (existing) return existing;

    const neuron = new MediaAssetNeuron<TAsset>({
      assetId,
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      defaultVariant,
    });
    this.assetNeurons.set(key, neuron);
    return neuron;
  }

  async focusFolder(folderPath: string): Promise<FolderNeuron<TAsset>> {
    const neuron = this.getOrCreateFolderNeuron(folderPath);
    const current = this.state$.getValue();
    this.state$.next({ ...current, activeFolderPath: folderPath });
    await neuron.connect(true);
    return neuron;
  }

  async loadInitialPage(): Promise<MediaLibraryNeuronState<TAsset>> {
    const current = this.state$.getValue();
    this.state$.next({ ...current, isLoading: true });
    try {
      const res = await this.apiClient.listAssets({
        ...this.baseQuery,
        limit: this.pageSize,
        offset: 0,
      });
      const items = res.items as TAsset[];
      const next: MediaLibraryNeuronState<TAsset> = {
        ...this.state$.getValue(),
        items,
        total: res.total,
        offset: items.length,
        hasMore: items.length < res.total,
        isLoading: false,
      };
      this.state$.next(next);
      return next;
    } catch (err) {
      this.state$.next({ ...this.state$.getValue(), isLoading: false });
      throw err;
    }
  }

  async loadMore(): Promise<MediaLibraryNeuronState<TAsset>> {
    const current = this.state$.getValue();
    if (current.isLoading || !current.hasMore) return current;

    this.state$.next({ ...current, isLoading: true });
    try {
      const res = await this.apiClient.listAssets({
        ...this.baseQuery,
        limit: this.pageSize,
        offset: current.offset,
      });
      const existingIds = new Set(current.items.map((i) => i.id));
      const uniqueNew = (res.items as TAsset[]).filter((i) => !existingIds.has(i.id));
      const merged = [...current.items, ...uniqueNew];
      const next: MediaLibraryNeuronState<TAsset> = {
        ...this.state$.getValue(),
        items: merged,
        total: res.total,
        offset: current.offset + res.items.length,
        hasMore: merged.length < res.total,
        isLoading: false,
      };
      this.state$.next(next);
      return next;
    } catch (err) {
      this.state$.next({ ...this.state$.getValue(), isLoading: false });
      throw err;
    }
  }

  private handleImpulse(impulse: MediaEventImpulse): void {
    const current = this.state$.getValue();

    if (impulse.type === 'MEDIA_DELETED' && impulse.assetId) {
      const items = current.items.filter((i) => i.id !== impulse.assetId);
      const removed = items.length < current.items.length;
      this.state$.next({
        ...current,
        items,
        total: removed ? Math.max(0, current.total - 1) : current.total,
        lastImpulse: impulse,
      });
      return;
    }

    if (!impulse.asset) {
      this.state$.next({ ...current, lastImpulse: impulse });
      return;
    }

    const incoming = impulse.asset as TAsset;
    const idx = current.items.findIndex((i) => i.id === incoming.id);
    if (idx >= 0) {
      const items = [...current.items];
      items[idx] = { ...items[idx], ...incoming };
      this.state$.next({ ...current, items, lastImpulse: impulse });
      return;
    }

    if (impulse.type === 'MEDIA_ADDED') {
      this.state$.next({
        ...current,
        items: [incoming, ...current.items],
        total: current.total + 1,
        lastImpulse: impulse,
      });
    }
  }
}
