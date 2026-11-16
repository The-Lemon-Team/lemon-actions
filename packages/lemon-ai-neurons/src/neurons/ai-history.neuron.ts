import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { AiImpulseBus } from '../client/ai-impulse.bus';
import { AiServiceApiClient } from '../client/ai-service-api.client';
import {
  AiEventImpulse,
  AiHistoryNeuronState,
  AiHistoryQuery,
  AiRequestLog,
  AiUsageStats,
} from '../types/ai.types';

export interface AiHistoryNeuronOptions {
  apiClient: AiServiceApiClient;
  impulseBus: AiImpulseBus;
  pageSize?: number;
  initialFilters?: Omit<AiHistoryQuery, 'limit' | 'offset'>;
}

/**
 * Reactive AI History Neuron.
 * Mirrors PostgreSQL `AiRequestLog` and aggregated usage stats from `lemon-ai-service`,
 * automatically refreshing when new generation impulses arrive on `AiImpulseBus`.
 */
export class AiHistoryNeuron {
  private readonly apiClient: AiServiceApiClient;
  private readonly impulseBus: AiImpulseBus;
  private readonly pageSize: number;
  private readonly state$: BehaviorSubject<AiHistoryNeuronState>;
  private sub: Subscription | null = null;

  constructor(options: AiHistoryNeuronOptions) {
    this.apiClient = options.apiClient;
    this.impulseBus = options.impulseBus;
    this.pageSize = Math.min(200, Math.max(1, options.pageSize ?? 30));

    this.state$ = new BehaviorSubject<AiHistoryNeuronState>({
      items: [],
      total: 0,
      limit: this.pageSize,
      offset: 0,
      hasMore: false,
      filters: options.initialFilters || {},
      stats: null,
      isLoading: false,
      lastImpulse: null,
    });
  }

  get value(): AiHistoryNeuronState {
    return this.state$.getValue();
  }

  get stateObservable$(): Observable<AiHistoryNeuronState> {
    return this.state$.asObservable();
  }

  connect(loadInitial = true): Promise<AiHistoryNeuronState> {
    if (this.sub) this.sub.unsubscribe();
    this.sub = this.impulseBus.impulses$.subscribe((impulse) => {
      this.handleImpulse(impulse);
    });
    if (loadInitial) {
      return this.refreshAll();
    }
    return Promise.resolve(this.state$.getValue());
  }

  disconnect(): void {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
  }

  async refreshAll(): Promise<AiHistoryNeuronState> {
    const current = this.state$.getValue();
    this.state$.next({ ...current, isLoading: true });
    try {
      const [page, stats] = await Promise.all([
        this.apiClient.getHistory({
          ...current.filters,
          limit: this.pageSize,
          offset: 0,
        }),
        this.apiClient.getHistoryStats().catch(() => current.stats),
      ]);
      const next: AiHistoryNeuronState = {
        ...this.state$.getValue(),
        items: page.items,
        total: page.total,
        limit: page.limit,
        offset: page.items.length,
        hasMore: page.items.length < page.total,
        stats: stats ?? null,
        isLoading: false,
      };
      this.state$.next(next);
      this.impulseBus.emit('AI_HISTORY_SYNCED', {
        summary: `Synced ${page.items.length} of ${page.total} AI logs`,
      });
      return next;
    } catch (err) {
      this.state$.next({ ...this.state$.getValue(), isLoading: false });
      throw err;
    }
  }

  async applyFilters(
    filters: Omit<AiHistoryQuery, 'limit' | 'offset'>,
  ): Promise<AiHistoryNeuronState> {
    const current = this.state$.getValue();
    this.state$.next({ ...current, filters });
    return this.refreshAll();
  }

  async loadMore(): Promise<AiHistoryNeuronState> {
    const current = this.state$.getValue();
    if (current.isLoading || !current.hasMore) return current;

    this.state$.next({ ...current, isLoading: true });
    try {
      const page = await this.apiClient.getHistory({
        ...current.filters,
        limit: this.pageSize,
        offset: current.offset,
      });
      const existingIds = new Set(current.items.map((item) => item.id));
      const uniqueNew = page.items.filter((item) => !existingIds.has(item.id));
      const merged = [...current.items, ...uniqueNew];
      const next: AiHistoryNeuronState = {
        ...this.state$.getValue(),
        items: merged,
        total: page.total,
        offset: current.offset + page.items.length,
        hasMore: merged.length < page.total,
        isLoading: false,
      };
      this.state$.next(next);
      return next;
    } catch (err) {
      this.state$.next({ ...this.state$.getValue(), isLoading: false });
      throw err;
    }
  }

  async refreshStats(): Promise<AiUsageStats> {
    const stats = await this.apiClient.getHistoryStats();
    this.state$.next({ ...this.state$.getValue(), stats });
    return stats;
  }

  async fetchEntry(id: string): Promise<AiRequestLog> {
    return this.apiClient.getHistoryById(id);
  }

  private handleImpulse(impulse: AiEventImpulse): void {
    const current = this.state$.getValue();
    this.state$.next({ ...current, lastImpulse: impulse });

    if (
      impulse.requestId &&
      (impulse.type === 'AI_TEXT_GENERATED' ||
        impulse.type === 'AI_NOTE_GENERATED' ||
        impulse.type === 'AI_QUICK_ADD_PARSED' ||
        impulse.type === 'AI_IMAGES_GENERATED' ||
        impulse.type === 'AI_IMAGE_REMIXED' ||
        impulse.type === 'AI_IMAGE_ANALYZED')
    ) {
      void this.prependLatestEntry(impulse.requestId);
    }
  }

  private async prependLatestEntry(requestId: string): Promise<void> {
    try {
      const [entry, stats] = await Promise.all([
        this.apiClient.getHistoryById(requestId),
        this.apiClient.getHistoryStats().catch(() => null),
      ]);
      const current = this.state$.getValue();
      const withoutDup = current.items.filter((item) => item.id !== entry.id);
      const isNew = withoutDup.length === current.items.length;
      this.state$.next({
        ...current,
        items: [entry, ...withoutDup],
        total: isNew ? current.total + 1 : current.total,
        stats: stats ?? current.stats,
      });
    } catch {
      // Best-effort live prepend; user can still manually refresh
    }
  }
}
