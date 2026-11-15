import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SeasonsNoteView,
  SeasonsPaginatedNotesView,
  SeasonsPrivacy,
  SeasonsSsePacketView,
  SeasonsStatusView,
  SeasonsTodoItemView,
  SeasonsTodoStatsView,
  SeasonsTopologyView,
} from '../models/seasons.models';

@Injectable({ providedIn: 'root' })
export class SeasonsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seasons`;

  getStatus(): Observable<SeasonsStatusView> {
    return this.http.get<SeasonsStatusView>(`${this.base}/status`);
  }

  getTopology(params?: {
    streamSlug?: string;
    privacy?: 'public' | 'private' | 'all';
  }): Observable<SeasonsTopologyView> {
    let httpParams = new HttpParams().set('privacy', params?.privacy || 'all');
    if (params?.streamSlug) {
      httpParams = httpParams.set('streamSlug', params.streamSlug);
    }
    return this.http.get<SeasonsTopologyView>(`${this.base}/topology`, { params: httpParams });
  }

  createStream(dto: {
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    privacy?: SeasonsPrivacy;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/streams`, dto);
  }

  createFeed(dto: {
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    privacy?: SeasonsPrivacy;
    streamSlug?: string;
    hashtags?: string[];
  }): Observable<unknown> {
    return this.http.post(`${this.base}/feeds`, dto);
  }

  getFeedNotes(
    feedSlug: string,
    opts?: { limit?: number; offset?: number; search?: string; type?: string },
  ): Observable<SeasonsPaginatedNotesView> {
    let params = new HttpParams()
      .set('limit', String(opts?.limit ?? 30))
      .set('offset', String(opts?.offset ?? 0));
    if (opts?.search) params = params.set('search', opts.search);
    if (opts?.type) params = params.set('type', opts.type);
    return this.http.get<SeasonsPaginatedNotesView>(
      `${this.base}/feeds/${encodeURIComponent(feedSlug)}/notes`,
      { params },
    );
  }

  getStreamNotes(
    streamSlug: string,
    opts?: { limit?: number; offset?: number; search?: string; type?: string },
  ): Observable<SeasonsPaginatedNotesView> {
    let params = new HttpParams()
      .set('limit', String(opts?.limit ?? 30))
      .set('offset', String(opts?.offset ?? 0));
    if (opts?.search) params = params.set('search', opts.search);
    if (opts?.type) params = params.set('type', opts.type);
    return this.http.get<SeasonsPaginatedNotesView>(
      `${this.base}/streams/${encodeURIComponent(streamSlug)}/notes`,
      { params },
    );
  }

  ingestNote(dto: {
    externalId?: string;
    title?: string;
    content: string;
    type?: string;
    privacy?: SeasonsPrivacy;
    streamSlug?: string;
    feedSlug?: string;
    tags?: string[];
    todoList?: Array<{
      id?: string;
      title: string;
      completed?: boolean;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  }): Observable<{ success: boolean; action: 'CREATED' | 'UPDATED'; noteId: string; note: SeasonsNoteView }> {
    return this.http.post<{
      success: boolean;
      action: 'CREATED' | 'UPDATED';
      noteId: string;
      note: SeasonsNoteView;
    }>(`${this.base}/notes/ingest`, dto);
  }

  proxyNoteTodos(
    noteId: string,
    dto: {
      action: 'add' | 'toggle' | 'remove' | 'replace';
      todoId?: string;
      title?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      todoList?: SeasonsTodoItemView[];
    },
  ): Observable<{
    note: SeasonsNoteView;
    todoList: SeasonsTodoItemView[];
    todoStats: SeasonsTodoStatsView;
  }> {
    return this.http.patch<{
      note: SeasonsNoteView;
      todoList: SeasonsTodoItemView[];
      todoStats: SeasonsTodoStatsView;
    }>(`${this.base}/notes/${encodeURIComponent(noteId)}/todos`, dto);
  }

  ensureProjectariumNamespace(): Observable<{ streamId: string; feedIds: string[] }> {
    return this.http.post<{ streamId: string; feedIds: string[] }>(
      `${this.base}/projectarium/ensure-namespace`,
      {},
    );
  }

  syncProjectariumStand(slug: string): Observable<{
    success: boolean;
    projectSlug: string;
    streamSlug: string;
    todosNoteId: string;
    notesSynced: number;
  }> {
    return this.http.post<{
      success: boolean;
      projectSlug: string;
      streamSlug: string;
      todosNoteId: string;
      notesSynced: number;
    }>(`${this.base}/projectarium/${encodeURIComponent(slug)}/sync`, {});
  }

  connectEventsStream(): Observable<SeasonsSsePacketView> {
    const subject = new Subject<SeasonsSsePacketView>();
    if (typeof EventSource === 'undefined') {
      return subject.asObservable();
    }

    const es = new EventSource(`${this.base}/events`);
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as SeasonsSsePacketView;
        subject.next(parsed);
      } catch {
        // Ignore unparsable SSE frames
      }
    };

    return new Observable<SeasonsSsePacketView>((subscriber) => {
      const sub = subject.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        es.close();
      };
    });
  }
}
