import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveShardTarget } from '../models/project-stand.models';
import {
  CodeRepoView,
  CreateFlowPayload,
  Flow,
  FlowEventRecord,
  FlowMetrics,
  FlowSessionRecord,
  FlowStatus,
  Folder,
  Profile,
} from '../models/flow.models';

const ACTIVE_SHARD_STORAGE_KEY = 'lemon_active_shard_v1';

/** Thin typed wrapper over the NestJS REST API (contracts = flow.models.ts). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly defaultBase = environment.apiUrl;
  private readonly activeShardSubject = new BehaviorSubject<ActiveShardTarget | null>(
    this.loadStoredShard(),
  );

  readonly activeShard$: Observable<ActiveShardTarget | null> = this.activeShardSubject.asObservable();

  get base(): string {
    return this.activeShardSubject.value?.apiBaseUrl.replace(/\/+$/, '') || this.defaultBase;
  }

  streamUrl(projectSlug?: string): string {
    const slug = projectSlug ?? this.activeShardSubject.value?.projectSlug;
    const qs = slug ? `?projectSlug=${encodeURIComponent(slug)}` : '';
    return `${this.base}/flows/stream${qs}`;
  }

  getActiveShard(): ActiveShardTarget | null {
    return this.activeShardSubject.value;
  }

  setActiveShard(shard: ActiveShardTarget | null): void {
    this.activeShardSubject.next(shard);
    this.saveStoredShard(shard);
  }

  private loadStoredShard(): ActiveShardTarget | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SHARD_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ActiveShardTarget>;
      if (parsed && parsed.shardId && parsed.projectSlug && parsed.apiBaseUrl) {
        return {
          shardId: parsed.shardId,
          projectSlug: parsed.projectSlug,
          projectName: parsed.projectName,
          tier: parsed.tier || 'dedicated',
          apiBaseUrl: parsed.apiBaseUrl,
        };
      }
    } catch {
      // ignore corrupted storage
    }
    return null;
  }

  private saveStoredShard(shard: ActiveShardTarget | null): void {
    try {
      if (shard) {
        localStorage.setItem(ACTIVE_SHARD_STORAGE_KEY, JSON.stringify(shard));
      } else {
        localStorage.removeItem(ACTIVE_SHARD_STORAGE_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  }

  pruneShardRetention(
    apiBaseUrl: string,
    retentionDays?: number,
  ): Observable<{ deletedEvents: number; deletedBufferItems: number; retentionDays: number }> {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    return this.http.post<{ deletedEvents: number; deletedBufferItems: number; retentionDays: number }>(
      `${cleanBase}/shard/retention/prune`,
      retentionDays ? { retentionDays } : {},
    );
  }

  publishShardMetrics(apiBaseUrl: string): Observable<{ published: boolean }> {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    return this.http.post<{ published: boolean }>(`${cleanBase}/shard/metrics/publish`, {});
  }

  getProfiles(): Observable<Profile[]> {
    return this.http.get<Profile[]>(`${this.base}/profiles`);
  }

  registerProfile(dto: { handle: string; displayName: string; avatarIcon?: string }): Observable<Profile> {
    return this.http.post<Profile>(`${this.base}/profiles`, dto);
  }

  getFlows(opts?: { profileId?: string | null; scope?: string }): Observable<Flow[]> {
    let params = new HttpParams();
    if (opts?.profileId) params = params.set('profileId', opts.profileId);
    if (opts?.scope) params = params.set('scope', opts.scope);
    return this.http.get<Flow[]>(`${this.base}/flows`, { params });
  }

  getFlowMetrics(profileId?: string | null): Observable<FlowMetrics> {
    let params = new HttpParams();
    if (profileId) params = params.set('profileId', profileId);
    return this.http.get<FlowMetrics>(`${this.base}/flows/metrics`, { params });
  }

  createFlow(dto: CreateFlowPayload): Observable<Flow> {
    return this.http.post<Flow>(`${this.base}/flows`, dto);
  }

  deleteFlow(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/flows/${id}`);
  }

  updateFlowStatus(id: string, status: FlowStatus): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}/status`, { status });
  }

  updateFlow(id: string, dto: Record<string, unknown>): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}`, dto);
  }

  getFlowSessions(id: string): Observable<FlowSessionRecord[]> {
    return this.http.get<FlowSessionRecord[]>(`${this.base}/flows/${id}/sessions`);
  }

  getFlowEvents(id: string): Observable<FlowEventRecord[]> {
    return this.http.get<FlowEventRecord[]>(`${this.base}/flows/${id}/events`);
  }

  appendFlowEvent(
    id: string,
    dto: { source?: string; eventType: string; payload?: Record<string, unknown> },
  ): Observable<FlowEventRecord> {
    return this.http.post<FlowEventRecord>(`${this.base}/flows/${id}/events`, dto);
  }

  getFolders(opts?: { profileId?: string | null; scope?: string }): Observable<Folder[]> {
    let params = new HttpParams();
    if (opts?.profileId) params = params.set('profileId', opts.profileId);
    if (opts?.scope) params = params.set('scope', opts.scope);
    return this.http.get<Folder[]>(`${this.base}/folders`, { params });
  }

  createFolder(dto: { name: string; parentId?: string | null; profileId?: string | null }): Observable<Folder> {
    return this.http.post<Folder>(`${this.base}/folders`, dto);
  }

  /* Code Tasks Endpoints */
  getCodeRepos(profileId?: string | null): Observable<CodeRepoView[]> {
    let params = new HttpParams();
    if (profileId) params = params.set('profileId', profileId);
    return this.http.get<CodeRepoView[]>(`${this.base}/code-tasks/repos`, { params });
  }

  registerCodeRepo(dto: {
    localPath: string;
    name?: string;
    defaultTags?: string[];
    profileId?: string | null;
  }): Observable<CodeRepoView> {
    return this.http.post<CodeRepoView>(`${this.base}/code-tasks/repos`, dto);
  }

  unregisterCodeRepo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/code-tasks/repos/${id}`);
  }

  syncCodeRepo(id: string): Observable<{ syncedTasks: number; updatedResults: number }> {
    return this.http.post<{ syncedTasks: number; updatedResults: number }>(
      `${this.base}/code-tasks/repos/${id}/sync`,
      {},
    );
  }

  pushCodeResults(id: string, payload: any): Observable<{ processed: number }> {
    return this.http.post<{ processed: number }>(`${this.base}/code-tasks/repos/${id}/results`, payload);
  }
}
