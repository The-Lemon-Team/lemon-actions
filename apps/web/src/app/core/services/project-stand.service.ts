import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ProjectStand,
  StandAppItem,
  StandAppStatus,
} from '../models/project-stand.models';
import { AppEnvironment, AppNetworkMode } from '../models/health-checker.models';
import { LemonCardColor } from '../models/worker.models';
import { ProjectSessionLogEntry } from '../models/chronicle-card.models';
import { ReactiveTodoItem, ReactiveTriggerType } from '../models/todo-card.models';
import { LemonChronicleService } from './lemon-chronicle.service';
import { ServiceHealthService } from './service-health.service';
import { LemonWorkerService } from './lemon-worker.service';

const STANDS_STORAGE_KEY = 'lemon_actions_project_stands_v1';

const INITIAL_PROJECT_STANDS: ProjectStand[] = [
  // 1. LEMON SEASONS
  {
    id: 'stand-lemon-seasons',
    name: 'Lemon Seasons',
    slug: 'lemon-seasons',
    description: 'Экосистема календарей, CMS-администрирования и агрегации контентных фидов',
    color: 'amber',
    isPinned: true,
    neuronPath: 'workspace.seasons',
    tags: ['CALENDAR', 'CMS', 'BACKEND', 'FEED', 'v2.1'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [
      {
        id: 'app-seasons-cal',
        appName: 'Calendar - app',
        role: 'Интерактивный календарный интерфейс',
        port: 5173,
        url: 'http://localhost:5173/health',
        instanceId: 'inst-sea-01',
        leaseToken: 'tok-sea-cal-8f12',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 16,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'calendar_month',
      },
      {
        id: 'app-seasons-cms',
        appName: 'Admin - cms',
        role: 'Панель управления контентом и сезонами',
        port: 3002,
        url: 'http://localhost:3002/health',
        instanceId: 'inst-sea-02',
        leaseToken: 'tok-sea-cms-4b33',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 22,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'admin_panel_settings',
      },
      {
        id: 'app-seasons-backend',
        appName: 'Lemon-seasons backend',
        role: 'REST API, сессионная база и сервисы синхронизации',
        port: 3001,
        url: 'http://localhost:3001/api/health',
        instanceId: 'inst-sea-03',
        leaseToken: 'tok-sea-api-91a0',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 14,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'dns',
      },
      {
        id: 'app-seasons-feed',
        appName: 'Feed-app',
        role: 'Фоновый микросервис доставки ленты событий',
        port: 8081,
        url: 'http://localhost:8081/health',
        instanceId: 'inst-sea-04',
        leaseToken: 'tok-sea-feed-31dd',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 38,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'rss_feed',
      },
    ],
    chronicle: [
      {
        id: 'log-sea-1',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        type: 'DEPLOY',
        author: 'Developer',
        title: 'Инициализирован стенд Lemon Seasons с 4 микросервисами',
        details: 'Связаны Calendar (:5173), Admin CMS (:3002), Backend (:3001) и Feed (:8081)',
        latencyMs: 32,
        badge: 'STAND_INIT',
      },
      {
        id: 'log-sea-2',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: 'MILESTONE',
        author: 'Agent-Antigravity',
        title: 'Контракты календаря и CMS синхронизированы',
        details: 'API endpoints проверены на совместимость DTO',
        latencyMs: 18,
        badge: 'CONTRACTS_OK',
      },
    ],
    todos: [
      {
        id: 'todo-sea-1',
        text: 'Проверить готовность Lemon-seasons backend на :3001',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        completedBy: 'Developer',
        isReactive: false,
      },
      {
        id: 'todo-sea-2',
        text: 'Зарегистрировать Calendar - app в Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Port Shield Engine',
        isReactive: true,
        triggerType: 'SERVICE_REGISTERED',
        triggerDescription: 'Срабатывает при регистрации Calendar app',
      },
      {
        id: 'todo-sea-3',
        text: 'Опросить здоровье сервисов стенда Lemon Seasons',
        completed: false,
        isReactive: true,
        triggerType: 'HEALTHCHECK_PING',
        triggerDescription: 'Срабатывает при раунде пинга стенда',
      },
      {
        id: 'todo-sea-4',
        text: 'Проверить синхронизацию ленты Feed-app',
        completed: false,
        isReactive: false,
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 2. LEMON ACTIONS
  {
    id: 'stand-lemon-actions',
    name: 'Lemon Actions',
    slug: 'lemon-actions',
    description: 'Реактивный комбинатор потоков, координация агентов, Port Shield и вотчеры',
    color: 'lemon',
    isPinned: true,
    neuronPath: 'workspace.actions',
    tags: ['CORE_COMBINATOR', 'ACTIONS', 'PORT_SHIELD', 'WATCHERS'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [
      {
        id: 'app-act-core',
        appName: 'Core combinator',
        role: 'Ядро реактивных потоков и база данных PostgreSQL',
        port: 5433,
        url: 'http://localhost:5433/health',
        instanceId: 'inst-act-01',
        leaseToken: 'tok-act-core-77cc',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 12,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'hub',
      },
      {
        id: 'app-act-web',
        appName: 'Lemon actions',
        role: 'Пользовательский интерфейс, карточки Keep и доски',
        port: 4201,
        url: 'http://localhost:4201/health',
        instanceId: 'inst-act-02',
        leaseToken: 'tok-act-web-11bb',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 14,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'style',
      },
      {
        id: 'app-act-shield',
        appName: 'Port Shield',
        role: 'Центральный регистратор портов 4301+, токены аренды и Circuit Breaker',
        port: 3000,
        url: 'http://localhost:3000/api/health',
        instanceId: 'inst-act-03',
        leaseToken: 'tok-act-shield-99aa',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 15,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'verified_user',
      },
      {
        id: 'app-act-watchers',
        appName: 'Lemon Watchers',
        role: 'Монитор файловых импульсов и триггеры событий',
        port: 4301,
        url: 'http://localhost:4301/health',
        instanceId: 'inst-act-04',
        leaseToken: 'tok-act-watchers-44ee',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 18,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'visibility',
      },
    ],
    chronicle: [
      {
        id: 'log-act-1',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        type: 'DEPLOY',
        author: 'Agent-Antigravity',
        title: 'Развёрнут Port Shield (порты 4301+) и реактивная шина импульсов',
        details: 'Изолированы порты и закреплены корневые якоря инфраструктуры',
        latencyMs: 24,
        badge: 'SHIELD_LIVE',
      },
      {
        id: 'log-act-2',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        type: 'MILESTONE',
        author: 'Developer',
        title: 'Интегрированы карточки Google Keep и стенды проектов',
        details: 'Объединены здоровье сервисов, история изменений и реактивные задачи',
        latencyMs: 16,
        badge: 'KEEP_STANDS',
      },
    ],
    todos: [
      {
        id: 'todo-act-1',
        text: 'Зарегистрировать Lemon Watchers в Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Port Shield Live Event',
        isReactive: true,
        triggerType: 'SERVICE_REGISTERED',
        triggerDescription: 'Срабатывает при выделении порта :4301',
      },
      {
        id: 'todo-act-2',
        text: 'Выполнить рабочий цикл воркера в Lemon Actions',
        completed: false,
        isReactive: true,
        triggerType: 'WORKER_TRIGGERED',
        triggerDescription: 'Срабатывает при запуске любого воркера',
      },
      {
        id: 'todo-act-3',
        text: 'Провести опрос здоровья Core combinator и Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        completedBy: 'Health Projection',
        isReactive: true,
        triggerType: 'HEALTHCHECK_PING',
        triggerDescription: 'Срабатывает при пинге',
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 3. SPORTDROP
  {
    id: 'stand-sportdrop',
    name: 'Sportdrop',
    slug: 'sportdrop',
    description: 'Спортивная медиа-платформа: сетевые шлюзы, стриминг и туннели Tailscale',
    color: 'sky',
    isPinned: true,
    neuronPath: 'workspace.sportdrop',
    tags: ['TAILSCALE', 'MEDIA_GATEWAY', 'FUNNEL', 'MESH'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [
      {
        id: 'app-sd-dev',
        appName: 'Dev env',
        role: 'Локальное окружение разработки и тестирования API',
        port: 4310,
        url: 'http://localhost:4310/health',
        instanceId: 'inst-sd-01',
        leaseToken: 'tok-sd-dev-66aa',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 15,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'terminal',
      },
      {
        id: 'app-sd-lan',
        appName: 'Lan port',
        role: 'Защищённый узел сети Tailscale LAN для внутренних сервисов',
        port: 4311,
        url: 'http://100.64.0.15:4311/health',
        instanceId: 'inst-sd-02',
        leaseToken: 'tok-sd-lan-77bb',
        environment: 'staging',
        networkMode: 'tailscale-lan',
        status: 'HEALTHY',
        lastLatencyMs: 28,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'lan',
      },
      {
        id: 'app-sd-media',
        appName: 'Media gateway port',
        role: 'Медиа-шлюз для трансляции видеопотоков и статики',
        port: 4312,
        url: 'http://100.64.0.18:4312/health',
        instanceId: 'inst-sd-03',
        leaseToken: 'tok-sd-media-88cc',
        environment: 'staging',
        networkMode: 'tailscale-lan',
        status: 'HEALTHY',
        lastLatencyMs: 34,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'video_library',
      },
      {
        id: 'app-sd-funnel',
        appName: 'Funnel tunnel',
        role: 'Публичный туннель Tailscale Funnel для мобильных клиентов',
        port: 443,
        url: 'https://sportdrop-funnel.ts.net/health',
        instanceId: 'inst-sd-04',
        leaseToken: 'tok-sd-funnel-99dd',
        environment: 'production',
        networkMode: 'tailscale-funnel',
        status: 'HEALTHY',
        lastLatencyMs: 46,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'public',
      },
      {
        id: 'app-sd-prod',
        appName: 'Prod port',
        role: 'Основной продуктовый порт с SSL/TLS терминацией',
        port: 8443,
        url: 'https://sportdrop-prod.ts.net/health',
        instanceId: 'inst-sd-05',
        leaseToken: 'tok-sd-prod-10ee',
        environment: 'production',
        networkMode: 'tailscale-funnel',
        status: 'HEALTHY',
        lastLatencyMs: 52,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'cloud_done',
      },
    ],
    chronicle: [
      {
        id: 'log-sd-1',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        type: 'DEPLOY',
        author: 'NetworkAdmin',
        title: 'Сконфигурированы сетевые маршруты Tailscale LAN и Funnel',
        details: 'Окружения DEV, STAGING и PROD распределены по защищённой сети',
        latencyMs: 48,
        badge: 'TAILSCALE_INIT',
      },
      {
        id: 'log-sd-2',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: 'MILESTONE',
        author: 'Developer',
        title: 'Media gateway port подключён к защищённой сети 100.64.0.18',
        details: 'Тестовый стрим спортивного хайлайта прошёл без потерь кадров',
        latencyMs: 34,
        badge: 'MEDIA_STREAM_OK',
      },
    ],
    todos: [
      {
        id: 'todo-sd-1',
        text: 'Запустить проверку туннеля Funnel tunnel',
        completed: false,
        isReactive: true,
        triggerType: 'HEALTHCHECK_PING',
        triggerDescription: 'Срабатывает при опросе здоровья стенда',
      },
      {
        id: 'todo-sd-2',
        text: 'Зарегистрировать Media gateway port в Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Port Shield Engine',
        isReactive: true,
        triggerType: 'SERVICE_REGISTERED',
        triggerDescription: 'Срабатывает при регистрации медиа-шлюза',
      },
      {
        id: 'todo-sd-3',
        text: 'Проверить стриминг через Lan port',
        completed: false,
        isReactive: false,
      },
      {
        id: 'todo-sd-4',
        text: 'Валидировать HTTPS сертификат на Prod port',
        completed: false,
        isReactive: false,
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

@Injectable({ providedIn: 'root' })
export class ProjectStandService {
  private readonly http = inject(HttpClient);
  private readonly chronicleService = inject(LemonChronicleService);
  private readonly healthService = inject(ServiceHealthService);
  private readonly workerService = inject(LemonWorkerService);

  private readonly stands$ = new BehaviorSubject<ProjectStand[]>(this.loadStands());

  readonly allStands$: Observable<ProjectStand[]> = this.stands$.asObservable();

  private nextDynamicPort = 4320;

  constructor() {
    this.bindReactiveListeners();
    this.fetchFromBackend();
  }

  fetchFromBackend(): void {
    this.http.get<any[]>('/api/projectarium/projects').subscribe({
      next: (projects) => {
        if (projects && Array.isArray(projects) && projects.length > 0) {
          const current = this.stands$.getValue();
          const merged: ProjectStand[] = projects.map((p) => {
            const existing = current.find((c) => c.slug === p.slug || c.id === p.id);
            return {
              id: p.id,
              name: p.name,
              slug: p.slug,
              projectToken: p.projectToken,
              description: p.context?.description || existing?.description || `Пространство проекта ${p.name}`,
              color: existing?.color || (p.slug === 'seasons' ? 'amber' : p.slug === 'actions' ? 'lemon' : 'sky'),
              isPinned: existing?.isPinned ?? true,
              neuronPath: p.neuronWorkspace || `workspace.${p.slug}`,
              tags: existing?.tags || [p.slug.toUpperCase(), 'STAND'],
              environments: existing?.environments || ['dev', 'staging', 'production'],
              activeEnvironment: existing?.activeEnvironment || 'ALL',
              apps: p.apps.map((a: any) => ({
                id: a.id,
                appName: a.appName,
                role: existing?.apps.find((ea) => ea.appName === a.appName)?.role || 'Сервис стенда',
                port: a.port,
                url: a.healthUrl || `http://localhost:${a.port}`,
                instanceId: a.instanceId,
                leaseToken: a.leaseToken,
                environment: a.environment || 'dev',
                networkMode: a.networkMode || 'local',
                status: a.status === 'ONLINE' ? 'HEALTHY' : (a.status as StandAppStatus),
                lastLatencyMs: a.pingLatencyMs || 12,
                lastCheckedAt: a.lastPingAt || new Date().toISOString(),
                consecutiveFailures: a.consecutiveFailures || 0,
                icon: existing?.apps.find((ea) => ea.appName === a.appName)?.icon || 'terminal',
              })),
              todos: p.todos.map((t: any) => ({
                id: t.id,
                text: t.title,
                completed: t.completed,
                completedAt: t.completedAt,
                completedBy: t.author,
                isReactive: false,
                scope: t.scope || 'PROJECT',
                targetAppName: t.targetAppName,
                priority: t.priority || 'MEDIUM',
              })),
              chronicle: p.chronicle.map((c: any) => ({
                id: c.id,
                timestamp: c.timestamp,
                type: 'SERVICE_EVENT' as const,
                author: c.author || 'system',
                title: c.description,
                badge: c.type,
              })),
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            };
          });
          this.persist(merged);
        }
      },
      error: () => {
        // Fallback to loaded stands
      },
    });
  }

  private loadStands(): ProjectStand[] {
    try {
      const saved = localStorage.getItem(STANDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_PROJECT_STANDS;
  }

  private persist(stands: ProjectStand[]): void {
    try {
      localStorage.setItem(STANDS_STORAGE_KEY, JSON.stringify(stands));
    } catch {
      // storage unavailable
    }
    this.stands$.next(stands);
  }

  /**
   * Binds to reactive impulses across the monorepo to auto-check stand todos and auto-log stand chronicles!
   */
  private bindReactiveListeners(): void {
    // 1. Worker Executions
    this.workerService.workerTriggered$.subscribe(({ worker, execution }) => {
      this.dispatchReactiveToStands(
        'WORKER_TRIGGERED',
        `Импульс воркера: ${worker.name}`,
        execution.durationMs,
        'Lemon Actions',
      );
    });

    // 2. Health & Port Shield Events
    this.healthService.healthEvent$.subscribe((ev) => {
      if (ev.type === 'REGISTERED') {
        const ctx = ev.data;
        this.dispatchReactiveToStands(
          'SERVICE_REGISTERED',
          `Сервис «${ctx.appName}» зарегистрирован на :${ctx.port}`,
          14,
          ctx.projectName,
        );
      } else if (ev.type === 'PING_ALL') {
        this.dispatchReactiveToStands(
          'HEALTHCHECK_PING',
          'Раунд проверки здоровья сервисов завершён',
          24,
        );
      }
    });
  }

  private dispatchReactiveToStands(
    triggerType: ReactiveTriggerType,
    title: string,
    latencyMs?: number,
    targetProjectName?: string,
  ): void {
    const stands = this.stands$.getValue();
    const now = new Date().toISOString();
    let anyChanged = false;

    const updated = stands.map((stand) => {
      let standChanged = false;

      // Update matching reactive todos
      const updatedTodos = stand.todos.map((todo) => {
        if (!todo.completed && todo.isReactive && todo.triggerType === triggerType) {
          standChanged = true;
          anyChanged = true;
          return {
            ...todo,
            completed: true,
            completedAt: now,
            completedBy: `Реактивный импульс (${triggerType})`,
          };
        }
        return todo;
      });

      // Optionally add log to chronicle if matching project or generic
      let updatedChronicle = stand.chronicle;
      if (
        !targetProjectName ||
        stand.name.toLowerCase().includes(targetProjectName.toLowerCase()) ||
        stand.slug.toLowerCase().includes(targetProjectName.toLowerCase())
      ) {
        standChanged = true;
        anyChanged = true;
        const newLog: ProjectSessionLogEntry = {
          id: 'log-' + Math.random().toString(36).substring(2, 7),
          timestamp: now,
          type: triggerType === 'WORKER_TRIGGERED' ? 'WORKER_RUN' : 'SERVICE_EVENT',
          author: 'Stand-Impulse-Bus',
          title,
          latencyMs,
          badge: triggerType,
        };
        updatedChronicle = [newLog, ...stand.chronicle.slice(0, 19)];
      }

      return standChanged
        ? { ...stand, todos: updatedTodos, chronicle: updatedChronicle, updatedAt: now }
        : stand;
    });

    if (anyChanged) {
      this.persist(updated);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Stand Operations                                                           */
  /* -------------------------------------------------------------------------- */

  /**
   * Developer registers a new Project Stand before starting work.
   */
  registerStand(payload: {
    name: string;
    slug?: string;
    description: string;
    color?: LemonCardColor;
    neuronPath?: string;
    tags?: string[];
    environments?: AppEnvironment[];
  }): ProjectStand {
    const current = this.stands$.getValue();
    const slug =
      payload.slug?.trim() ||
      payload.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const neuronPath = payload.neuronPath?.trim() || `workspace.${slug}`;

    const newStand: ProjectStand = {
      id: 'stand-' + slug + '-' + Math.random().toString(36).substring(2, 6),
      name: payload.name.trim(),
      slug,
      description: payload.description.trim(),
      color: payload.color || 'lemon',
      isPinned: false,
      neuronPath,
      tags: payload.tags || ['STAND', 'DEV'],
      environments: payload.environments || ['dev', 'staging', 'production'],
      activeEnvironment: 'ALL',
      apps: [],
      chronicle: [
        {
          id: 'log-init',
          timestamp: new Date().toISOString(),
          type: 'MILESTONE',
          author: 'Developer',
          title: `Стенд проекта «${payload.name}» зарегистрирован`,
          details: `Инициализировано рабочее пространство по нейрону ${neuronPath}`,
          badge: 'STAND_CREATED',
        },
      ],
      todos: [
        {
          id: 'todo-init-1',
          text: 'Зарегистрировать первое приложение в Port Shield',
          completed: false,
          isReactive: true,
          triggerType: 'SERVICE_REGISTERED',
          triggerDescription: 'Срабатывает при регистрации микросервиса',
        },
        {
          id: 'todo-init-2',
          text: 'Провести базовый раунд опроса здоровья',
          completed: false,
          isReactive: true,
          triggerType: 'HEALTHCHECK_PING',
          triggerDescription: 'Срабатывает при первом пинге стенда',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newStand, ...current];
    this.persist(updated);
    return newStand;
  }

  /**
   * Adds an application to an existing Project Stand (with Port Shield allocation).
   */
  addAppToStand(
    standId: string,
    appData: {
      appName: string;
      role: string;
      desiredPort?: number;
      environment: AppEnvironment;
      networkMode: AppNetworkMode;
      customUrl?: string;
      icon?: string;
    },
  ): StandAppItem {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) throw new Error(`Stand ${standId} not found`);

    const port = appData.desiredPort && appData.desiredPort > 0 ? appData.desiredPort : this.nextDynamicPort++;
    const instanceId = 'inst-' + Math.random().toString(36).substring(2, 8);
    const leaseToken = 'tok-' + appData.appName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    let url = appData.customUrl?.trim() || `http://localhost:${port}/health`;
    if (appData.networkMode === 'tailscale-funnel' && !appData.customUrl) {
      url = `https://${appData.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts.net/health`;
    } else if (appData.networkMode === 'tailscale-lan' && !appData.customUrl) {
      url = `http://100.64.0.${(port % 100) + 10}:${port}/health`;
    }

    let defaultIcon = 'terminal';
    if (appData.networkMode === 'tailscale-funnel') defaultIcon = 'public';
    else if (appData.networkMode === 'tailscale-lan') defaultIcon = 'lan';
    else if (appData.appName.toLowerCase().includes('cal')) defaultIcon = 'calendar_month';
    else if (appData.appName.toLowerCase().includes('cms') || appData.appName.toLowerCase().includes('admin')) defaultIcon = 'admin_panel_settings';
    else if (appData.appName.toLowerCase().includes('feed')) defaultIcon = 'rss_feed';
    else if (appData.appName.toLowerCase().includes('media')) defaultIcon = 'video_library';
    else if (appData.appName.toLowerCase().includes('backend') || appData.appName.toLowerCase().includes('api')) defaultIcon = 'dns';

    const newApp: StandAppItem = {
      id: 'app-' + Math.random().toString(36).substring(2, 8),
      appName: appData.appName.trim(),
      role: appData.role.trim() || 'Микросервис стенда',
      port,
      url,
      instanceId,
      leaseToken,
      environment: appData.environment,
      networkMode: appData.networkMode,
      status: 'HEALTHY',
      lastLatencyMs: appData.networkMode === 'tailscale-funnel' ? 42 : 14,
      lastCheckedAt: new Date().toISOString(),
      consecutiveFailures: 0,
      icon: appData.icon || defaultIcon,
    };

    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      type: 'SERVICE_EVENT',
      author: 'Port-Shield-Engine',
      title: `Добавлено приложение: ${newApp.appName}`,
      details: `Выделен порт :${port} [${newApp.environment.toUpperCase()} | ${newApp.networkMode}]`,
      latencyMs: newApp.lastLatencyMs,
      badge: 'APP_REGISTERED',
    };

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            apps: [...s.apps, newApp],
            chronicle: [newLog, ...s.chronicle],
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.persist(updated);

    // Also trigger reactive impulse
    this.chronicleService.dispatchReactiveImpulse(
      'SERVICE_REGISTERED',
      `В стенд «${stand.name}» добавлено приложение «${newApp.appName}» на порту :${port}`,
    );

    return newApp;
  }

  /**
   * Simulate app failure (Circuit Breaker test: increments failures, sets DEGRADED or EVICTED).
   */
  simulateAppFailure(standId: string, appId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) return;

    const targetApp = stand.apps.find((a) => a.id === appId || a.instanceId === appId);
    if (!targetApp) return;

    const nextFailures = (targetApp.consecutiveFailures || 0) + 1;
    let nextStatus: StandAppStatus = targetApp.status;
    let eventTitle = '';

    if (nextFailures >= 5) {
      nextStatus = 'EVICTED';
      eventTitle = `Приложение ${targetApp.appName} превысило лимит сбоев (${nextFailures}/5) и EVICTED`;
    } else if (nextFailures >= 2) {
      nextStatus = 'DEGRADED';
      eventTitle = `Приложение ${targetApp.appName} зафиксировало сбой (${nextFailures}/5) -> DEGRADED`;
    } else {
      eventTitle = `Приложение ${targetApp.appName} пропустило пинг (${nextFailures}/5)`;
    }

    const now = new Date().toISOString();
    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: now,
      type: 'SERVICE_EVENT',
      author: 'Circuit-Breaker',
      title: eventTitle,
      badge: nextStatus,
    };

    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      return {
        ...s,
        apps: s.apps.map((a) =>
          a.id === appId || a.instanceId === appId
            ? { ...a, consecutiveFailures: nextFailures, status: nextStatus, lastCheckedAt: now }
            : a,
        ),
        chronicle: [newLog, ...s.chronicle],
        updatedAt: now,
      };
    });

    this.persist(updated);

    this.http
      .post(`/api/projectarium/projects/${stand.slug}/apps/${targetApp.instanceId}/simulate-failure`, {})
      .subscribe({ error: () => {} });
  }

  /**
   * Heartbeat recovery: restores app to HEALTHY and resets consecutive failures to 0.
   */
  heartbeatApp(standId: string, appId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) return;

    const targetApp = stand.apps.find((a) => a.id === appId || a.instanceId === appId);
    if (!targetApp) return;

    const now = new Date().toISOString();
    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: now,
      type: 'SERVICE_EVENT',
      author: 'Heartbeat-Monitor',
      title: `Приложение ${targetApp.appName} восстановило связь (HEALTHY, 0 сбоев)`,
      badge: 'HEALTH_RESTORED',
    };

    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      return {
        ...s,
        apps: s.apps.map((a) =>
          a.id === appId || a.instanceId === appId
            ? {
                ...a,
                consecutiveFailures: 0,
                status: 'HEALTHY' as StandAppStatus,
                lastCheckedAt: now,
                lastLatencyMs: Math.floor(Math.random() * 15) + 8,
              }
            : a,
        ),
        chronicle: [newLog, ...s.chronicle],
        updatedAt: now,
      };
    });

    this.persist(updated);

    this.http
      .post(`/api/projectarium/projects/${stand.slug}/apps/${targetApp.instanceId}/heartbeat`, {})
      .subscribe({ error: () => {} });
  }

  removeAppFromStand(standId: string, appId: string): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      const target = s.apps.find((a) => a.id === appId);
      const remainingApps = s.apps.filter((a) => a.id !== appId);

      const newLog: ProjectSessionLogEntry = {
        id: 'log-' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        type: 'SERVICE_EVENT',
        author: 'Developer',
        title: `Удалено приложение: ${target?.appName || appId}`,
        details: `Порт :${target?.port} освобождён`,
        badge: 'APP_RELEASED',
      };

      return {
        ...s,
        apps: remainingApps,
        chronicle: [newLog, ...s.chronicle],
        updatedAt: new Date().toISOString(),
      };
    });

    this.persist(updated);
  }

  /**
   * Pings all apps belonging to a project stand (simulates live healthcheck round).
   */
  pingStandApps(standId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) return;

    const now = new Date().toISOString();

    const updatedApps: StandAppItem[] = stand.apps.map((app) => {
      let simLatency = Math.floor(Math.random() * 15) + 10;
      if (app.networkMode === 'tailscale-funnel') simLatency = Math.floor(Math.random() * 25) + 38;
      else if (app.networkMode === 'tailscale-lan') simLatency = Math.floor(Math.random() * 20) + 20;

      return {
        ...app,
        status: 'HEALTHY',
        consecutiveFailures: 0,
        lastLatencyMs: simLatency,
        lastCheckedAt: now,
      };
    });

    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: now,
      type: 'MILESTONE',
      author: 'Health-Checker',
      title: 'Раунд проверки здоровья стенда (PROJECTION)',
      details: `Все ${updatedApps.length} приложений ответили успешно (200 OK)`,
      latencyMs: Math.round(updatedApps.reduce((acc, a) => acc + a.lastLatencyMs, 0) / (updatedApps.length || 1)),
      badge: 'HEALTH_CHECK_OK',
    };

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            apps: updatedApps,
            chronicle: [newLog, ...s.chronicle],
            updatedAt: now,
          }
        : s,
    );

    this.persist(updated);

    this.chronicleService.dispatchReactiveImpulse(
      'HEALTHCHECK_PING',
      `Здоровье стенда «${stand.name}» проверено (${updatedApps.length} сервисов UP)`,
    );
  }

  addChronicleEntry(standId: string, entry: Omit<ProjectSessionLogEntry, 'id' | 'timestamp'>): void {
    const stands = this.stands$.getValue();
    const newEntry: ProjectSessionLogEntry = {
      ...entry,
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
    };

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            chronicle: [newEntry, ...s.chronicle],
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.persist(updated);
  }

  toggleTodoItem(standId: string, itemId: string): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      const updatedTodos = s.todos.map((t) => {
        if (t.id !== itemId) return t;
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          completedBy: nextCompleted ? 'Пользователь (вручную)' : undefined,
        };
      });
      return { ...s, todos: updatedTodos, updatedAt: new Date().toISOString() };
    });

    this.persist(updated);
  }

  addTodoItem(
    standId: string,
    todoData: {
      text: string;
      isReactive: boolean;
      triggerType?: ReactiveTriggerType;
      triggerDescription?: string;
    },
  ): void {
    const stands = this.stands$.getValue();
    const newItem: ReactiveTodoItem = {
      id: 'todo-' + Math.random().toString(36).substring(2, 8),
      text: todoData.text.trim(),
      completed: false,
      isReactive: todoData.isReactive,
      triggerType: todoData.isReactive ? todoData.triggerType || 'MANUAL' : 'MANUAL',
      triggerDescription: todoData.triggerDescription,
    };

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            todos: [...s.todos, newItem],
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.persist(updated);
  }

  deleteTodoItem(standId: string, itemId: string): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            todos: s.todos.filter((t) => t.id !== itemId),
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.persist(updated);
  }

  setActiveEnvironment(standId: string, env: AppEnvironment | 'ALL'): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) => (s.id === standId ? { ...s, activeEnvironment: env } : s));
    this.persist(updated);
  }

  setStandColor(standId: string, color: LemonCardColor): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) => (s.id === standId ? { ...s, color } : s));
    this.persist(updated);
  }

  togglePinStand(standId: string): void {
    const stands = this.stands$.getValue();
    const updated = stands.map((s) => (s.id === standId ? { ...s, isPinned: !s.isPinned } : s));
    this.persist(updated);
  }

  deleteStand(standId: string): void {
    const stands = this.stands$.getValue();
    const updated = stands.filter((s) => s.id !== standId);
    this.persist(updated);
  }
}
