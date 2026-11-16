import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MediaAssetLineageView,
  MediaAssetsPageView,
  MediaAssetsQuery,
  MediaAssetView,
  MediaCombinatorNeuronSummaryView,
  MediaFolderView,
  MediaServiceClientView,
  MediaSsePacketView,
  MediaStatusView,
  MediaVisibility,
} from '../models/media.models';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/media`;

  getStatus(): Observable<MediaStatusView> {
    return this.http.get<MediaStatusView>(`${this.base}/status`);
  }

  login(
    username: string,
    password: string,
  ): Observable<{ authenticated: boolean; admin: { username: string; role: string } }> {
    return this.http.post<{ authenticated: boolean; admin: { username: string; role: string } }>(
      `${this.base}/auth/login`,
      { username, password },
    );
  }

  ensureNeurons(): Observable<{
    synced: boolean;
    neurons: MediaCombinatorNeuronSummaryView[];
  }> {
    return this.http.post<{
      synced: boolean;
      neurons: MediaCombinatorNeuronSummaryView[];
    }>(`${this.base}/neurons/ensure`, {});
  }

  listFolders(): Observable<MediaFolderView[]> {
    return this.http.get<MediaFolderView[]>(`${this.base}/folders`);
  }

  createFolder(dto: {
    name: string;
    path?: string;
    icon?: string;
    color?: string;
    defaultVisibility?: MediaVisibility;
  }): Observable<MediaFolderView> {
    return this.http.post<MediaFolderView>(`${this.base}/folders`, dto);
  }

  deleteFolder(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/folders/${encodeURIComponent(id)}`,
    );
  }

  listAssets(query: MediaAssetsQuery = {}): Observable<MediaAssetsPageView> {
    let params = new HttpParams();
    if (query.kind) params = params.set('kind', query.kind);
    if (query.visibility) params = params.set('visibility', query.visibility);
    if (query.processingStatus) {
      params = params.set('processingStatus', query.processingStatus);
    }
    if (query.folderPath && query.folderPath !== 'all') {
      params = params.set('folderPath', query.folderPath);
    }
    if (query.search) params = params.set('search', query.search);
    if (query.tag) params = params.set('tag', query.tag);
    if (query.isFavorite !== undefined) {
      params = params.set('isFavorite', String(query.isFavorite));
    }
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));
    if (query.offset !== undefined) params = params.set('offset', String(query.offset));

    return this.http.get<MediaAssetsPageView>(`${this.base}/assets`, { params });
  }

  getAsset(id: string): Observable<MediaAssetView> {
    return this.http.get<MediaAssetView>(
      `${this.base}/assets/${encodeURIComponent(id)}`,
    );
  }

  getAssetLineage(id: string): Observable<MediaAssetLineageView> {
    return this.http.get<MediaAssetLineageView>(
      `${this.base}/assets/${encodeURIComponent(id)}/lineage`,
    );
  }

  uploadAsset(input: {
    file: File;
    folderPath?: string;
    title?: string;
    description?: string;
    tags?: string[];
    visibility?: MediaVisibility;
    allowedClients?: string[];
    waitForReady?: boolean;
  }): Observable<{ asset: MediaAssetView; waitedForProcessing: boolean; elapsedMs: number }> {
    const form = new FormData();
    form.append('file', input.file, input.file.name);
    if (input.folderPath) form.append('folderPath', input.folderPath);
    if (input.title) form.append('title', input.title);
    if (input.description) form.append('description', input.description);
    if (input.tags?.length) form.append('tags', input.tags.join(','));
    if (input.visibility) form.append('visibility', input.visibility);
    if (input.allowedClients?.length) {
      form.append('allowedClients', input.allowedClients.join(','));
    }
    if (input.waitForReady) form.append('waitForReady', 'true');

    return this.http.post<{
      asset: MediaAssetView;
      waitedForProcessing: boolean;
      elapsedMs: number;
    }>(`${this.base}/assets/upload`, form);
  }

  updateMetadata(
    id: string,
    patch: {
      title?: string;
      description?: string;
      folderPath?: string;
      tags?: string[];
    },
  ): Observable<MediaAssetView> {
    return this.http.patch<MediaAssetView>(
      `${this.base}/assets/${encodeURIComponent(id)}`,
      patch,
    );
  }

  updateAccess(
    id: string,
    patch: {
      visibility: MediaVisibility;
      clients?: Array<{ clientSlug: string; permission?: 'READ' | 'WRITE'; expiresAt?: string }>;
    },
  ): Observable<MediaAssetView> {
    return this.http.patch<MediaAssetView>(
      `${this.base}/assets/${encodeURIComponent(id)}/access`,
      patch,
    );
  }

  toggleFavorite(id: string): Observable<MediaAssetView> {
    return this.http.patch<MediaAssetView>(
      `${this.base}/assets/${encodeURIComponent(id)}/favorite`,
      {},
    );
  }

  reprocessAsset(id: string): Observable<MediaAssetView> {
    return this.http.post<MediaAssetView>(
      `${this.base}/assets/${encodeURIComponent(id)}/reprocess`,
      {},
    );
  }

  trackView(id: string, variant?: string): Observable<unknown> {
    return this.http.post(`${this.base}/assets/${encodeURIComponent(id)}/view`, {
      variant,
    });
  }

  deleteAsset(
    id: string,
    reason?: string,
  ): Observable<{ assetId: string; success: boolean; deletedAt: string }> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.delete<{ assetId: string; success: boolean; deletedAt: string }>(
      `${this.base}/assets/${encodeURIComponent(id)}`,
      { params },
    );
  }

  listClients(): Observable<MediaServiceClientView[]> {
    return this.http.get<MediaServiceClientView[]>(`${this.base}/clients`);
  }

  createClient(dto: {
    slug: string;
    name: string;
    scopes?: string[];
  }): Observable<MediaServiceClientView> {
    return this.http.post<MediaServiceClientView>(`${this.base}/clients`, dto);
  }

  rotateClientKey(id: string): Observable<MediaServiceClientView> {
    return this.http.post<MediaServiceClientView>(
      `${this.base}/clients/${encodeURIComponent(id)}/rotate-key`,
      {},
    );
  }

  assetFileUrl(id: string, variant = 'auto'): string {
    return `${this.base}/assets/${encodeURIComponent(id)}/file/${encodeURIComponent(variant)}`;
  }

  connectEvents(): Observable<MediaSsePacketView> {
    return new Observable<MediaSsePacketView>((subscriber) => {
      const es = new EventSource(`${this.base}/events`);
      const onMessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as MediaSsePacketView;
          subscriber.next(parsed);
        } catch {
          // ignore malformed SSE heartbeat
        }
      };

      es.addEventListener('message', onMessage);
      es.onerror = () => {
        // EventSource automatically reconnects
      };

      return () => {
        es.removeEventListener('message', onMessage);
        es.close();
      };
    });
  }
}
