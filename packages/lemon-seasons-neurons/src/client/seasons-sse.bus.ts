import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  SeasonsLiveNoteImpulse,
  SeasonsSsePacket,
  SeasonsTopologyPatch,
} from '../types/seasons.types';

export interface SeasonsSseBusOptions {
  baseUrl: string;
  token?: string;
  streamSlug?: string;
  feedSlug?: string;
  includeTopology?: boolean;
  sinceEventId?: string;
}

export class SeasonsSseBus {
  public readonly baseUrl: string;
  private token?: string;
  private includeTopology: boolean;
  private lastEventId: string | null = null;
  private readonly packet$ = new Subject<SeasonsSsePacket>();
  private es: any = null;
  private abortController: AbortController | null = null;
  private connected = false;

  constructor(options: SeasonsSseBusOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.includeTopology = options.includeTopology ?? true;
    this.lastEventId = options.sinceEventId ?? null;
  }

  setToken(token?: string): void {
    this.token = token;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLastEventId(): string | null {
    return this.lastEventId;
  }

  buildStreamUrl(params?: {
    streamSlug?: string;
    feedSlug?: string;
    includeTopology?: boolean;
  }): string {
    const qs = new URLSearchParams();
    if (this.token) qs.set('token', this.token);
    if (this.lastEventId) qs.set('since', this.lastEventId);
    if (params?.streamSlug) qs.set('streams', params.streamSlug);
    if (params?.feedSlug) qs.set('feeds', params.feedSlug);
    const topo = params?.includeTopology ?? this.includeTopology;
    qs.set('topology', String(topo));

    const query = qs.toString();
    return `${this.baseUrl}/api/v1/events/stream${query ? `?${query}` : ''}`;
  }

  connect(params?: { streamSlug?: string; feedSlug?: string; includeTopology?: boolean }): void {
    this.disconnect();

    const url = this.buildStreamUrl(params);
    const factory = (globalThis as any).EventSource;

    if (factory) {
      const es = new factory(url);
      this.es = es;
      es.onopen = () => {
        this.connected = true;
      };
      es.onerror = () => {
        this.connected = false;
      };

      const handleRaw = (event: any) => {
        this.connected = true;
        if (event?.lastEventId) {
          this.lastEventId = event.lastEventId;
        }
        this.ingestRawFrame(event?.data);
      };

      es.onmessage = handleRaw;
      if (es.addEventListener) {
        es.addEventListener('note', handleRaw);
        es.addEventListener('topology', handleRaw);
      }
      return;
    }

    // Node.js fallback using native fetch ReadableStream
    const ac = new AbortController();
    this.abortController = ac;
    void this.consumeFetchSse(url, ac);
  }

  disconnect(): void {
    this.connected = false;
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  emitPacket(packet: SeasonsSsePacket): void {
    if (packet.kind === 'note' && packet.event.id) {
      this.lastEventId = packet.event.id;
    }
    this.packet$.next(packet);
  }

  packets$(): Observable<SeasonsSsePacket> {
    return this.packet$.asObservable();
  }

  impulses$(): Observable<SeasonsLiveNoteImpulse> {
    return this.packet$.asObservable().pipe(
      filter((p): p is { kind: 'note'; event: SeasonsLiveNoteImpulse } => p.kind === 'note'),
      map((p) => p.event),
    );
  }

  get noteEvents$(): Observable<SeasonsLiveNoteImpulse> {
    return this.impulses$();
  }

  topologyPatches$(): Observable<SeasonsTopologyPatch> {
    return this.packet$.asObservable().pipe(
      filter((p): p is { kind: 'topology'; patch: SeasonsTopologyPatch } => p.kind === 'topology'),
      map((p) => p.patch),
    );
  }

  feedImpulses$(feedSlug: string): Observable<SeasonsLiveNoteImpulse> {
    const norm = feedSlug.toLowerCase().trim();
    return this.impulses$().pipe(
      filter(
        (p) =>
          p.feedSlug?.toLowerCase() === norm ||
          p.previousFeedSlug?.toLowerCase() === norm ||
          p.type === 'NOTE_DELETED',
      ),
    );
  }

  selectFeed$(feedSlug: string): Observable<SeasonsLiveNoteImpulse> {
    return this.feedImpulses$(feedSlug);
  }

  selectStream$(streamSlug: string): Observable<SeasonsLiveNoteImpulse> {
    const norm = streamSlug.toLowerCase().trim();
    return this.impulses$().pipe(
      filter(
        (e) =>
          e.streamSlug?.toLowerCase() === norm ||
          Boolean(e.streamSlugs?.some((s) => s.toLowerCase() === norm)) ||
          e.type === 'NOTE_DELETED',
      ),
    );
  }

  private ingestRawFrame(raw: unknown): void {
    if (typeof raw !== 'string' || !raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.type === 'TOPOLOGY_PATCH') {
        this.emitPacket({ kind: 'topology', patch: parsed as SeasonsTopologyPatch });
      } else if (parsed.type && parsed.id) {
        this.emitPacket({ kind: 'note', event: parsed as SeasonsLiveNoteImpulse });
      }
    } catch {
      // Ignore ping or unparsable SSE frame
    }
  }

  private async consumeFetchSse(url: string, ac: AbortController): Promise<void> {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        this.connected = false;
        return;
      }
      this.connected = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          const dataLines = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());
          if (dataLines.length > 0) {
            this.ingestRawFrame(dataLines.join('\n'));
          }
        }
      }
    } catch {
      // Aborted or disconnected
    } finally {
      this.connected = false;
    }
  }
}
