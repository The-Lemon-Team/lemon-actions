import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Flow, FlowMetrics, FlowStatus, Folder } from '../models/flow.models';

/** Thin typed wrapper over the NestJS REST API (contracts = flow.models.ts). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getFlows(): Observable<Flow[]> {
    return this.http.get<Flow[]>(`${this.base}/flows`);
  }

  getFlowMetrics(): Observable<FlowMetrics> {
    return this.http.get<FlowMetrics>(`${this.base}/flows/metrics`);
  }

  updateFlowStatus(id: string, status: FlowStatus): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}/status`, { status });
  }

  getFolders(): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${this.base}/folders`);
  }

  createFolder(dto: { name: string; parentId?: string | null }): Observable<Folder> {
    return this.http.post<Folder>(`${this.base}/folders`, dto);
  }

  updateFlow(id: string, dto: Record<string, unknown>): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}`, dto);
  }
}
