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
  CreateFlowPayload,
  Flow,
  FlowStatus,
  FlowType,
  Folder,
  HomeWidgetMeta,
  HomeWidgetView,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { FlowOrchestratorService } from './flow-orchestrator.service';
import { ProfileService } from './profile.service';

export interface HomeActivityItem {
  id: string;
  flowId: string;
  flowName: string;
  eventType: 'RESTOCKED' | 'DEPLETED' | 'ROUTINE_DONE' | 'WIDGET_CREATED';
  note: string;
  createdAt: string;
  icon: string;
}

export interface CreateHomeWidgetInput {
  name: string;
  description?: string;
  kind: 'supply' | 'routine';
  room: string;
  icon: string;
  expectedDays?: number;
  unitHint?: string;
  scheduleDays?: number[];
  scheduleStart?: string;
  scheduleEnd?: string;
}

interface ProfileLocalStore {
  folders: Folder[];
  flows: Flow[];
  activities: HomeActivityItem[];
}

function buildStarterProfileStore(profileId: string, isDacha = false): ProfileLocalStore {
  const now = new Date().toISOString();
  const homeId = `${profileId.slice(0, 24)}-000000000101`;
  const suppliesId = `${profileId.slice(0, 24)}-000000000102`;
  const routinesId = `${profileId.slice(0, 24)}-000000000103`;

  const folders: Folder[] = [
    { id: homeId, name: 'Home', parentId: null, profileId, path: 'home', createdAt: now, updatedAt: now },
    {
      id: suppliesId,
      name: 'Household Supplies',
      parentId: homeId,
      profileId,
      path: 'home.supplies',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: routinesId,
      name: 'Home Routines',
      parentId: homeId,
      profileId,
      path: 'home.routines',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const flows: Flow[] = isDacha
    ? [
        {
          id: `${profileId.slice(0, 24)}-000000000201`,
          name: 'Дрова и уголь для камина',
          description: 'Запас топлива для камина и мангала на даче.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-supplies', name: 'supplies' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'fireplace',
              room: 'Терраса',
              expectedDays: 14,
              unitHint: '2 сетки березовых дров',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000202`,
          name: 'Питьевая вода (19 л)',
          description: 'Бутыли питьевой воды для кулера.',
          type: FlowType.MUTEX,
          status: FlowStatus.INACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'water_drop',
              room: 'Кухня',
              expectedDays: 7,
              unitHint: '2 бутыли по 19 л',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000203`,
          name: 'Полив газона и теплицы',
          description: 'Scheduled Mutex: утреннее и вечернее окно автоматического полива.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: routinesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-routine', name: 'routine' },
          ],
          config: {
            widget: {
              kind: 'routine',
              icon: 'yard',
              room: 'Участок',
              scheduleLabel: 'Ежедневно, 07:00–09:00',
            },
          },
          orchestratorRules: {
            schedule: {
              enabled: true,
              windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '07:00', end: '09:00' }],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [
        {
          id: `${profileId.slice(0, 24)}-000000000201`,
          name: 'Стиральный порошок',
          description: 'Бытовой мьютекс наличия порошка (ACTIVE = есть дома, INACTIVE = пора купить).',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-supplies', name: 'supplies' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'local_laundry_service',
              room: 'Ванная',
              expectedDays: 30,
              unitHint: 'Упаковка 3 кг',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000202`,
          name: 'Хлеб и выпечка',
          description: 'Ежедневный ресурс кухни. Когда мьютекс выключается — автоматически попадает в список покупок.',
          type: FlowType.MUTEX,
          status: FlowStatus.INACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'bakery_dining',
              room: 'Кухня',
              expectedDays: 3,
              unitHint: 'Свежая буханка',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000203`,
          name: 'Запасы кухни: Чай и Кофе',
          description: 'Мьютекс наличия базовых запасов напитков на кухне.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'coffee',
              room: 'Кухня',
              expectedDays: 14,
              unitHint: 'Пачка 250 г',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000204`,
          name: 'Губки и средство для посуды',
          description: 'Расходники для раковины и посудомоечной машины.',
          type: FlowType.MUTEX,
          status: FlowStatus.INACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'soap',
              room: 'Кухня',
              expectedDays: 21,
              unitHint: 'Флакон 500 мл + таблетки',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000205`,
          name: 'Субботняя уборка и полив цветов',
          description: 'Scheduled Mutex: активирует окно домашней рутины по выходным с 10:00 до 14:00, не отсекая историю.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: routinesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-routine', name: 'routine' },
          ],
          config: {
            widget: {
              kind: 'routine',
              icon: 'cleaning_services',
              room: 'Весь дом',
              scheduleLabel: 'Сб–Вс, 10:00–14:00',
            },
          },
          orchestratorRules: {
            schedule: {
              enabled: true,
              windows: [{ days: [6, 0], start: '10:00', end: '14:00' }],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ];

  const activities: HomeActivityItem[] = [
    {
      id: `act-${profileId}-1`,
      flowId: flows[1].id,
      flowName: flows[1].name,
      eventType: 'DEPLETED',
      note: 'Запас закончился -> мьютекс переведен в INACTIVE (добавлено в список покупок)',
      createdAt: now,
      icon: 'shopping_cart_checkout',
    },
    {
      id: `act-${profileId}-2`,
      flowId: flows[0].id,
      flowName: flows[0].name,
      eventType: 'RESTOCKED',
      note: 'Пополнено дома -> открыта новая сессия наличия в flow_sessions',
      createdAt: now,
      icon: 'check_circle',
    },
  ];

  return { folders, flows, activities };
}

/**
 * Императивно-реактивный сервис приложения «Lemon Home (Трекер ресурсов дома)».
 * Работает поверх Core Combinator API строго в пределах `scope = 'home'` текущего профиля (`profileId`).
 */
@Injectable({ providedIn: 'root' })
export class HomeTrackerService {
  readonly scope = 'home';

  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly coreOrchestrator = inject(FlowOrchestratorService);

  private readonly localStores = new Map<string, ProfileLocalStore>();

  private readonly homeFoldersSubject = new BehaviorSubject<Folder[]>([]);
  private readonly homeFlowsSubject = new BehaviorSubject<Flow[]>([]);
  private readonly activitiesSubject = new BehaviorSubject<HomeActivityItem[]>([]);
  private readonly selectedRoomSubject = new BehaviorSubject<string>('ALL');

  readonly homeFolders$: Observable<Folder[]> = this.homeFoldersSubject.asObservable();
  readonly homeFlows$: Observable<Flow[]> = this.homeFlowsSubject.asObservable();
  readonly activities$: Observable<HomeActivityItem[]> = this.activitiesSubject.asObservable();
  readonly selectedRoom$: Observable<string> = this.selectedRoomSubject.asObservable();

  /** Все домашние виджеты, обогащенные доменной мета-информацией. */
  readonly widgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.homeFlows$,
    this.homeFolders$,
  ]).pipe(
    map(([flows, folders]) =>
      flows.map((flow) => {
        const folderPath = folders.find((f) => f.id === flow.folderId)?.path ?? 'home.supplies';
        const rawConfig = (flow.config ?? {}) as { widget?: HomeWidgetMeta };
        const meta: HomeWidgetMeta = rawConfig.widget ?? {};
        const isRoutine =
          meta.kind === 'routine' ||
          folderPath.includes('routines') ||
          Boolean(flow.orchestratorRules?.schedule?.enabled);

        const updatedMs = new Date(flow.updatedAt || flow.createdAt).getTime();
        const daysSinceUpdate = Math.max(0, Math.floor((Date.now() - updatedMs) / (1000 * 60 * 60 * 24)));

        return {
          flow,
          kind: isRoutine ? 'routine' : 'supply',
          icon: meta.icon || (isRoutine ? 'schedule' : 'inventory_2'),
          room: meta.room || (isRoutine ? 'Весь дом' : 'Дом'),
          expectedDays: meta.expectedDays || 14,
          unitHint: meta.unitHint || '1 уп.',
          scheduleLabel: meta.scheduleLabel || this.formatScheduleLabel(flow),
          isInStock: flow.status === FlowStatus.ACTIVE || flow.status === FlowStatus.PROCESSING,
          daysSinceUpdate,
          folderPath,
        } satisfies HomeWidgetView;
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Список уникальных комнат/зон дома для фильтрации. */
  readonly rooms$: Observable<string[]> = this.widgets$.pipe(
    map((widgets) => {
      const set = new Set<string>();
      widgets.forEach((w) => set.add(w.room));
      return ['ALL', ...Array.from(set)];
    }),
  );

  /** Виджеты запасов с учетом фильтра комнаты. */
  readonly supplyWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'supply' && (room === 'ALL' || w.room === room)),
    ),
  );

  /** Ресурсы в наличии дома (мьютекс ACTIVE). */
  readonly inStockSupplies$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && w.isInStock)),
  );

  /** Реактивный список покупок: все ресурсы, чей мьютекс перешел в INACTIVE! */
  readonly shoppingList$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && !w.isInStock)),
  );

  /** Домашние рутины и расписания (Scheduled Mutex). */
  readonly routineWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'routine' && (room === 'ALL' || w.room === room)),
    ),
  );

  constructor() {
    this.profileService.activeProfile$.subscribe((profile) => {
      this.selectedRoomSubject.next('ALL');
      this.loadProfileHomeScope(profile.id, profile.handle === 'dacha');
    });
  }

  setRoomFilter(room: string): void {
    this.selectedRoomSubject.next(room);
  }

  /**
   * Императивное действие: «Закончилось дома (В список покупок)».
   * Переводит мьютекс ресурса в INACTIVE (закрывая сессию наличия) и пишет событие DEPLETED в хронику.
   */
  markDepleted(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    this.applyLocalFlowStatus(flowId, FlowStatus.INACTIVE);
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'DEPLETED',
      note: 'Запас исчерпан -> мьютекс снят (добавлено в список покупок)',
      icon: 'remove_shopping_cart',
    });

    this.api
      .updateFlowStatus(flowId, FlowStatus.INACTIVE)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .appendFlowEvent(flowId, {
            source: 'lemon-home-app',
            eventType: 'DEPLETED',
            payload: { action: 'moved_to_shopping_list' },
          })
          .pipe(catchError(() => of(null)))
          .subscribe(() => this.coreOrchestrator.refresh());
      });
  }

  /**
   * Императивное действие: «Купили / Пополнили запас».
   * Включает мьютекс ресурса в ACTIVE (открывая новую сессию наличия в flow_sessions) и пишет событие RESTOCKED.
   */
  markRestocked(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    this.applyLocalFlowStatus(flowId, FlowStatus.ACTIVE);
    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: 'Запас пополнен -> мьютекс наличия активен',
      icon: 'inventory',
    });

    this.api
      .updateFlowStatus(flowId, FlowStatus.ACTIVE)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .appendFlowEvent(flowId, {
            source: 'lemon-home-app',
            eventType: 'RESTOCKED',
            payload: { action: 'restocked_at_home' },
          })
          .pipe(catchError(() => of(null)))
          .subscribe(() => this.coreOrchestrator.refresh());
      });
  }

  /**
   * Императивное действие: отметить выполнение домашней рутины в рамках Scheduled Mutex.
   * Не прерывает расписание, а добавляет запись в `flow_events` со слепком текущей сессии.
   */
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

  /**
   * Создает новый бытовой виджет (запас или рутину по расписанию) в профиле пользователя
   * внутри контейнера `home.supplies` или `home.routines`.
   */
  createHomeWidget(input: CreateHomeWidgetInput): void {
    const profileId = this.profileService.currentProfileId;
    const folders = this.homeFoldersSubject.value;
    const targetPath = input.kind === 'routine' ? 'home.routines' : 'home.supplies';
    const targetFolder =
      folders.find((f) => f.path === targetPath) ??
      folders.find((f) => f.path === 'home') ??
      folders[0];

    const days = input.scheduleDays?.length ? input.scheduleDays : [6, 0];
    const start = input.scheduleStart || '10:00';
    const end = input.scheduleEnd || '14:00';

    const payload: CreateFlowPayload = {
      name: input.name.trim(),
      description:
        input.description?.trim() ||
        (input.kind === 'routine'
          ? 'Домашняя рутина под управлением Scheduled Mutex.'
          : 'Бытовой мьютекс наличия ресурса в доме.'),
      type: FlowType.MUTEX,
      isExclusive: false,
      folderId: targetFolder?.id ?? null,
      profileId,
      tags: input.kind === 'routine' ? ['home', 'routine', 'schedule'] : ['home', 'supplies', 'mutex'],
      config: {
        widget: {
          kind: input.kind,
          icon: input.icon || (input.kind === 'routine' ? 'cleaning_services' : 'inventory_2'),
          room: input.room.trim() || 'Дом',
          expectedDays: input.expectedDays || 14,
          unitHint: input.unitHint?.trim() || '1 шт.',
          scheduleLabel: input.kind === 'routine' ? `${start}–${end}` : undefined,
        } satisfies HomeWidgetMeta,
      },
      orchestratorRules:
        input.kind === 'routine'
          ? {
              schedule: {
                enabled: true,
                windows: [{ days, start, end }],
              },
            }
          : undefined,
    };

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

    const nextFlows = [...this.homeFlowsSubject.value, optimisticFlow];
    this.homeFlowsSubject.next(nextFlows);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, nextFlows);
    this.pushActivity({
      flowId: optimisticFlow.id,
      flowName: optimisticFlow.name,
      eventType: 'WIDGET_CREATED',
      note: `Создан виджет (${input.kind === 'routine' ? 'Рутина по расписанию' : 'Запас дома'}) в комнате «${input.room || 'Дом'}»`,
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
              this.loadProfileHomeScope(profileId, false);
              this.coreOrchestrator.refresh();
            });
        }
      });
  }

  deleteWidget(flowId: string): void {
    const profileId = this.profileService.currentProfileId;
    const nextFlows = this.homeFlowsSubject.value.filter((f) => f.id !== flowId);
    this.homeFlowsSubject.next(nextFlows);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, nextFlows);

    this.api
      .deleteFlow(flowId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.coreOrchestrator.refresh());
  }

  private loadProfileHomeScope(profileId: string, isDachaFallback: boolean): void {
    const fallbackStore = this.getOrInitLocalStore(profileId, isDachaFallback);

    this.api
      .getFolders({ profileId, scope: this.scope })
      .pipe(catchError(() => of(fallbackStore.folders)))
      .subscribe((folders) => {
        const resolvedFolders = folders.length > 0 ? folders : fallbackStore.folders;
        this.homeFoldersSubject.next(resolvedFolders);
      });

    this.api
      .getFlows({ profileId, scope: this.scope })
      .pipe(catchError(() => of(fallbackStore.flows)))
      .subscribe((flows) => {
        const resolvedFlows = flows.length > 0 ? flows : fallbackStore.flows;
        this.homeFlowsSubject.next(resolvedFlows);
        this.saveToLocalStore(profileId, this.homeFoldersSubject.value, resolvedFlows);
      });

    this.activitiesSubject.next(fallbackStore.activities);
  }

  private getOrInitLocalStore(profileId: string, isDacha = false): ProfileLocalStore {
    let store = this.localStores.get(profileId);
    if (!store) {
      store = buildStarterProfileStore(profileId, isDacha);
      this.localStores.set(profileId, store);
    }
    return store;
  }

  private saveToLocalStore(profileId: string, folders: Folder[], flows: Flow[]): void {
    const existing = this.getOrInitLocalStore(profileId);
    this.localStores.set(profileId, {
      ...existing,
      folders,
      flows,
    });
  }

  private applyLocalFlowStatus(flowId: string, status: FlowStatus): void {
    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);
  }

  private pushActivity(item: Omit<HomeActivityItem, 'id' | 'createdAt'>): void {
    const profileId = this.profileService.currentProfileId;
    const store = this.getOrInitLocalStore(profileId);
    const record: HomeActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...store.activities].slice(0, 25);
    store.activities = next;
    this.activitiesSubject.next(next);
  }

  private formatScheduleLabel(flow: Flow): string {
    const win = flow.orchestratorRules?.schedule?.windows?.[0];
    if (!win) return 'По расписанию';
    return `${win.start}–${win.end}`;
  }
}
