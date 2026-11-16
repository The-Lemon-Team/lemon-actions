import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiAnalyzedImageView,
  AiClientAppView,
  AiCombinatorNeuronSummaryView,
  AiGeneratedImagesView,
  AiGeneratedNoteView,
  AiGeneratedTextView,
  AiHistoryPageView,
  AiHistoryQuery,
  AiQuickAddView,
  AiRemixedImageView,
  AiRequestLogView,
  AiSsePacketView,
  AiStatusView,
  AiTaskType,
  AiTone,
  AiUsageStatsView,
  CreatedAiClientView,
  ImageAspectRatio,
} from '../models/ai.models';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ai`;

  getStatus(): Observable<AiStatusView> {
    return this.http.get<AiStatusView>(`${this.base}/status`);
  }

  setApiKey(apiKey: string): Observable<{ authenticated: boolean; hasApiKey: boolean }> {
    return this.http.post<{ authenticated: boolean; hasApiKey: boolean }>(
      `${this.base}/auth/key`,
      { apiKey },
    );
  }

  ensureNeurons(): Observable<{
    synced: boolean;
    neurons: AiCombinatorNeuronSummaryView[];
  }> {
    return this.http.post<{
      synced: boolean;
      neurons: AiCombinatorNeuronSummaryView[];
    }>(`${this.base}/neurons/ensure`, {});
  }

  getHistory(query: AiHistoryQuery = {}): Observable<AiHistoryPageView> {
    let params = new HttpParams();
    if (query.clientSlug) params = params.set('clientSlug', query.clientSlug);
    if (query.taskType) params = params.set('taskType', query.taskType);
    if (query.status) params = params.set('status', query.status);
    if (query.correlationId) params = params.set('correlationId', query.correlationId);
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));
    if (query.offset !== undefined) params = params.set('offset', String(query.offset));

    return this.http.get<AiHistoryPageView>(`${this.base}/history`, { params });
  }

  getHistoryStats(): Observable<AiUsageStatsView> {
    return this.http.get<AiUsageStatsView>(`${this.base}/history/stats`);
  }

  getHistoryById(id: string): Observable<AiRequestLogView> {
    return this.http.get<AiRequestLogView>(
      `${this.base}/history/${encodeURIComponent(id)}`,
    );
  }

  generateText(dto: {
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    correlationId?: string;
  }): Observable<AiGeneratedTextView> {
    return this.http.post<AiGeneratedTextView>(`${this.base}/generate-text`, dto);
  }

  generateNote(dto: {
    title?: string;
    topic?: string;
    tags?: string[];
    tone?: AiTone;
    category?: string;
    dateStr?: string;
    context?: string;
    noteType?: string;
    correlationId?: string;
  }): Observable<AiGeneratedNoteView> {
    return this.http.post<AiGeneratedNoteView>(`${this.base}/generate-note`, dto);
  }

  parseQuickAdd(dto: {
    rawText: string;
    correlationId?: string;
  }): Observable<AiQuickAddView> {
    return this.http.post<AiQuickAddView>(`${this.base}/parse-quick-add`, dto);
  }

  generateImages(dto: {
    prompt: string;
    style?: string;
    aspectRatio?: ImageAspectRatio;
    folderPath?: string;
    count?: number;
    tags?: string[];
    context?: string;
    correlationId?: string;
  }): Observable<AiGeneratedImagesView> {
    return this.http.post<AiGeneratedImagesView>(`${this.base}/generate-images`, dto);
  }

  remixImage(dto: {
    sourceAssetId: string;
    instruction: string;
    style?: string;
    aspectRatio?: ImageAspectRatio;
    folderPath?: string;
    count?: number;
    correlationId?: string;
  }): Observable<AiRemixedImageView> {
    return this.http.post<AiRemixedImageView>(`${this.base}/remix-image`, dto);
  }

  analyzeImage(dto: {
    sourceAssetId: string;
    instruction?: string;
    correlationId?: string;
  }): Observable<AiAnalyzedImageView> {
    return this.http.post<AiAnalyzedImageView>(`${this.base}/analyze-image`, dto);
  }

  listClients(): Observable<AiClientAppView[]> {
    return this.http.get<AiClientAppView[]>(`${this.base}/clients`);
  }

  createClient(dto: {
    slug: string;
    name: string;
    allowedTasks?: AiTaskType[];
    dailyLimit?: number;
  }): Observable<CreatedAiClientView> {
    return this.http.post<CreatedAiClientView>(`${this.base}/clients`, dto);
  }

  mediaThumbUrl(assetId: string): string {
    return `${environment.apiUrl}/media/assets/${encodeURIComponent(assetId)}/file/thumb`;
  }

  mediaFullUrl(assetId: string): string {
    return `${environment.apiUrl}/media/assets/${encodeURIComponent(assetId)}/file/full`;
  }

  connectEvents(): Observable<AiSsePacketView> {
    return new Observable<AiSsePacketView>((subscriber) => {
      const es = new EventSource(`${this.base}/events`);
      const onMessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as AiSsePacketView;
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
