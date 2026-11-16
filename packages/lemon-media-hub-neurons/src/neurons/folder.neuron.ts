import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import {
  FolderNeuronState,
  MediaAsset,
  MediaEventImpulse,
  QueryAssetsOptions,
} from '../types/media.types';

export interface FolderNeuronOptions {
  folderPath?: string;
  apiClient: MediaHubApiClient;
  sseBus: MediaSseBus;
  pageSize?: number;
  filters?: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>;
}

/**
 * Reactive Folder Neuron ("Нейрон Папки").
 * Direct media analogy of FeedNeuron:
 * - Paginated loading via GET /api/assets?folderPath=...
 * - Live SSE reconciliation for add, update, processing state, view usage, access changes, and delete.
 */
export class FolderNeuron<TAsset extends MediaAsset = MediaAsset> {
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus: MediaSseBus;
  private readonly pageSize: number;
  private readonly state$: BehaviorSubject<FolderNeuronState<TAsset>>;
  private sseSub: Subscription | null = null;

  constructor(options: FolderNeuronOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.pageSize = Math.min(200, Math.max(1, options.pageSize || 30));

    this.state$ = new BehaviorSubject<FolderNeuronState<TAsset>>({
      folderPath: options.folderPath || 'all',
      filters: options.filters || {},
      items: [],
      total: 0,
      limit: this.pageSize,
      offset: 0,
      hasMore: false,
      isLoading: false,
      lastImpulse: null,
    });
  }

  get folderPath(): string {
    return this.state$.getValue().folderPath;
  }

  get value(): FolderNeuronState<TAsset> {
    return this.state$.getValue();
  }

  get stateObservable$(): Observable<FolderNeuronState<TAsset>> {
    return this.state$.asObservable();
  }

  async connect(loadFirstPage = true): Promise<FolderNeuronState<TAsset>> {
    this.subscribeToFolder(this.value.folderPath);
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
  }

  async switchFolder(
    folderPath: string,
    filters?: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>,
  ): Promise<FolderNeuronState<TAsset>> {
    const clean = folderPath.trim() || 'all';
    const current = this.state$.getValue();
    this.state$.next({
      ...current,
      folderPath: clean,
      filters: filters !== undefined ? filters : current.filters,
      items: [],
      total: 0,
      offset: 0,
      hasMore: false,
      lastImpulse: null,
    });
    this.subscribeToFolder(clean);
    return this.loadInitialPage();
  }

  async setFilters(
    filters: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>,
  ): Promise<FolderNeuronState<TAsset>> {
    const current = this.state$.getValue();
    this.state$.next({
      ...current,
      filters,
      items: [],
      total: 0,
      offset: 0,
      hasMore: false,
    });
    return this.loadInitialPage();
  }

  async loadInitialPage(): Promise<FolderNeuronState<TAsset>> {
    const current = this.state$.getValue();
    this.state$.next({ ...current, isLoading: true });
    try {
      const res = await this.apiClient.listAssets({
        ...current.filters,
        folderPath: current.folderPath === 'all' ? undefined : current.folderPath,
        limit: this.pageSize,
        offset: 0,
      });
      const items = res.items as TAsset[];
      const next: FolderNeuronState<TAsset> = {
        ...this.state$.getValue(),
        items,
        total: res.total,
        limit: this.pageSize,
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

  async loadMore(): Promise<FolderNeuronState<TAsset>> {
    const current = this.state$.getValue();
    if (current.isLoading || !current.hasMore) return current;

    this.state$.next({ ...current, isLoading: true });
    try {
      const res = await this.apiClient.listAssets({
        ...current.filters,
        folderPath: current.folderPath === 'all' ? undefined : current.folderPath,
        limit: this.pageSize,
        offset: current.offset,
      });
      const existingIds = new Set(current.items.map((i) => i.id));
      const uniqueNew = (res.items as TAsset[]).filter((i) => !existingIds.has(i.id));
      const merged = [...current.items, ...uniqueNew];
      const next: FolderNeuronState<TAsset> = {
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

  private subscribeToFolder(folderPath: string): void {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
    }
    const source$ =
      folderPath === 'all'
        ? this.sseBus.impulses$
        : this.sseBus.selectFolder$(folderPath);

    this.sseSub = source$.subscribe((impulse) => {
      this.handleImpulse(impulse);
    });
  }

  private matchesFilters(asset: MediaAsset): boolean {
    const { folderPath, filters } = this.state$.getValue();
    if (folderPath !== 'all' && asset.folderPath.toLowerCase() !== folderPath.toLowerCase()) {
      return false;
    }
    if (filters.kind && asset.kind !== filters.kind) return false;
    if (filters.visibility && asset.visibility !== filters.visibility) return false;
    if (filters.processingStatus && asset.processingStatus !== filters.processingStatus) return false;
    if (filters.isFavorite !== undefined && asset.isFavorite !== filters.isFavorite) return false;
    if (filters.tag && !(asset.tags || []).includes(filters.tag)) return false;
    if (filters.style && asset.style?.toLowerCase() !== filters.style.toLowerCase()) return false;
    return true;
  }

  private handleImpulse(impulse: MediaEventImpulse): void {
    const current = this.state$.getValue();

    if (impulse.type === 'MEDIA_DELETED' && impulse.assetId) {
      const filtered = current.items.filter((i) => i.id !== impulse.assetId);
      const removed = filtered.length < current.items.length;
      this.state$.next({
        ...current,
        items: filtered,
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
    const existsIndex = current.items.findIndex((i) => i.id === incoming.id);
    const shouldInclude = this.matchesFilters(incoming);

    if (!shouldInclude) {
      if (existsIndex >= 0) {
        const items = current.items.filter((i) => i.id !== incoming.id);
        this.state$.next({
          ...current,
          items,
          total: Math.max(0, current.total - 1),
          lastImpulse: impulse,
        });
      }
      return;
    }

    if (existsIndex >= 0) {
      const items = [...current.items];
      items[existsIndex] = { ...items[existsIndex], ...incoming };
      this.state$.next({
        ...current,
        items,
        lastImpulse: impulse,
      });
      return;
    }

    if (impulse.type === 'MEDIA_ADDED' || impulse.type === 'MEDIA_UPDATED') {
      const items = [incoming, ...current.items];
      this.state$.next({
        ...current,
        items,
        total: current.total + 1,
        lastImpulse: impulse,
      });
    }
  }
}
