/**
 * Lemon Actions — Lemon-Projectarium Stand Engine
 *
 * Implements the Smart Upsert Handler ("Upsert on First Touch"), Port Shield
 * port allocation, dual-level reactive todo checklists, and immutable chronicle logs.
 */

import {
  ProjectariumApp,
  ProjectariumEnvironment,
  ProjectariumEvent,
  ProjectariumNetworkMode,
  ProjectariumNoteItem,
  ProjectariumProject,
  ProjectariumRegisterPayload,
  ProjectariumRegisterResponse,
  ProjectariumScope,
  ProjectariumTodoItem,
  ProjectShieldStats,
} from '../types/projectarium.types';
import { buildDefaultHealthUrl, resolveAppHost } from '../utils/address.utils';

export class ProjectariumEngine {
  private projects: Map<string, ProjectariumProject> = new Map();
  private nextDynamicPort = 4320;
  private readonly reservedPorts = new Set<number>([
    5433, // PostgreSQL
    3000, // API Gateway
    4201, // Angular Web
    4202, // Coding Agent UI
  ]);

  constructor() {
    this.seedDefaultStands();
  }

  /**
   * Slugify helper
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Allocate a unique network port
   */
  private allocatePort(preferredPort?: number): number {
    const activePorts = new Set<number>();
    for (const project of this.projects.values()) {
      for (const app of project.apps) {
        if (app.status !== 'EVICTED') {
          activePorts.add(app.port);
        }
      }
    }

    if (preferredPort && !activePorts.has(preferredPort)) {
      return preferredPort;
    }

    let candidate = Math.max(this.nextDynamicPort, 4320);
    while (activePorts.has(candidate) || this.reservedPorts.has(candidate)) {
      candidate++;
    }
    this.nextDynamicPort = candidate + 1;
    return candidate;
  }

  /**
   * Seed the three permanent project stands:
   * 1. Lemon Seasons
   * 2. Lemon Actions
   * 3. Sportdrop
   */
  private seedDefaultStands(): void {
    const now = new Date().toISOString();

    // 1. Lemon Seasons Stand (deployed on remote host 192.168.1.100)
    const seasonsProject: ProjectariumProject = {
      id: 'stand-seasons',
      name: 'Lemon Seasons',
      slug: 'seasons',
      neuronWorkspace: 'workspace.seasons',
      projectToken: 'proj_seasons_sec_4f9a12',
      context: {
        domain: 'Seasonal Content & Calendar Engine',
        environment: 'production',
        host: '192.168.1.100',
        stack: ['React/Vite', 'NestJS', 'PostgreSQL 16', 'Nginx Gateway', 'Docker'],
        tags: ['REMOTE_192_168_1_100', 'GATEWAY', 'CALENDAR', 'CMS', 'FEED', 'BACKEND', 'POSTGRES'],
        description:
          'Развернутый кластер Lemon Seasons на удаленном хосте 192.168.1.100: Gateway (:8090), Backend (:3001), Admin CMS (:5173), Calendar (:5174), Feed (:5175), PostgreSQL (:5435).',
      },
      apps: [
        {
          id: 'app-seasons-gateway',
          appName: 'Lemon-seasons gateway',
          host: '192.168.1.100',
          port: 8090,
          instanceId: 'inst_seasons_gw_01',
          leaseToken: 'lease_seasons_gw_8090',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:8090/health',
          lastPingAt: now,
          pingLatencyMs: 11,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-gateway',
            role: 'Nginx Gateway — единый вход (/api, /calendar/, /admin/, /)',
            icon: 'router',
          },
        },
        {
          id: 'app-seasons-backend',
          appName: 'Lemon-seasons backend',
          host: '192.168.1.100',
          port: 3001,
          instanceId: 'inst_seasons_api_01',
          leaseToken: 'lease_seasons_api_7733',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:3001/api/health',
          lastPingAt: now,
          pingLatencyMs: 8,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-backend',
            role: 'NestJS API, сессии, синхронизация и события',
            icon: 'dns',
          },
        },
        {
          id: 'app-seasons-admin',
          appName: 'Admin - cms',
          host: '192.168.1.100',
          port: 5173,
          instanceId: 'inst_seasons_cms_01',
          leaseToken: 'lease_seasons_cms_8821',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:5173/',
          lastPingAt: now,
          pingLatencyMs: 14,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-admin',
            role: 'Панель управления контентом и сезонами (CMS)',
            icon: 'admin_panel_settings',
          },
        },
        {
          id: 'app-seasons-cal',
          appName: 'Calendar - app',
          host: '192.168.1.100',
          port: 5174,
          instanceId: 'inst_seasons_cal_01',
          leaseToken: 'lease_seasons_cal_9912',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:5174/',
          lastPingAt: now,
          pingLatencyMs: 14,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-calendar',
            role: 'Интерактивный календарный интерфейс',
            icon: 'calendar_month',
          },
        },
        {
          id: 'app-seasons-feed',
          appName: 'Feed-app',
          host: '192.168.1.100',
          port: 5175,
          instanceId: 'inst_seasons_feed_01',
          leaseToken: 'lease_seasons_feed_6644',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:5175/',
          lastPingAt: now,
          pingLatencyMs: 16,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-feed',
            role: 'Лента публикаций и контентных фидов',
            icon: 'rss_feed',
          },
        },
        {
          id: 'app-seasons-db',
          appName: 'Lemon-seasons DB',
          host: '192.168.1.100',
          port: 5435,
          instanceId: 'inst_seasons_db_01',
          leaseToken: 'lease_seasons_db_5435',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'postgresql://192.168.1.100:5435/lemon_calendarium',
          lastPingAt: now,
          pingLatencyMs: 4,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-seasons-db',
            role: 'PostgreSQL 16 (lemon_calendarium)',
            icon: 'database',
          },
        },
      ],
      todos: [
        {
          id: 'todo-s-1',
          title: 'Подключить календарный виджет к Feed-app',
          completed: true,
          scope: 'PROJECT',
          createdAt: now,
          completedAt: now,
          author: 'Alex (Lead Dev)',
          priority: 'HIGH',
        },
        {
          id: 'todo-s-2',
          title: 'Оптимизировать батчинг картинок в Admin CMS',
          completed: false,
          scope: 'APP',
          targetAppName: 'Admin - cms',
          createdAt: now,
          author: 'Lena (Frontend)',
          priority: 'MEDIUM',
        },
        {
          id: 'todo-s-3',
          title: 'Настроить синхронизацию полей со справочником сезонов',
          completed: false,
          scope: 'APP',
          targetAppName: 'Lemon-seasons backend',
          createdAt: now,
          author: 'Dmitry (Backend)',
          priority: 'HIGH',
        },
      ],
      notes: [
        {
          id: 'note-s-1',
          title: 'Интеграция с хабом и медиа-вложениями',
          content: 'Lemon Seasons готов выступать хабом хранения заметок, тегов и медиа-метаданных через SeasonsCombinatorBridge.',
          author: 'Alex (Lead Dev)',
          tags: ['HUB', 'SEASONS', 'MEDIA'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      chronicle: [
        {
          id: 'ev-s-1',
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: 'Проект Lemon Seasons зарегистрирован в инфраструктурном стэнде (хост 192.168.1.100)',
          timestamp: now,
          author: 'system',
        },
        {
          id: 'ev-s-2',
          type: 'APP_REGISTERED',
          scope: 'APP',
          targetAppName: 'Lemon-seasons gateway',
          description: 'Развернут удаленный стек lemon-seasons на 192.168.1.100 (Gateway :8090, Backend :3001, Admin :5173, Calendar :5174, Feed :5175, DB :5435)',
          timestamp: now,
          author: 'system',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // 2. Lemon Actions Stand
    const actionsProject: ProjectariumProject = {
      id: 'stand-actions',
      name: 'Lemon Actions',
      slug: 'actions',
      neuronWorkspace: 'workspace.actions',
      projectToken: 'proj_actions_master_8830ab',
      context: {
        domain: 'Reactive Automation & Port Shield Orchestration',
        environment: 'dev',
        stack: ['Angular 18', 'NestJS', 'PostgreSQL', 'Tailwind CSS'],
        description: 'Core infrastructure hub: локальный dev (localhost) и удаленный кластер (192.168.1.100).',
      },
      apps: [
        {
          id: 'app-actions-db',
          appName: 'Core combinator (Dev DB)',
          host: 'localhost',
          port: 5433,
          instanceId: 'inst_actions_comb_01',
          leaseToken: 'lease_actions_comb_1100',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'postgresql://localhost:5433/lemon_db',
          lastPingAt: now,
          pingLatencyMs: 3,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: 'localhost',
            containerName: 'lemon-actions-postgres',
            role: 'Локальная PostgreSQL 15 база потоков и стендов',
            icon: 'database',
          },
        },
        {
          id: 'app-actions-web',
          appName: 'Lemon actions (Dev Web)',
          host: 'localhost',
          port: 4201,
          instanceId: 'inst_actions_web_01',
          leaseToken: 'lease_actions_web_2200',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4201',
          lastPingAt: now,
          pingLatencyMs: 11,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: 'localhost',
            role: 'Локальный Angular UI (основная консоль)',
            icon: 'style',
          },
        },
        {
          id: 'app-actions-projectarium-ui',
          appName: 'Projectarium UI (Dev)',
          host: 'localhost',
          port: 4203,
          instanceId: 'inst_actions_proj_ui_01',
          leaseToken: 'lease_actions_proj_4203',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4203/projectarium',
          lastPingAt: now,
          pingLatencyMs: 9,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: 'localhost',
            role: 'Standalone Projectarium Cockpit (HMR dev)',
            icon: 'domain',
          },
        },
        {
          id: 'app-actions-shield',
          appName: 'Port Shield (Dev API)',
          host: 'localhost',
          port: 3000,
          instanceId: 'inst_actions_shield_01',
          leaseToken: 'lease_actions_shield_3300',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:3000/api/health',
          lastPingAt: now,
          pingLatencyMs: 6,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: 'localhost',
            role: 'Локальный NestJS API & Port Shield Registrar',
            icon: 'verified_user',
          },
        },
        {
          id: 'app-actions-watchers',
          appName: 'Lemon Watchers',
          host: 'localhost',
          port: 4301,
          instanceId: 'inst_actions_watchers_01',
          leaseToken: 'lease_actions_watchers_4400',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4301/health',
          lastPingAt: now,
          pingLatencyMs: 15,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: 'localhost',
            role: 'Монитор файловых импульсов и событий',
            icon: 'visibility',
          },
        },
        {
          id: 'app-actions-remote-web',
          appName: 'Lemon Core Web (Remote)',
          host: '192.168.1.100',
          port: 4201,
          instanceId: 'inst_actions_remote_web_01',
          leaseToken: 'lease_actions_rem_web_4201',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:4201',
          lastPingAt: now,
          pingLatencyMs: 12,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-core-web',
            role: 'Production Web UI на удаленном хосте (также :80)',
            icon: 'public',
          },
        },
        {
          id: 'app-actions-remote-api',
          appName: 'Lemon Core API (Remote)',
          host: '192.168.1.100',
          port: 3000,
          instanceId: 'inst_actions_remote_api_01',
          leaseToken: 'lease_actions_rem_api_3000',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'http://192.168.1.100:3000/api/health',
          lastPingAt: now,
          pingLatencyMs: 9,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-core-api',
            role: 'Production NestJS API и Port Shield на 192.168.1.100',
            icon: 'dns',
          },
        },
        {
          id: 'app-actions-remote-db',
          appName: 'Lemon Core DB (Remote)',
          host: '192.168.1.100',
          port: 5432,
          instanceId: 'inst_actions_remote_db_01',
          leaseToken: 'lease_actions_rem_db_5432',
          environment: 'production',
          networkMode: 'lan',
          status: 'ONLINE',
          healthUrl: 'postgresql://192.168.1.100:5432/lemon_db',
          lastPingAt: now,
          pingLatencyMs: 5,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: {
            host: '192.168.1.100',
            containerName: 'lemon-core-postgres',
            role: 'Production PostgreSQL 15 на 192.168.1.100',
            icon: 'database',
          },
        },
      ],
      todos: [
        {
          id: 'todo-a-1',
          title: 'Реализовать единый Smart Handler регистрации проектов',
          completed: true,
          scope: 'PROJECT',
          createdAt: now,
          completedAt: now,
          author: 'Lead Architect',
          priority: 'HIGH',
        },
        {
          id: 'todo-a-2',
          title: 'Связать Lemon-Projectarium с панелью Port Shield',
          completed: true,
          scope: 'PROJECT',
          createdAt: now,
          completedAt: now,
          author: 'Agent Antigravity',
          priority: 'HIGH',
        },
        {
          id: 'todo-a-3',
          title: 'Проверить Zero-Deadlock изоляцию для портов :5433, :3000, :4201',
          completed: true,
          scope: 'APP',
          targetAppName: 'Port Shield (Dev API)',
          createdAt: now,
          completedAt: now,
          author: 'Security Bot',
          priority: 'HIGH',
        },
      ],
      notes: [
        {
          id: 'note-a-1',
          title: 'Обвязки lemon-core',
          content: 'Ядро потоков (CONTEXT, MUTEX, OBSERVER, FSM, PROJECTION, BATCH) и SDK обвязки в приоритете. После завершения возвращаемся к перенесению прототипов Lemon-Party.',
          author: 'Lead Architect',
          tags: ['LEMON_CORE', 'FLOWS', 'SDK'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      chronicle: [
        {
          id: 'ev-a-1',
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: 'Проект Lemon Actions инициализирован как центральный координатор',
          timestamp: now,
          author: 'system',
        },
        {
          id: 'ev-a-2',
          type: 'APP_REGISTERED',
          scope: 'APP',
          targetAppName: 'Port Shield (Dev API)',
          description: 'Port Shield активирован на localhost:3000 (dev) и 192.168.1.100:3000 (remote)',
          timestamp: now,
          author: 'system',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // 3. Sportdrop Stand
    const sportdropProject: ProjectariumProject = {
      id: 'stand-sportdrop',
      name: 'Sportdrop',
      slug: 'sportdrop',
      neuronWorkspace: 'workspace.sportdrop',
      projectToken: 'proj_sportdrop_rel_3321fa',
      context: {
        domain: 'Real-time Sports Streaming & Gateway Relay',
        environment: 'production',
        stack: ['Go', 'WebRTC', 'Tailscale Mesh', 'Node.js'],
        description: 'Global streaming media cluster, WAN gateway tunnels, and dev mesh.',
      },
      apps: [
        {
          id: 'app-sd-dev',
          appName: 'Dev env',
          host: 'localhost',
          port: 4310,
          instanceId: 'inst_sd_dev_01',
          leaseToken: 'lease_sd_dev_5511',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4310',
          lastPingAt: now,
          pingLatencyMs: 12,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: { host: 'localhost' },
        },
        {
          id: 'app-sd-lan',
          appName: 'Lan port',
          host: '100.100.1.5',
          port: 4311,
          instanceId: 'inst_sd_lan_01',
          leaseToken: 'lease_sd_lan_5522',
          environment: 'dev',
          networkMode: 'tailscale-lan',
          status: 'ONLINE',
          healthUrl: 'http://100.100.1.5:4311',
          lastPingAt: now,
          pingLatencyMs: 28,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: { host: '100.100.1.5' },
        },
        {
          id: 'app-sd-media',
          appName: 'Media gateway port',
          host: 'localhost',
          port: 4312,
          instanceId: 'inst_sd_media_01',
          leaseToken: 'lease_sd_media_5533',
          environment: 'staging',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:4312/metrics',
          lastPingAt: now,
          pingLatencyMs: 18,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: { host: 'localhost' },
        },
        {
          id: 'app-sd-funnel',
          appName: 'Funnel tunnel',
          host: 'sportdrop-funnel.lemon.ts.net',
          port: 443,
          instanceId: 'inst_sd_funnel_01',
          leaseToken: 'lease_sd_funnel_5544',
          environment: 'production',
          networkMode: 'tailscale-funnel',
          status: 'ONLINE',
          healthUrl: 'https://sportdrop-funnel.lemon.ts.net',
          lastPingAt: now,
          pingLatencyMs: 45,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: { host: 'sportdrop-funnel.lemon.ts.net' },
        },
        {
          id: 'app-sd-prod',
          appName: 'Prod port',
          host: 'sportdrop-prod.lemon.ts.net',
          port: 8443,
          instanceId: 'inst_sd_prod_01',
          leaseToken: 'lease_sd_prod_5555',
          environment: 'production',
          networkMode: 'tailscale-funnel',
          status: 'ONLINE',
          healthUrl: 'https://sportdrop-prod.lemon.ts.net:8443',
          lastPingAt: now,
          pingLatencyMs: 38,
          consecutiveFailures: 0,
          registeredAt: now,
          metadata: { host: 'sportdrop-prod.lemon.ts.net' },
        },
      ],
      todos: [
        {
          id: 'todo-sd-1',
          title: 'Проверить пропускную способность Media gateway port',
          completed: true,
          scope: 'APP',
          targetAppName: 'Media gateway port',
          createdAt: now,
          completedAt: now,
          author: 'Media Ops',
          priority: 'HIGH',
        },
        {
          id: 'todo-sd-2',
          title: 'Сертификат Tailscale Funnel для публичного релея',
          completed: true,
          scope: 'APP',
          targetAppName: 'Funnel tunnel',
          createdAt: now,
          completedAt: now,
          author: 'DevOps',
          priority: 'MEDIUM',
        },
        {
          id: 'todo-sd-3',
          title: 'Нагрузочное тестирование LAN связки с dev env',
          completed: false,
          scope: 'PROJECT',
          createdAt: now,
          author: 'QA Team',
          priority: 'HIGH',
        },
      ],
      notes: [],
      chronicle: [
        {
          id: 'ev-sd-1',
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: 'Проект Sportdrop развернут с распределенной mesh-сетью',
          timestamp: now,
          author: 'system',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // 4. Lemon-Party Stand
    const lemonPartyProject: ProjectariumProject = {
      id: 'stand-lemon-party',
      name: 'Lemon-Party',
      slug: 'lemon-party',
      neuronWorkspace: 'workspace.party',
      projectToken: 'proj_party_arena_9012de',
      context: {
        domain: 'Interactive Hero Flows, Time-Traveling Notes & Party Modes',
        environment: 'dev',
        color: 'lavender',
        isPinned: true,
        stack: ['Angular 18', 'Core Combinator', 'FSM', 'Chrono Cloud'],
        tags: ['LEMON_PARTY', 'TIME_TRAVELING', 'TIMELINE', 'HERO_CARDS', 'FSM'],
        description:
          'Проекты и игровые режимы на базе Lemon-Party: асинхронные заметки сквозь время, таймлайны дня и героев, карточки персонажей и желаний.',
      },
      apps: [],
      todos: [
        {
          id: 'todo-lp-1',
          title: 'Закончить все обвязки для lemon-core перед возвращением к режимам Lemon-Party',
          completed: false,
          scope: 'PROJECT',
          createdAt: now,
          author: 'Lead Architect',
          priority: 'HIGH',
        },
        {
          id: 'todo-lp-2',
          title: 'Спроектировать прототип Time Traveling (вручную + Stitch) и выделить золотую середину',
          completed: false,
          scope: 'PROJECT',
          createdAt: now,
          author: 'Product & Design',
          priority: 'MEDIUM',
        },
      ],
      notes: [
        {
          id: 'note-lp-apps-interest',
          title: 'Рабочие приложения и режимы на базе Lemon-Party',
          content:
            'Направления и приложения, которые нас заинтересовали для дальнейшего развития на базе Lemon-Party:\n' +
            '• Time Traveling — режим игры, где поток оставляет метку о себе, другой герой возвращается через время, видит наброски идеи, продолжает её или через FSM поворачивает в новое направление (имя героя, время последних наработок, мысли на потом; позже через хаб — музыка, видео, картинки).\n' +
            '• Timeline (Day / Hero) — суточная и персонажная временная лента событий и следов.\n' +
            '• Hero Cards — карточки героев, желаний и истории их взаимодействий.\n\n' +
            'Скоро вернёмся к работе над этими режимами, как только закончим писать все обвязки для lemon-core.',
          author: 'Team',
          tags: ['Time Traveling', 'Timeline (Day / Hero)', 'Hero Cards', 'lemon-core'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      chronicle: [
        {
          id: 'ev-lp-1',
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: 'Проект Lemon-Party выделен в отдельный стенд Projectarium с заметками по будущим режимам',
          timestamp: now,
          author: 'system',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(seasonsProject.id, seasonsProject);
    this.projects.set(actionsProject.id, actionsProject);
    this.projects.set(sportdropProject.id, sportdropProject);
    this.projects.set(lemonPartyProject.id, lemonPartyProject);
  }

  /**
   * Find project by token, slug, or ID
   */
  public findProject(query: string): ProjectariumProject | undefined {
    for (const project of this.projects.values()) {
      if (
        project.projectToken === query ||
        project.slug === query ||
        project.id === query ||
        project.neuronWorkspace === query
      ) {
        return project;
      }
    }
    return undefined;
  }

  /**
   * Create an empty project stand without registering an initial app yet
   */
  public createProject(payload: {
    projectName: string;
    projectSlug?: string;
    neuronWorkspace?: string;
    context?: Record<string, any>;
    initialTodos?: string[];
    author?: string;
  }): { project: ProjectariumProject; isNewProject: boolean } {
    const slug = payload.projectSlug || this.slugify(payload.projectName);
    const existing = this.findProject(slug);
    if (existing) {
      return { project: existing, isNewProject: false };
    }

    const project = this.buildAndStoreProject({
      projectName: payload.projectName,
      projectSlug: slug,
      neuronWorkspace: payload.neuronWorkspace,
      context: payload.context,
      initialTodos: payload.initialTodos,
      author: payload.author,
      description: `Стенд "${payload.projectName}" зарегистрирован`,
    });
    return { project, isNewProject: true };
  }

  private buildAndStoreProject(params: {
    projectName: string;
    projectSlug: string;
    neuronWorkspace?: string;
    environment?: ProjectariumEnvironment;
    context?: Record<string, any>;
    initialTodos?: string[];
    author?: string;
    description: string;
  }): ProjectariumProject {
    const now = new Date().toISOString();
    const projectId = `stand-${params.projectSlug}-${Date.now().toString(36)}`;
    const randomSecret = Math.random().toString(36).substring(2, 8);
    const projectToken = `proj_${params.projectSlug}_${randomSecret}`;
    const neuronWorkspace = params.neuronWorkspace || `workspace.${params.projectSlug}`;

    const project: ProjectariumProject = {
      id: projectId,
      name: params.projectName,
      slug: params.projectSlug,
      neuronWorkspace,
      projectToken,
      context: params.context || {
        createdBy: params.author || 'autonomous-agent',
        bootstrapMode: 'smart-upsert',
        env: params.environment || 'dev',
      },
      apps: [],
      todos: [],
      notes: [],
      chronicle: [
        {
          id: `ev-init-${Date.now().toString(36)}`,
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: params.description,
          timestamp: now,
          author: params.author || 'autonomous-agent',
          metadata: { neuronWorkspace },
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    if (params.initialTodos && params.initialTodos.length > 0) {
      for (const todoTitle of params.initialTodos) {
        project.todos.push({
          id: `todo-${Math.random().toString(36).substring(2, 9)}`,
          title: todoTitle,
          completed: false,
          scope: 'PROJECT',
          createdAt: now,
          author: params.author || 'autonomous-agent',
          priority: 'HIGH',
        });
      }
    }

    this.projects.set(project.id, project);
    return project;
  }

  /**
   * Unified Smart Handler ("Upsert on First Touch")
   * If project does not exist -> creates it, generates projectToken, and attaches first app.
   * If project exists -> attaches application under the existing project and logs to chronicle.
   */
  public registerOrAttach(payload: ProjectariumRegisterPayload): ProjectariumRegisterResponse {
    const now = new Date().toISOString();
    let project: ProjectariumProject | undefined;
    let isNewProject = false;

    // 1. Try finding existing project
    if (payload.projectToken) {
      project = this.findProject(payload.projectToken);
    } else if (payload.projectSlug) {
      project = this.findProject(payload.projectSlug);
    } else if (payload.projectName) {
      const slug = this.slugify(payload.projectName);
      project = this.findProject(slug);
    }

    // 2. If not found, create new project stand
    if (!project) {
      isNewProject = true;
      const rawName = payload.projectName || payload.projectSlug || 'New Project Stand';
      const slug = payload.projectSlug || this.slugify(rawName);
      project = this.buildAndStoreProject({
        projectName: rawName,
        projectSlug: slug,
        environment: payload.environment,
        context: payload.context,
        initialTodos: payload.initialTodos,
        author: payload.author,
        description: `Стенд "${rawName}" автоматически создан через Smart Handler (first touch)`,
      });
    }

    // 3. Allocate port & create application instance
    const appName = payload.appName || `${project.slug}-core`;
    const allocatedPort = this.allocatePort(payload.preferredPort);
    const networkMode: ProjectariumNetworkMode = payload.networkMode || 'local';
    const host = resolveAppHost(payload.host, payload.healthUrl);
    const healthUrl = payload.healthUrl || buildDefaultHealthUrl(host, allocatedPort, networkMode);
    const instanceId = `inst_${project.slug}_${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`;
    const leaseToken = `lease_${Math.random().toString(36).substring(2, 12)}`;

    const newApp: ProjectariumApp = {
      id: `app-${project.slug}-${Date.now().toString(36)}`,
      appName: appName,
      host,
      port: allocatedPort,
      instanceId: instanceId,
      leaseToken: leaseToken,
      environment: payload.environment || 'dev',
      networkMode,
      status: 'ONLINE',
      healthUrl,
      lastPingAt: now,
      pingLatencyMs: Math.floor(Math.random() * 15) + 5,
      consecutiveFailures: 0,
      registeredAt: now,
      metadata: {
        ...(payload.context ?? {}),
        host,
      },
    };

    project.apps.push(newApp);
    project.updatedAt = now;

    // 4. Chronicle log
    const event: ProjectariumEvent = {
      id: `ev-reg-${Date.now().toString(36)}`,
      type: 'APP_REGISTERED',
      scope: 'APP',
      targetAppName: newApp.appName,
      description: `Приложение ${newApp.appName} — ${host}:${allocatedPort} [${newApp.networkMode}]`,
      timestamp: now,
      author: payload.author || 'autonomous-agent',
      metadata: {
        instanceId: newApp.instanceId,
        host,
        port: newApp.port,
        leaseToken: newApp.leaseToken,
      },
    };
    project.chronicle.unshift(event);

    return {
      success: true,
      isNewProject,
      projectToken: project.projectToken,
      project,
      allocatedApp: newApp,
      message: isNewProject
        ? `Проект "${project.name}" успешно инициализирован, приложению ${newApp.appName} выделен порт :${allocatedPort}`
        : `Приложение ${newApp.appName} успешно прикреплено к проекту "${project.name}" на порт :${allocatedPort}`,
    };
  }

  /**
   * List all projects
   */
  public listProjects(): ProjectariumProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Replace in-memory state with persisted project stands (e.g., hydrated from PostgreSQL)
   */
  public hydrateSnapshot(projects: ProjectariumProject[]): void {
    this.projects.clear();
    let maxPort = 4319;
    for (const project of projects) {
      project.notes = Array.isArray(project.notes) ? project.notes : [];
      for (const app of project.apps) {
        app.host = resolveAppHost(app.host || (app.metadata?.['host'] as string | undefined), app.healthUrl);
        if (app.port >= maxPort && !this.reservedPorts.has(app.port)) {
          maxPort = app.port;
        }
      }
      this.projects.set(project.id, project);
    }
    this.nextDynamicPort = Math.max(4320, maxPort + 1);
  }

  /**
   * Delete a project stand by token, slug, or ID
   */
  public deleteProject(tokenOrSlug: string): boolean {
    const project = this.findProject(tokenOrSlug);
    if (!project) return false;
    return this.projects.delete(project.id);
  }

  /**
   * Get single project
   */
  public getProject(query: string): ProjectariumProject | undefined {
    return this.findProject(query);
  }

  /**
   * Release an app instance from a project
   */
  public releaseApp(tokenOrSlug: string, instanceId: string, author = 'user'): boolean {
    const project = this.findProject(tokenOrSlug);
    if (!project) return false;

    const index = project.apps.findIndex((a) => a.instanceId === instanceId || a.id === instanceId);
    if (index === -1) return false;

    const app = project.apps[index];
    project.apps.splice(index, 1);
    project.updatedAt = new Date().toISOString();

    project.chronicle.unshift({
      id: `ev-rel-${Date.now().toString(36)}`,
      type: 'APP_RELEASED',
      scope: 'APP',
      targetAppName: app.appName,
      description: `Приложение ${app.appName} (порт :${app.port}) освобождено и удалено из пула`,
      timestamp: new Date().toISOString(),
      author,
    });

    return true;
  }

  /**
   * Apply a real active probe result (HTTP/TCP) to an application instance.
   */
  public recordProbeResult(
    tokenOrSlug: string,
    instanceId: string,
    probe: { ok: boolean; latencyMs: number; error?: string },
    options: { recordChronicleOnFailure?: boolean } = {}
  ): ProjectariumApp | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const app = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
    if (!app) return undefined;

    const now = new Date().toISOString();
    const prevStatus = app.status;
    const latencyMs = Math.max(1, Math.round(probe.latencyMs));

    app.lastPingAt = now;
    app.pingLatencyMs = latencyMs;
    project.updatedAt = now;

    if (probe.ok) {
      app.consecutiveFailures = 0;
      app.status = 'ONLINE';

      if (prevStatus === 'DEGRADED' || prevStatus === 'EVICTED') {
        project.chronicle.unshift({
          id: `ev-rec-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          type: 'APP_HEARTBEAT',
          scope: 'APP',
          targetAppName: app.appName,
          description: `Сервис ${app.appName} восстановил доступность (UP · ${latencyMs}ms)`,
          timestamp: now,
          author: 'health-probe',
        });
      }

      return app;
    }

    app.consecutiveFailures = (app.consecutiveFailures || 0) + 1;
    const reasonSuffix = probe.error ? ` (${probe.error})` : '';

    if (app.consecutiveFailures >= 5) {
      app.status = 'EVICTED';
      if (prevStatus !== 'EVICTED') {
        project.chronicle.unshift({
          id: `ev-evict-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          type: 'APP_EVICTED',
          scope: 'APP',
          targetAppName: app.appName,
          description: `Сервис ${app.appName} недоступен (${app.consecutiveFailures}/5)${reasonSuffix} — выведен из пула`,
          timestamp: now,
          author: 'health-probe',
        });
      }
    } else {
      app.status = 'DEGRADED';
      if (prevStatus === 'ONLINE' || options.recordChronicleOnFailure) {
        project.chronicle.unshift({
          id: `ev-deg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          type: 'APP_DEGRADED',
          scope: 'APP',
          targetAppName: app.appName,
          description: `Сервис ${app.appName} не отвечает (${app.consecutiveFailures}/5)${reasonSuffix}`,
          timestamp: now,
          author: 'health-probe',
        });
      }
    }

    return app;
  }

  /**
   * Append a stand-level healthcheck summary event to chronicle after an on-demand ping round.
   */
  public recordStandPingSummary(
    tokenOrSlug: string,
    author = 'health-probe'
  ): ProjectariumEvent | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const total = project.apps.length;
    const online = project.apps.filter((a) => a.status === 'ONLINE').length;
    const degraded = project.apps.filter((a) => a.status === 'DEGRADED').length;
    const evicted = project.apps.filter((a) => a.status === 'EVICTED').length;
    const onlineApps = project.apps.filter((a) => a.status === 'ONLINE' && typeof a.pingLatencyMs === 'number');
    const avgLatency =
      onlineApps.length > 0
        ? Math.round(onlineApps.reduce((sum, a) => sum + (a.pingLatencyMs || 0), 0) / onlineApps.length)
        : 0;

    const now = new Date().toISOString();
    const description =
      degraded === 0 && evicted === 0
        ? `Healthcheck стенда: все ${online}/${total} сервисов UP (avg ${avgLatency}ms)`
        : `Healthcheck стенда: UP ${online}/${total}, DEGRADED ${degraded}, DOWN ${evicted}`;

    const event: ProjectariumEvent = {
      id: `ev-ping-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      type: 'APP_HEARTBEAT',
      scope: 'PROJECT',
      description,
      timestamp: now,
      author,
      metadata: { total, online, degraded, evicted, averageLatencyMs: avgLatency },
    };

    project.chronicle.unshift(event);
    project.updatedAt = now;
    return event;
  }

  /**
   * Add a Todo item (Project or App level)
   */
  public addTodo(
    tokenOrSlug: string,
    payload: {
      title: string;
      scope: ProjectariumScope;
      targetAppName?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      author?: string;
    }
  ): ProjectariumTodoItem | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const now = new Date().toISOString();
    const todo: ProjectariumTodoItem = {
      id: `todo-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      title: payload.title,
      completed: false,
      scope: payload.scope,
      targetAppName: payload.scope === 'APP' ? payload.targetAppName : undefined,
      createdAt: now,
      author: payload.author || 'user',
      priority: payload.priority || 'MEDIUM',
    };

    project.todos.unshift(todo);
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-todo-${Date.now().toString(36)}`,
      type: 'TODO_ADDED',
      scope: todo.scope,
      targetAppName: todo.targetAppName,
      description: `Добавлена задача: "${todo.title}" [${todo.scope}]`,
      timestamp: now,
      author: todo.author,
    });

    return todo;
  }

  /**
   * Toggle Todo item completion
   */
  public toggleTodo(tokenOrSlug: string, todoId: string): ProjectariumTodoItem | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const todo = project.todos.find((t) => t.id === todoId);
    if (!todo) return undefined;

    todo.completed = !todo.completed;
    const now = new Date().toISOString();
    todo.completedAt = todo.completed ? now : undefined;
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-togg-${Date.now().toString(36)}`,
      type: 'TODO_TOGGLED',
      scope: todo.scope,
      targetAppName: todo.targetAppName,
      description: `Задача "${todo.title}" ${todo.completed ? 'завершена ✅' : 'возвращена в работу ⏳'}`,
      timestamp: now,
      author: 'user',
    });

    return todo;
  }

  /**
   * Add a Note item to a project stand
   */
  public addNote(
    tokenOrSlug: string,
    payload: {
      title?: string;
      content: string;
      author?: string;
      tags?: string[];
    }
  ): ProjectariumNoteItem | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const now = new Date().toISOString();
    const note: ProjectariumNoteItem = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      title: payload.title?.trim() || undefined,
      content: payload.content.trim(),
      author: payload.author?.trim() || 'developer',
      tags: payload.tags?.map((t) => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };

    project.notes = project.notes || [];
    project.notes.unshift(note);
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-note-add-${Date.now().toString(36)}`,
      type: 'NOTE_ADDED',
      scope: 'PROJECT',
      description: `Добавлена заметка${note.title ? `: "${note.title}"` : ''}`,
      timestamp: now,
      author: note.author,
    });

    return note;
  }

  /**
   * Update an existing Note item in a project stand
   */
  public updateNote(
    tokenOrSlug: string,
    noteId: string,
    payload: {
      title?: string;
      content?: string;
      author?: string;
      tags?: string[];
    }
  ): ProjectariumNoteItem | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project || !project.notes) return undefined;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note) return undefined;

    const now = new Date().toISOString();
    if (payload.title !== undefined) {
      note.title = payload.title.trim() || undefined;
    }
    if (payload.content !== undefined) {
      note.content = payload.content.trim();
    }
    if (payload.tags !== undefined) {
      note.tags = payload.tags.map((t) => t.trim()).filter(Boolean);
    }
    if (payload.author !== undefined && payload.author.trim()) {
      note.author = payload.author.trim();
    }
    note.updatedAt = now;
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-note-upd-${Date.now().toString(36)}`,
      type: 'NOTE_UPDATED',
      scope: 'PROJECT',
      description: `Обновлена заметка${note.title ? `: "${note.title}"` : ''}`,
      timestamp: now,
      author: note.author,
    });

    return note;
  }

  /**
   * Delete a Note item from a project stand
   */
  public deleteNote(tokenOrSlug: string, noteId: string, author = 'developer'): boolean {
    const project = this.findProject(tokenOrSlug);
    if (!project || !project.notes) return false;

    const idx = project.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) return false;

    const [removed] = project.notes.splice(idx, 1);
    const now = new Date().toISOString();
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-note-del-${Date.now().toString(36)}`,
      type: 'NOTE_DELETED',
      scope: 'PROJECT',
      description: `Удалена заметка${removed.title ? `: "${removed.title}"` : ''}`,
      timestamp: now,
      author,
    });

    return true;
  }

  /**
   * Add Chronicle Event / Note
   */
  public addChronicleEvent(
    tokenOrSlug: string,
    payload: {
      description: string;
      scope: ProjectariumScope;
      targetAppName?: string;
      author?: string;
    }
  ): ProjectariumEvent | undefined {
    const project = this.findProject(tokenOrSlug);
    if (!project) return undefined;

    const now = new Date().toISOString();
    const event: ProjectariumEvent = {
      id: `ev-manual-${Date.now().toString(36)}`,
      type: 'MANUAL_NOTE',
      scope: payload.scope,
      targetAppName: payload.scope === 'APP' ? payload.targetAppName : undefined,
      description: payload.description,
      timestamp: now,
      author: payload.author || 'developer',
    };

    project.chronicle.unshift(event);
    project.updatedAt = now;

    return event;
  }

  /**
   * Overall Port Shield & Projectarium HUD metrics
   */
  public getStats(): ProjectShieldStats {
    let totalApps = 0;
    let onlineApps = 0;
    let degradedApps = 0;
    let evictedApps = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const project of this.projects.values()) {
      for (const app of project.apps) {
        totalApps++;
        if (app.status === 'ONLINE') onlineApps++;
        else if (app.status === 'DEGRADED') degradedApps++;
        else if (app.status === 'EVICTED') evictedApps++;

        if (app.pingLatencyMs && app.status !== 'EVICTED') {
          totalLatency += app.pingLatencyMs;
          latencyCount++;
        }
      }
    }

    return {
      totalProjects: this.projects.size,
      totalApps,
      onlineApps,
      degradedApps,
      evictedApps,
      zeroDeadlockRootCount: this.reservedPorts.size,
      averageLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
    };
  }
}
