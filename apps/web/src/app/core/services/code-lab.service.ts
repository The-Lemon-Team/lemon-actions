import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import {
  CodeRepoView,
  CodeTaskMeta,
  CodeTaskView,
  Flow,
  FlowStatus,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { ProfileService } from './profile.service';

export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'PASSED' | 'FAILED' | 'STUB';

@Injectable({ providedIn: 'root' })
export class CodeLabService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);

  private readonly reposSubject = new BehaviorSubject<CodeRepoView[]>([]);
  private readonly flowsSubject = new BehaviorSubject<Flow[]>([]);
  private readonly selectedTagSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedRepoIdSubject = new BehaviorSubject<string | null>(null);
  private readonly statusFilterSubject = new BehaviorSubject<TaskStatusFilter>('ALL');

  readonly repos$: Observable<CodeRepoView[]> = this.reposSubject.asObservable();
  readonly selectedTag$: Observable<string | null> = this.selectedTagSubject.asObservable();
  readonly selectedRepoId$: Observable<string | null> = this.selectedRepoIdSubject.asObservable();
  readonly statusFilter$: Observable<TaskStatusFilter> = this.statusFilterSubject.asObservable();

  /** Все задачи по программированию с извлеченными метаданными */
  readonly allTasks$: Observable<CodeTaskView[]> = combineLatest([
    this.flowsSubject,
    this.reposSubject,
  ]).pipe(
    map(([flows, repos]) => {
      const repoMap = new Map<string, string>();
      for (const r of repos) {
        repoMap.set(r.folderId, r.name);
      }

      return flows.map((f) => {
        const meta = ((f.config as any)?.codeTask ?? {
          id: f.id,
          slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'NEW',
        }) as CodeTaskMeta;

        const tags = Array.isArray(f.tags) ? f.tags.map((t: any) => t.tag?.name ?? t) : [];
        const isActive = f.status === FlowStatus.ACTIVE || f.status === FlowStatus.PROCESSING;
        const isPassed = meta.status === 'PASSED';
        const isFailed = meta.status === 'FAILED';
        const isStub = meta.status === 'STUB' || meta.status === 'NEW' || (meta.testsTotal === 0);

        return {
          flow: f,
          meta,
          tags,
          isActive,
          isPassed,
          isFailed,
          isStub,
          repoName: f.folderId ? repoMap.get(f.folderId) : undefined,
        } satisfies CodeTaskView;
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Отфильтрованный список задач */
  readonly filteredTasks$: Observable<CodeTaskView[]> = combineLatest([
    this.allTasks$,
    this.selectedTag$,
    this.selectedRepoId$,
    this.statusFilter$,
  ]).pipe(
    map(([tasks, tag, repoId, statusFilter]) => {
      return tasks.filter((task) => {
        if (repoId && task.flow.folderId !== repoId && task.meta.repoId !== repoId) {
          return false;
        }

        if (tag && !task.tags.includes(tag)) {
          return false;
        }

        if (statusFilter === 'ACTIVE') return task.isActive;
        if (statusFilter === 'PASSED') return task.isPassed;
        if (statusFilter === 'FAILED') return task.isFailed;
        if (statusFilter === 'STUB') return task.isStub;

        return true;
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Задача в фокусе (активный Mutex сессии) */
  readonly activeTask$: Observable<CodeTaskView | null> = this.allTasks$.pipe(
    map((tasks) => tasks.find((t) => t.isActive) ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Все доступные теги с количеством задач */
  readonly tagCloud$: Observable<Array<{ name: string; count: number }>> = this.allTasks$.pipe(
    map((tasks) => {
      const counts = new Map<string, number>();
      for (const t of tasks) {
        for (const tag of t.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Сводные KPI метрики */
  readonly metrics$ = this.allTasks$.pipe(
    map((tasks) => {
      const total = tasks.length;
      const active = tasks.filter((t) => t.isActive).length;
      const passed = tasks.filter((t) => t.isPassed).length;
      const failed = tasks.filter((t) => t.isFailed).length;
      const stub = tasks.filter((t) => t.isStub).length;
      return { total, active, passed, failed, stub };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.profileService.activeProfileId$
      .pipe(
        switchMap((profileId) => this.refreshAll(profileId)),
      )
      .subscribe();
  }

  refreshAll(profileId?: string): Observable<unknown> {
    const pId = profileId ?? this.profileService.currentProfileId;

    return combineLatest([
      this.api.getCodeRepos(pId).pipe(catchError(() => of([]))),
      this.api.getFlows({ profileId: pId, scope: 'code' }).pipe(catchError(() => of([]))),
    ]).pipe(
      tap(([repos, flows]) => {
        this.reposSubject.next(repos);
        this.flowsSubject.next(flows);
      }),
    );
  }

  selectTag(tag: string | null): void {
    const current = this.selectedTagSubject.value;
    this.selectedTagSubject.next(current === tag ? null : tag);
  }

  selectRepo(repoId: string | null): void {
    const current = this.selectedRepoIdSubject.value;
    this.selectedRepoIdSubject.next(current === repoId ? null : repoId);
  }

  setStatusFilter(filter: TaskStatusFilter): void {
    this.statusFilterSubject.next(filter);
  }

  /**
   * Начать решение задачи: переводит Mutex в ACTIVE и открывает сессию в flow_sessions
   */
  startTask(flowId: string): void {
    this.api.updateFlowStatus(flowId, FlowStatus.ACTIVE).subscribe({
      next: (updatedFlow) => {
        this.updateLocalFlow(updatedFlow);
        this.api
          .appendFlowEvent(flowId, {
            source: 'lemon-code-lab',
            eventType: 'SESSION_STARTED',
            payload: {
              action: 'focus_started',
              note: 'Разработчик взял задачу в работу (Mutex ACTIVE, сессия открыта)',
            },
          })
          .subscribe();
      },
    });
  }

  /**
   * Приостановить выполнение задачи: закрывает сессию
   */
  pauseTask(flowId: string): void {
    this.api.updateFlowStatus(flowId, FlowStatus.INACTIVE).subscribe({
      next: (updatedFlow) => {
        this.updateLocalFlow(updatedFlow);
        this.api
          .appendFlowEvent(flowId, {
            source: 'lemon-code-lab',
            eventType: 'SESSION_PAUSED',
            payload: {
              action: 'focus_paused',
              note: 'Сессия работы над задачей приостановлена',
            },
          })
          .subscribe();
      },
    });
  }

  /**
   * Принудительная синхронизация тестов и спецификаций репозитория
   */
  syncRepo(repoId: string): void {
    this.api.syncCodeRepo(repoId).subscribe({
      next: () => this.refreshAll().subscribe(),
      error: () => this.refreshAll().subscribe(),
    });
  }

  /**
   * Подключение новой папки с задачами через Менеджер
   */
  registerRepo(dto: {
    localPath: string;
    name?: string;
    defaultTags?: string[];
  }): Observable<CodeRepoView> {
    return this.api
      .registerCodeRepo({
        ...dto,
        profileId: this.profileService.currentProfileId,
      })
      .pipe(
        tap(() => this.refreshAll().subscribe()),
      );
  }

  /**
   * Отключение репозитория
   */
  unregisterRepo(repoId: string): void {
    this.api.unregisterCodeRepo(repoId).subscribe({
      next: () => this.refreshAll().subscribe(),
    });
  }

  getTaskEvents(flowId: string) {
    return this.api.getFlowEvents(flowId);
  }

  private updateLocalFlow(updated: Flow): void {
    const flows = this.flowsSubject.value.map((f) => (f.id === updated.id ? updated : f));
    this.flowsSubject.next(flows);
  }
}
