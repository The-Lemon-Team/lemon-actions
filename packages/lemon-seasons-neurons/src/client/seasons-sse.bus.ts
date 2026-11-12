import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SeasonsLiveNoteImpulse } from '../types/seasons.types';

export interface SeasonsSseBusOptions {
  baseUrl: string;
  token?: string;
  streamSlug?: string;
  feedSlug?: string;
}

export class SeasonsSseBus {
  public readonly baseUrl: string;
  private token?: string;
  private readonly packet$ = new Subject<SeasonsLiveNoteImpulse>();
  private es: any = null;

  constructor(options: SeasonsSseBusOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
  }

  connect(params?: { streamSlug?: string; feedSlug?: string }): void {
    this.disconnect();

    const qs = new URLSearchParams();
    if (params?.streamSlug) qs.set('streams', params.streamSlug);
    if (params?.feedSlug) qs.set('feeds', params.feedSlug);

    const url = `${this.baseUrl}/api/v1/sse${qs.toString() ? '?' + qs.toString() : ''}`;
    const factory = (globalThis as any).EventSource;

    if (!factory) {
      return;
    }

    this.es = new factory(url);
    this.es.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        this.packet$.next(data);
      } catch (err) {
        // Ignored unparsable SSE frame
      }
    };
  }

  disconnect(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  impulses$(): Observable<SeasonsLiveNoteImpulse> {
    return this.packet$.asObservable();
  }

  feedImpulses$(feedSlug: string): Observable<SeasonsLiveNoteImpulse> {
    return this.packet$.asObservable().pipe(
      filter((p: SeasonsLiveNoteImpulse) => p.feedSlug === feedSlug),
    );
  }
}
