import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  MediaEventImpulse,
  MediaImpulseType,
  MediaKind,
  MediaSsePacket,
} from '../types/media.types';
import { MediaHubApiClient } from './media-hub-api.client';

export interface MediaSseBusOptions {
  apiClient: MediaHubApiClient;
  folderPath?: string;
  kind?: MediaKind;
  assetId?: string;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

/**
 * Multiplexed reactive impulse bus for Lemon Media Hub (`GET /api/media/stream`).
 * Direct media analogy of SeasonsSseBus: shares one SSE stream across FolderNeuron,
 * MediaLibraryNeuron, MediaAssetNeuron, MediaTopologyNeuron, and action flows.
 */
export class MediaSseBus {
  private readonly apiClient: MediaHubApiClient;
  private readonly filterFolderPath?: string;
  private readonly filterKind?: MediaKind;
  private readonly filterAssetId?: string;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  private readonly packetsSubject = new Subject<MediaSsePacket>();
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  private activeAbort: AbortController | null = null;
  private activeEventSource: { close: () => void } | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private reconnectAttempts = 0;

  constructor(options: MediaSseBusOptions) {
    this.apiClient = options.apiClient;
    this.filterFolderPath = options.folderPath;
    this.filterKind = options.kind;
    this.filterAssetId = options.assetId;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1500;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 15000;
  }

  get packets$(): Observable<MediaSsePacket> {
    return this.packetsSubject.asObservable();
  }

  get impulses$(): Observable<MediaEventImpulse> {
    return this.packetsSubject.pipe(map((p) => p.impulse));
  }

  get connected$(): Observable<boolean> {
    return this.connectedSubject.asObservable();
  }

  get isConnected(): boolean {
    return this.connectedSubject.getValue();
  }

  selectType$(...types: MediaImpulseType[]): Observable<MediaEventImpulse> {
    const allowed = new Set(types);
    return this.impulses$.pipe(filter((impulse) => allowed.has(impulse.type)));
  }

  selectFolder$(folderPath: string): Observable<MediaEventImpulse> {
    const normalized = folderPath.trim().replace(/^\/|\/$/g, '').toLowerCase();
    return this.impulses$.pipe(
      filter((impulse) => {
        if (!normalized || normalized === 'all') return true;
        const prevFolder =
          typeof impulse.payload?.previousFolderPath === 'string'
            ? impulse.payload.previousFolderPath.trim().toLowerCase()
            : undefined;
        return (
          impulse.folderPath?.toLowerCase() === normalized ||
          prevFolder === normalized
        );
      }),
    );
  }

  selectKind$(kind: MediaKind): Observable<MediaEventImpulse> {
    return this.impulses$.pipe(filter((impulse) => impulse.kind === kind));
  }

  selectAsset$(assetId: string): Observable<MediaEventImpulse> {
    return this.impulses$.pipe(filter((impulse) => impulse.assetId === assetId));
  }

  get mediaAdded$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_ADDED');
  }

  get mediaProcessing$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_PROCESSING');
  }

  get mediaReady$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_READY');
  }

  get mediaFailed$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_FAILED');
  }

  get mediaUpdated$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_UPDATED', 'MEDIA_ACCESS_CHANGED', 'MEDIA_FAVORITED');
  }

  get mediaViewed$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_VIEWED');
  }

  get mediaDeleted$(): Observable<MediaEventImpulse> {
    return this.selectType$('MEDIA_DELETED');
  }

  get folderEvents$(): Observable<MediaEventImpulse> {
    return this.selectType$('FOLDER_CREATED', 'FOLDER_DELETED');
  }

  /**
   * Injects a synthetic or optimistic impulse onto the bus (used by tests & optimistic local UI sync).
   */
  emitPacket(impulse: MediaEventImpulse): void {
    this.packetsSubject.next({
      type: impulse.type,
      impulse,
      receivedAt: Date.now(),
    });
  }

  connect(): void {
    if (this.activeAbort || this.activeEventSource) return;
    this.shouldReconnect = true;
    this.openConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }
    this.connectedSubject.next(false);
  }

  private buildStreamUrl(includeQueryAuth: boolean): string {
    const params = includeQueryAuth ? this.apiClient.getAuthQueryParams() : new URLSearchParams();
    if (this.filterFolderPath) params.set('folderPath', this.filterFolderPath);
    if (this.filterKind) params.set('kind', this.filterKind);
    if (this.filterAssetId) params.set('assetId', this.filterAssetId);
    const qs = params.toString();
    return `${this.apiClient.baseUrl}/api/media/stream${qs ? `?${qs}` : ''}`;
  }

  private openConnection(): void {
    if (!this.shouldReconnect) return;

    const EventSourceCtor = (globalThis as any).EventSource;
    if (typeof EventSourceCtor === 'function') {
      const url = this.buildStreamUrl(true);
      const es = new EventSourceCtor(url);
      this.activeEventSource = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        this.connectedSubject.next(true);
      };

      es.onmessage = (event: { data?: string }) => {
        if (!event.data) return;
        this.handleRawJson(event.data);
      };

      es.onerror = () => {
        es.close();
        this.activeEventSource = null;
        this.connectedSubject.next(false);
        this.scheduleReconnect();
      };
      return;
    }

    // Node.js / Fetch streaming SSE consumer with header-based auth
    const abort = new AbortController();
    this.activeAbort = abort;
    void this.consumeFetchStream(abort);
  }

  private async consumeFetchStream(abort: AbortController): Promise<void> {
    const url = this.buildStreamUrl(false);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...this.apiClient.getAuthHeaders(),
        },
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE stream failed with HTTP ${res.status}`);
      }

      this.reconnectAttempts = 0;
      this.connectedSubject.next(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!abort.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith('data:')) {
            const jsonText = line.slice(5).trim();
            if (jsonText) {
              this.handleRawJson(jsonText);
            }
          }
        }
      }
    } catch {
      // Connection closed or aborted
    } finally {
      if (this.activeAbort === abort) {
        this.activeAbort = null;
      }
      this.connectedSubject.next(false);
      this.scheduleReconnect();
    }
  }

  private handleRawJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as MediaEventImpulse;
      if (parsed && parsed.type) {
        this.emitPacket(parsed);
      }
    } catch {
      // Ignore heartbeat/unparsable chunks
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    const expDelay = Math.min(
      this.maxReconnectDelayMs,
      this.reconnectDelayMs * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)),
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, expDelay);
  }
}
