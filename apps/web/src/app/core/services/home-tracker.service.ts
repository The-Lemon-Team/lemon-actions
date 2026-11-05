import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  Flow,
  FlowStatus,
  FlowType,
  Folder,
  HomeWidgetMeta,
  HomeWidgetView,
  RoomTask,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { FlowOrchestratorService } from './flow-orchestrator.service';
import {
  buildHomeWidgetPayload,
  buildHomeWidgetViews,
  extractRoomTasks,
  readWidgetState,
} from './home-tracker.helpers';
import { CreateHomeWidgetInput, HomeActivityItem } from './home-tracker.models';
import { ProfileService } from './profile.service';

export * from './home-tracker.models';

/**
 * Императивно-реактивный сервис приложения «Lemon Home (Трекер ресурсов дома)».
 * Все начальные данные (запасы, рутины и задачи комнат) загружаются из сидов БД через API (`scope = 'home'`).
 */
@Injectable({ providedIn: 'root' })
export class HomeTrackerService {
  readonly scope = 'home';

  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly coreOrchestrator = inject(FlowOrchestratorService);

  private readonly homeFoldersSubject = new BehaviorSubject<Folder[]>([]);
  private readonly homeFlowsSubject = new BehaviorSubject<Flow[]>([]);
  private readonly activitiesSubject = new BehaviorSubject<HomeActivityItem[]>([]);
  private readonly tasksSubject = new BehaviorSubject<RoomTask[]>([]);
  private readonly selectedRoomSubject = new BehaviorSubject<string>('ALL');

  readonly homeFolders$: Observable<Folder[]> = this.homeFoldersSubject.asObservable();
  readonly homeFlows$: Observable<Flow[]> = this.homeFlowsSubject.asObservable();
  readonly activities$: Observable<HomeActivityItem[]> = this.activitiesSubject.asObservable();
  readonly tasks$: Observable<RoomTask[]> = this.tasksSubject.asObservable();
  readonly selectedRoom$: Observable<string> = this.selectedRoomSubject.asObservable();

  get currentRoom(): string {
    return this.selectedRoomSubject.value;
  }

  /** Все домашние виджеты (запасы и рутины), обогащенные доменной мета-информацией. */
  readonly widgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.homeFlows$,
    this.homeFolders$,
  ]).pipe(
    map(([flows, folders]) => buildHomeWidgetViews(flows, folders)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly rooms$: Observable<string[]> = this.widgets$.pipe(
    map((widgets) => {
      const set = new Set<string>();
      widgets.forEach((w) => set.add(w.room));
      return ['ALL', ...Array.from(set)];
    }),
  );

  readonly supplyWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'supply' && (room === 'ALL' || w.room === room)),
    ),
  );

  readonly inStockSupplies$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && w.isInStock)),
  );

  readonly shoppingList$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && !w.isInStock)),
  );

  readonly routineWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'routine' && (room === 'ALL' || w.room === room)),
    ),
  );

  readonly healthStats$ = this.widgets$.pipe(
    map((widgets) => {
      const supplies = widgets.filter((w) => w.kind === 'supply');
      const total = supplies.length;
      let empty = 0;
      let low = 0;
      let healthy = 0;

      supplies.forEach((s) => {
        if (!s.isInStock || s.currentQty === 0) {
          empty++;
        } else if (s.percentage < 20) {
          low++;
        } else {
          healthy++;
        }
      });

      const healthPercent = total > 0 ? Math.round((healthy / total) * 100) : 100;
      return { total, empty, low, healthy, healthPercent };
    }),
  );

  readonly tasksForSelectedRoom$: Observable<RoomTask[]> = combineLatest([
    this.tasks$,
    this.selectedRoom$,
  ]).pipe(
    map(([tasks, room]) => (room === 'ALL' ? tasks : tasks.filter((t) => t.room === room))),
  );

  constructor() {
    this.profileService.activeProfile$.subscribe((profile) => {
      this.selectedRoomSubject.next('ALL');
      this.loadProfileHomeScope(profile.id);
    });
  }

  setRoomFilter(room: string): void {
    this.selectedRoomSubject.next(room);
  }

  consumePortion(flowId: string, customAmount?: number): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const { oldWidget, currentQty, maxQty, step, unit } = readWidgetState(flow, customAmount);

    const newQty = Math.round(Math.max(0, currentQty - step) * 1000) / 1000;
    const willBeDepleted = newQty === 0;
    const nextStatus = willBeDepleted ? FlowStatus.INACTIVE : FlowStatus.ACTIVE;

    const nextWidget: HomeWidgetMeta = { ...oldWidget, currentQty: newQty, maxQty };
    const nextConfig = { ...((flow.config as any) ?? {}), widget: nextWidget };

    this.updateLocalFlow(flowId, { status: nextStatus, config: nextConfig });
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: willBeDepleted ? 'DEPLETED' : 'SPEC_CHANGED',
      note: willBeDepleted
        ? `Списано ${step} ${unit}. Остаток 0 -> запас исчерпан (добавлено в покупки)`
        : `Расход -${step} ${unit}. Остаток: ${newQty} ${unit} из ${maxQty}`,
      icon: willBeDepleted ? 'remove_shopping_cart' : 'remove_circle_outline',
    });

    this.syncFlowMutation(flowId, nextConfig, nextStatus, willBeDepleted ? 'DEPLETED' : 'CONSUMED', {
      consumed: step,
      remaining: newQty,
      unit,
    });
  }

  addPortion(flowId: string, customAmount?: number): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const { oldWidget, currentQty, maxQty, step, unit } = readWidgetState(flow, customAmount);

    const newQty = Math.round((currentQty + step) * 1000) / 1000;
    const adjustedMax = Math.max(maxQty, newQty);
    const wasInactive = flow.status === FlowStatus.INACTIVE || currentQty === 0;

    const nextWidget: HomeWidgetMeta = { ...oldWidget, currentQty: newQty, maxQty: adjustedMax };
    const nextConfig = { ...((flow.config as any) ?? {}), widget: nextWidget };

    this.updateLocalFlow(flowId, { status: FlowStatus.ACTIVE, config: nextConfig });
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: wasInactive
        ? `Пополнено +${step} ${unit} -> мьютекс включен в ACTIVE`
        : `Пополнение запаса: +${step} ${unit}. Всего: ${newQty} ${unit}`,
      icon: 'add_circle',
    });

    this.syncFlowMutation(flowId, nextConfig, FlowStatus.ACTIVE, 'RESTOCKED', {
      added: step,
      total: newQty,
      unit,
      wasInactive,
    });
  }

  maxAllInRoom(roomName: string): void {
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) => {
      const widget = (((f.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
      if (widget.kind === 'supply' && (roomName === 'ALL' || widget.room === roomName)) {
        const maxQty = widget.maxQty ?? (widget.currentQty || 1);
        const nextConfig = {
          ...((f.config as any) ?? {}),
          widget: { ...widget, currentQty: maxQty },
        };
        this.syncFlowMutation(f.id, nextConfig, FlowStatus.ACTIVE, 'RESTOCKED', {
          action: 'max_all',
          currentQty: maxQty,
        });
        return { ...f, status: FlowStatus.ACTIVE, config: nextConfig, updatedAt: now };
      }
      return f;
    });

    this.homeFlowsSubject.next(updated);
    this.pushActivity({
      flowId: `room-${roomName}`,
      flowName: roomName === 'ALL' ? 'Все зоны дома' : roomName,
      eventType: 'RESTOCKED',
      note: `Все ресурсы зоны «${roomName === 'ALL' ? 'Все зоны' : roomName}» пополнены до максимума`,
      icon: 'done_all',
    });
  }

  toggleRoomTask(taskId: string): void {
    const target = this.tasksSubject.value.find((t) => t.id === taskId);
    if (!target) return;
    const nextDone = !target.done;
    this.tasksSubject.next(
      this.tasksSubject.value.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t)),
    );

    const backingFlow = this.homeFlowsSubject.value.find((f) => f.id === taskId);
    if (backingFlow) {
      const nextConfig = {
        ...((backingFlow.config as any) ?? {}),
        homeTask: { ...target, done: nextDone },
      };
      this.api.updateFlow(taskId, { config: nextConfig }).pipe(catchError(() => of(null))).subscribe();
    }
  }

  addRoomTask(room: string, title: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const targetRoom = room === 'ALL' ? 'Кухня' : room;
    const now = new Date().toISOString();
    const newTask: RoomTask = {
      id: `task-${Date.now()}`,
      room: targetRoom,
      title: cleanTitle,
      done: false,
      createdAt: now,
      priority,
    };
    this.tasksSubject.next([newTask, ...this.tasksSubject.value]);

    const taskFolder =
      this.homeFoldersSubject.value.find((f) => f.path === 'home.tasks') ??
      this.homeFoldersSubject.value.find((f) => f.path === 'home');

    this.api
      .createFlow({
        name: cleanTitle,
        description: `Чек-лист комнаты «${targetRoom}»`,
        type: FlowType.MUTEX,
        isExclusive: false,
        folderId: taskFolder?.id ?? null,
        profileId: this.profileService.currentProfileId,
        tags: ['home', 'task'],
        config: { homeTask: newTask },
      })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  deleteRoomTask(taskId: string): void {
    this.tasksSubject.next(this.tasksSubject.value.filter((t) => t.id !== taskId));
    if (!taskId.startsWith('task-')) {
      this.api.deleteFlow(taskId).pipe(catchError(() => of(null))).subscribe();
    }
  }

  markDepleted(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const nextConfig = { ...((flow.config as any) ?? {}), widget: { ...oldWidget, currentQty: 0 } };

    this.updateLocalFlow(flowId, { status: FlowStatus.INACTIVE, config: nextConfig });
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'DEPLETED',
      note: 'Запас исчерпан -> мьютекс снят (добавлено в список покупок)',
      icon: 'remove_shopping_cart',
    });

    this.syncFlowMutation(flowId, nextConfig, FlowStatus.INACTIVE, 'DEPLETED', {
      action: 'moved_to_shopping_list',
      currentQty: 0,
    });
  }

  markRestocked(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const restoredQty = oldWidget.maxQty && oldWidget.maxQty > 0 ? oldWidget.maxQty : 1;
    const nextConfig = {
      ...((flow.config as any) ?? {}),
      widget: { ...oldWidget, currentQty: restoredQty },
    };

    this.updateLocalFlow(flowId, { status: FlowStatus.ACTIVE, config: nextConfig });
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: `Запас пополнен (+${restoredQty} ${oldWidget.unit || 'ед.'}) -> мьютекс наличия активен`,
      icon: 'inventory',
    });

    this.syncFlowMutation(flowId, nextConfig, FlowStatus.ACTIVE, 'RESTOCKED', {
      action: 'restocked_at_home',
      currentQty: restoredQty,
    });
  }

  completeRoutine(flowId: string, note = 'Выполнено по расписанию'): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'ROUTINE_DONE',
      note,
      icon: 'task_alt',
    });

    this.api
      .appendFlowEvent(flowId, {
        source: 'lemon-home-app',
        eventType: 'ROUTINE_DONE',
        payload: { note, completedAt: new Date().toISOString() },
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.coreOrchestrator.refresh());
  }

  createHomeWidget(input: CreateHomeWidgetInput): void {
    const profileId = this.profileService.currentProfileId;
    const payload = buildHomeWidgetPayload(input, profileId, this.homeFoldersSubject.value);

    const now = new Date().toISOString();
    const optimisticFlow: Flow = {
      id: `local-flow-${Date.now()}`,
      name: payload.name,
      description: payload.description,
      type: FlowType.MUTEX,
      status: FlowStatus.ACTIVE,
      isExclusive: false,
      folderId: payload.folderId ?? null,
      profileId,
      tags: (payload.tags ?? []).map((t, i) => ({ id: `tag-${i}`, name: t })),
      config: payload.config,
      orchestratorRules: payload.orchestratorRules,
      createdAt: now,
      updatedAt: now,
    };

    this.homeFlowsSubject.next([...this.homeFlowsSubject.value, optimisticFlow]);
    this.pushActivity({
      flowId: optimisticFlow.id,
      flowName: optimisticFlow.name,
      eventType: 'WIDGET_CREATED',
      note: `Создан виджет (${input.kind === 'routine' ? 'Рутина' : 'Запас дома'}) в комнате «${input.room || 'Дом'}»`,
      icon: 'add_home',
    });

    this.api
      .createFlow(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((created) => {
        if (created) {
          this.api
            .updateFlowStatus(created.id, FlowStatus.ACTIVE)
            .pipe(catchError(() => of(null)))
            .subscribe(() => {
              this.loadProfileHomeScope(profileId);
              this.coreOrchestrator.refresh();
            });
        }
      });
  }

  deleteWidget(flowId: string): void {
    this.homeFlowsSubject.next(this.homeFlowsSubject.value.filter((f) => f.id !== flowId));
    this.api
      .deleteFlow(flowId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.coreOrchestrator.refresh());
  }

  private loadProfileHomeScope(profileId: string): void {
    this.api
      .getFolders({ profileId, scope: this.scope })
      .pipe(catchError(() => of([])))
      .subscribe((folders) => this.homeFoldersSubject.next(folders));

    this.api
      .getFlows({ profileId, scope: this.scope })
      .pipe(catchError(() => of([])))
      .subscribe((flows) => {
        this.homeFlowsSubject.next(flows);
        this.tasksSubject.next(extractRoomTasks(flows));

        if (this.activitiesSubject.value.length === 0 && flows.length > 0) {
          this.activitiesSubject.next([
            {
              id: `act-seed-1`,
              flowId: flows[0].id,
              flowName: flows[0].name,
              eventType: 'RESTOCKED',
              note: 'Загружены стартовые запасы и расписания из БД (home.*)',
              createdAt: new Date().toISOString(),
              icon: 'check_circle',
            },
          ]);
        }
      });
  }

  private updateLocalFlow(flowId: string, patch: Partial<Flow>): void {
    const now = new Date().toISOString();
    this.homeFlowsSubject.next(
      this.homeFlowsSubject.value.map((f) =>
        f.id === flowId ? { ...f, ...patch, updatedAt: now } : f,
      ),
    );
  }

  private syncFlowMutation(
    flowId: string,
    nextConfig: Record<string, unknown>,
    nextStatus: FlowStatus,
    eventType: string,
    payload: Record<string, unknown>,
  ): void {
    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .updateFlowStatus(flowId, nextStatus)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.api
              .appendFlowEvent(flowId, { source: 'lemon-home-app', eventType, payload })
              .pipe(catchError(() => of(null)))
              .subscribe(() => this.coreOrchestrator.refresh());
          });
      });
  }

  private pushActivity(item: Omit<HomeActivityItem, 'id' | 'createdAt'>): void {
    const record: HomeActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.activitiesSubject.next([record, ...this.activitiesSubject.value].slice(0, 25));
  }
}
