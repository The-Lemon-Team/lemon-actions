import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  OperatorFunction,
  Subject,
  catchError,
  EMPTY,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { ApiService } from './api.service';
import { ProfileService } from './profile.service';
import { I18nService } from '../i18n/i18n.service';
import {
  CreateFlowPayload,
  Flow,
  FlowMetrics,
  FlowRowState,
  FlowStatus,
  Folder,
  FolderNode,
  TagWithCount,
} from '../models/flow.models';
import { buildFolderTree, isInSubtree } from '../utils/folder-tree';

const isExecuting = (s: FlowStatus) => s === FlowStatus.ACTIVE || s === FlowStatus.PROCESSING;

/**
 * Single source of truth for the UI, backed by the NestJS REST API. Exposes only
 * streams: components never hold monolithic state and never subscribe manually.
 */
@Injectable({ providedIn: 'root' })
export class FlowOrchestratorService {
  private readonly flowsSubject = new BehaviorSubject<Flow[]>([]);
  private readonly foldersSubject = new BehaviorSubject<Folder[]>([]);
  private readonly expandedIds = new BehaviorSubject<ReadonlySet<string>>(new Set<string>());
  private readonly selectedFolderId = new BehaviorSubject<string | null>(null);
  private readonly selectedTagName = new BehaviorSubject<string | null>(null);
  private readonly searchTerm = new BehaviorSubject<string>('');

  /** Mutex-style lock: true while a global exclusive flow is holding the system. */
  readonly mutexLocked$ = new BehaviorSubject<boolean>(false);

  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly i18n = inject(I18nService);
  private readonly errorSubject = new Subject<string>();

  /** User-facing API errors (e.g. 409 mutex conflicts). */
  readonly errors$: Observable<string> = this.errorSubject.asObservable();

  /** Row states are cached by flow id so unchanged rows keep their identity/streams. */
  private readonly rowCache = new Map<string, FlowRowState>();

  readonly flows$: Observable<Flow[]> = this.flowsSubject.asObservable();
  readonly folders$: Observable<Folder[]> = this.foldersSubject.asObservable();
  readonly search$ = this.searchTerm.asObservable();
  readonly selectedFolderId$ = this.selectedFolderId.asObservable();

  /** Flows currently holding an exclusive mutex lock. */
  readonly activeLocks$: Observable<Flow[]> = this.flows$.pipe(
    map((flows) => flows.filter((f) => f.isExclusive && isExecuting(f.status))),
  );

  readonly folderTree$: Observable<FolderNode[]> = combineLatest([
    this.folders$,
    this.flows$,
    this.expandedIds,
    this.selectedFolderId,
  ]).pipe(
    map(([folders, flows, expandedIds, selectedId]) =>
      buildFolderTree(folders, {
        expandedIds,
        selectedId,
        flowCountForPath: (path) =>
          flows.filter((f) => {
            const fp = folders.find((x) => x.id === f.folderId)?.path;
            return !!fp && isInSubtree(fp, path);
          }).length,
        hasActiveFlowForPath: (path) =>
          flows.some((f) => {
            const fp = folders.find((x) => x.id === f.folderId)?.path;
            return !!fp && isInSubtree(fp, path) && isExecuting(f.status);
          }),
      }),
    ),
  );

  readonly tags$: Observable<TagWithCount[]> = combineLatest([this.flows$, this.selectedTagName]).pipe(
    map(([flows, selected]) => {
      const counts = new Map<string, TagWithCount>();
      for (const flow of flows) {
        for (const t of flow.tags) {
          const entry = counts.get(t.name) ?? { ...t, flowCount: 0, isSelected: t.name === selected };
          entry.flowCount++;
          counts.set(t.name, entry);
        }
      }
      return [...counts.values()].sort((a, b) => b.flowCount - a.flowCount || a.name.localeCompare(b.name));
    }),
  );

  /** Breadcrumb trail (folder names from root to selected folder). */
  readonly breadcrumbs$: Observable<Folder[]> = combineLatest([this.folders$, this.selectedFolderId]).pipe(
    map(([folders, selectedId]) => {
      const selected = folders.find((f) => f.id === selectedId);
      if (!selected) return [];
      const segments = selected.path.split('.');
      return segments
        .map((_, i) => segments.slice(0, i + 1).join('.'))
        .map((p) => folders.find((f) => f.path === p))
        .filter((f): f is Folder => !!f);
    }),
  );

  readonly metrics$: Observable<FlowMetrics> = this.flows$.pipe(
    map((flows) => ({
      registered: flows.length,
      executing: flows.filter((f) => isExecuting(f.status)).length,
      paused: flows.filter((f) => f.status === FlowStatus.PAUSED).length,
      standby: flows.filter((f) => f.status === FlowStatus.INACTIVE).length,
    })),
  );

  readonly activeFlowsCount$: Observable<number> = this.metrics$.pipe(map((m) => m.executing));

  /** Visible rows: each row exposes its own isolated observables. */
  readonly rows$: Observable<FlowRowState[]> = combineLatest([
    this.flows$,
    this.folders$,
    this.selectedFolderId,
    this.selectedTagName,
    this.searchTerm,
  ]).pipe(
    map(([flows, folders, folderId, tagName, term]) => {
      const folderPath = folders.find((f) => f.id === folderId)?.path ?? null;
      const q = term.trim().toLowerCase();
      return flows
        .filter((f) => {
          if (folderPath) {
            const fp = folders.find((x) => x.id === f.folderId)?.path;
            if (!fp || !isInSubtree(fp, folderPath)) return false;
          }
          if (tagName && !f.tags.some((t) => t.name === tagName)) return false;
          if (!q) return true;
          return (
            f.name.toLowerCase().includes(q) ||
            f.type.toLowerCase().includes(q) ||
            f.tags.some((t) => t.name.toLowerCase().includes(q))
          );
        })
        .map((f) => this.rowFor(f));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly totalFlowsCount$: Observable<number> = this.flows$.pipe(map((f) => f.length));

  /* ------------------------------ commands ------------------------------ */

  /** (Re)loads flows and folders from the API for the active profile. */
  refresh(): void {
    const profileId = this.profileService.currentProfileId;
    this.api
      .getFolders({ profileId })
      .pipe(this.reportError('Failed to load folders'))
      .subscribe((folders) => this.foldersSubject.next(folders));
    this.api
      .getFlows({ profileId })
      .pipe(this.reportError('Failed to load flows'))
      .subscribe((flows) => {
        this.flowsSubject.next(flows);
        this.syncMutexLock(flows);
      });
  }

  setStatus(id: string, status: FlowStatus): void {
    this.api
      .updateFlowStatus(id, status)
      .pipe(this.reportError('Could not change flow status'))
      .subscribe(() => this.refresh()); // server may also pause other exclusive flows
  }

  toggleFlow(id: string): void {
    const flow = this.flowsSubject.value.find((f) => f.id === id);
    if (!flow) return;
    this.setStatus(id, isExecuting(flow.status) ? FlowStatus.PAUSED : FlowStatus.ACTIVE);
  }

  triggerFsmTransition(flowId: string, eventName: string, targetState: string): void {
    const current = this.flowsSubject.value.find((f) => f.id === flowId);
    if (!current) return;

    const nextConfig = {
      ...(current.config ?? {}),
      currentState: targetState,
    };

    let nextStatus = current.status;
    if (targetState === 'idle' || targetState === 'draft') {
      nextStatus = FlowStatus.INACTIVE;
    } else if (targetState.includes('break') || targetState.includes('pause')) {
      nextStatus = FlowStatus.PAUSED;
    } else {
      nextStatus = FlowStatus.ACTIVE;
    }

    // Optimistic update so UI responds instantly
    const updatedFlows = this.flowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, config: nextConfig, status: nextStatus, updatedAt: new Date().toISOString() } : f,
    );
    this.flowsSubject.next(updatedFlows);
    this.syncMutexLock(updatedFlows);

    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(this.reportError(this.i18n.t('errors.fsmUpdateFailed')))
      .subscribe({
        next: () => {
          this.api
            .updateFlowStatus(flowId, nextStatus)
            .pipe(this.reportError(this.i18n.t('errors.statusUpdateFailed')))
            .subscribe(() => this.refresh());
        },
      });
  }

  createFolder(name: string, parentId?: string | null): void {
    if (!name.trim()) return;
    this.api
      .createFolder({ name: name.trim(), parentId: parentId || null })
      .pipe(this.reportError(this.i18n.t('errors.folderCreateFailed')))
      .subscribe(() => this.refresh());
  }

  createFlow(dto: CreateFlowPayload): Observable<Flow> {
    return this.api.createFlow(dto).pipe(
      this.reportError(this.i18n.t('errors.createFlowFailed')),
      tap(() => this.refresh()),
    );
  }

  deleteFlow(id: string): void {
    this.api
      .deleteFlow(id)
      .pipe(this.reportError(this.i18n.t('errors.deleteFlowFailed')))
      .subscribe(() => this.refresh());
  }

  setSearch(term: string): void {
    this.searchTerm.next(term);
  }

  selectFolder(id: string | null): void {
    this.selectedFolderId.next(this.selectedFolderId.value === id ? null : id);
  }

  toggleFolder(id: string): void {
    const next = new Set(this.expandedIds.value);
    next.has(id) ? next.delete(id) : next.add(id);
    this.expandedIds.next(next);
  }

  selectTag(name: string): void {
    this.selectedTagName.next(this.selectedTagName.value === name ? null : name);
  }

  saveFlowRules(
    flowId: string,
    isExclusive: boolean,
    orchestratorRules: Record<string, unknown>,
  ): void {
    const updated = this.flowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, isExclusive, orchestratorRules } : f,
    );
    this.flowsSubject.next(updated);
    this.syncMutexLock(updated);

    this.api
      .updateFlow(flowId, { isExclusive, orchestratorRules })
      .pipe(this.reportError('Failed to update flow rules'))
      .subscribe(() => this.refresh());
  }

  getFlowSessions(flowId: string) {
    return this.api.getFlowSessions(flowId);
  }

  getFlowEvents(flowId: string) {
    return this.api.getFlowEvents(flowId);
  }

  appendFlowEvent(
    flowId: string,
    dto: { source?: string; eventType: string; payload?: Record<string, unknown> },
  ) {
    return this.api.appendFlowEvent(flowId, dto).pipe(
      this.reportError('Failed to append flow event'),
      tap(() => this.refresh()),
    );
  }

  /* ------------------------------ internals ------------------------------ */

  constructor() {
    this.profileService.activeProfile$.subscribe(() => {
      this.selectedFolderId.next(null);
      this.refresh();
    });
  }

  private syncMutexLock(flows: Flow[]): void {
    this.mutexLocked$.next(flows.some((f) => f.isExclusive && isExecuting(f.status)));
  }

  private reportError<T>(fallback: string): OperatorFunction<T, T> {
    return catchError((err: unknown) => {
      const apiMessage = (err as { error?: { message?: string | string[] } })?.error?.message;
      this.errorSubject.next(Array.isArray(apiMessage) ? apiMessage.join(', ') : (apiMessage ?? fallback));
      return EMPTY;
    });
  }

  private rowFor(flow: Flow): FlowRowState {
    const cached = this.rowCache.get(flow.id);
    if (cached) return cached;

    const flow$ = this.flows$.pipe(
      map((flows) => flows.find((f) => f.id === flow.id) ?? flow),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    const status$ = flow$.pipe(
      map((f) => f.status),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    const isActive$ = status$.pipe(map(isExecuting), distinctUntilChanged());
    // Seconds spent in the current active session; resets when the flow stops.
    const currentDuration$ = isActive$.pipe(
      switchMap((active) => (active ? timer(0, 1000) : of(0))),
    );

    const row: FlowRowState = { flow, flow$, status$, isActive$, currentDuration$ };
    this.rowCache.set(flow.id, row);
    return row;
  }
}
