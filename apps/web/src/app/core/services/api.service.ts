import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
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

/** Thin typed wrapper over the NestJS REST API (contracts = flow.models.ts). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

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
