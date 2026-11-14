import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ProjectStand,
  StandAppItem,
  StandAppStatus,
  StandNoteItem,
} from '../models/project-stand.models';
import { AppEnvironment, AppNetworkMode } from '../models/health-checker.models';
import { LemonCardColor } from '../models/worker.models';
import { ProjectSessionLogEntry } from '../models/chronicle-card.models';
import { ReactiveTodoItem, ReactiveTriggerType } from '../models/todo-card.models';
import { LemonChronicleService } from './lemon-chronicle.service';
import { ServiceHealthService } from './service-health.service';
import { LemonWorkerService } from './lemon-worker.service';

const STANDS_STORAGE_KEY = 'lemon_actions_project_stands_v1';
const PARTY_STAND_SEEDED_KEY = 'lemon_actions_projectarium_party_seeded_v1';

function extractHostFromUrl(url?: string): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return new URL(trimmed).hostname || undefined;
  } catch {
    const match = trimmed.match(/^(?:[a-z]+:\/\/)?([^/:?#\s]+)/i);
    return match?.[1] || undefined;
  }
}

function resolveAppHost(host?: string, url?: string): string {
  const explicit = host?.trim();
  if (explicit) {
    return explicit;
  }
  return extractHostFromUrl(url) || 'localhost';
}

function buildAppUrl(host: string, port: number, networkMode: AppNetworkMode): string {
  if (networkMode === 'tailscale-funnel') {
    return port === 443 ? `https://${host}/health` : `https://${host}:${port}/health`;
  }
  return `http://${host}:${port}/health`;
}

function inferAppIcon(appName: string, networkMode: AppNetworkMode): string {
  const lower = appName.toLowerCase();
  if (networkMode === 'tailscale-funnel') return 'public';
  if (networkMode === 'tailscale-lan') return 'hub';
  if (lower.includes('gateway') || lower.includes('nginx')) return 'router';
  if (lower.includes('db') || lower.includes('postgres')) return 'database';
  if (lower.includes('cal')) return 'calendar_month';
  if (lower.includes('cms') || lower.includes('admin')) return 'admin_panel_settings';
  if (lower.includes('feed')) return 'rss_feed';
  if (lower.includes('media')) return 'video_library';
  if (lower.includes('backend') || lower.includes('api')) return 'dns';
  if (networkMode === 'lan') return 'lan';
  return 'terminal';
}

const INITIAL_PROJECT_STANDS: ProjectStand[] = [
  // 1. LEMON SEASONS (deployed on remote host 192.168.1.100)
  {
    id: 'stand-seasons',
    name: 'Lemon Seasons',
    slug: 'seasons',
    description:
      'Развернутый кластер Lemon Seasons на удаленном хосте 192.168.1.100: Gateway (:8090), Backend (:3001), Admin CMS (:5173), Calendar (:5174), Feed (:5175), PostgreSQL (:5435).',
    color: 'amber',
    isPinned: true,
    neuronPath: 'workspace.seasons',
    tags: ['REMOTE_192_168_1_100', 'GATEWAY', 'CALENDAR', 'CMS', 'FEED', 'BACKEND', 'POSTGRES'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [
      {
        id: 'app-seasons-gateway',
        appName: 'Lemon-seasons gateway',
        role: 'Nginx Gateway — единый вход (/api, /calendar/, /admin/, /)',
        host: '192.168.1.100',
        port: 8090,
        url: 'http://192.168.1.100:8090/health',
        instanceId: 'inst_seasons_gw_01',
        leaseToken: 'lease_seasons_gw_8090',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 11,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'router',
      },
      {
        id: 'app-seasons-backend',
        appName: 'Lemon-seasons backend',
        role: 'NestJS API, сессии, синхронизация и события',
        host: '192.168.1.100',
        port: 3001,
        url: 'http://192.168.1.100:3001/api/health',
        instanceId: 'inst_seasons_api_01',
        leaseToken: 'lease_seasons_api_7733',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 8,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'dns',
      },
      {
        id: 'app-seasons-admin',
        appName: 'Admin - cms',
        role: 'Панель управления контентом и сезонами (CMS)',
        host: '192.168.1.100',
        port: 5173,
        url: 'http://192.168.1.100:5173/',
        instanceId: 'inst_seasons_cms_01',
        leaseToken: 'lease_seasons_cms_8821',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 14,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'admin_panel_settings',
      },
      {
        id: 'app-seasons-cal',
        appName: 'Calendar - app',
        role: 'Интерактивный календарный интерфейс',
        host: '192.168.1.100',
        port: 5174,
        url: 'http://192.168.1.100:5174/',
        instanceId: 'inst_seasons_cal_01',
        leaseToken: 'lease_seasons_cal_9912',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 14,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'calendar_month',
      },
      {
        id: 'app-seasons-feed',
        appName: 'Feed-app',
        role: 'Лента публикаций и контентных фидов',
        host: '192.168.1.100',
        port: 5175,
        url: 'http://192.168.1.100:5175/',
        instanceId: 'inst_seasons_feed_01',
        leaseToken: 'lease_seasons_feed_6644',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 16,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'rss_feed',
      },
      {
        id: 'app-seasons-db',
        appName: 'Lemon-seasons DB',
        role: 'PostgreSQL 16 (lemon_calendarium)',
        host: '192.168.1.100',
        port: 5435,
        url: 'postgresql://192.168.1.100:5435/lemon_calendarium',
        instanceId: 'inst_seasons_db_01',
        leaseToken: 'lease_seasons_db_5435',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 4,
        lastCheckedAt: new Date(Date.now() - 60000 * 5).toISOString(),
        consecutiveFailures: 0,
        icon: 'database',
      },
    ],
    chronicle: [
      {
        id: 'log-sea-1',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        type: 'DEPLOY',
        author: 'Developer',
        title: 'Развернут кластер Lemon Seasons на 192.168.1.100 (6 контейнеров)',
        details: 'Gateway (:8090), Backend (:3001), Admin (:5173), Calendar (:5174), Feed (:5175), DB (:5435)',
        latencyMs: 14,
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
        text: 'Проверить готовность Lemon-seasons backend на 192.168.1.100:3001',
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
    notes: [
      {
        id: 'note-sea-1',
        title: 'Интеграция с хабом и медиа-вложениями',
        content: 'Lemon Seasons готов выступать хабом хранения заметок, тегов и медиа-метаданных через SeasonsCombinatorBridge.',
        author: 'Alex (Lead Dev)',
        tags: ['HUB', 'SEASONS', 'MEDIA'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 2. LEMON ACTIONS
  {
    id: 'stand-actions',
    name: 'Lemon Actions',
    slug: 'actions',
    description: 'Реактивный комбинатор потоков, Port Shield и Projectarium: локальный dev (localhost) и удаленный кластер (192.168.1.100)',
    color: 'lemon',
    isPinned: true,
    neuronPath: 'workspace.actions',
    tags: ['CORE_COMBINATOR', 'ACTIONS', 'PORT_SHIELD', 'LOCALHOST', 'REMOTE_192_168_1_100'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [
      {
        id: 'app-act-core',
        appName: 'Core combinator (Dev DB)',
        role: 'Локальная PostgreSQL 15 база потоков и стендов',
        host: 'localhost',
        port: 5433,
        url: 'postgresql://localhost:5433/lemon_db',
        instanceId: 'inst_actions_comb_01',
        leaseToken: 'lease_actions_comb_1100',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 3,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'database',
      },
      {
        id: 'app-act-web',
        appName: 'Lemon actions (Dev Web)',
        role: 'Локальный Angular UI (основная консоль)',
        host: 'localhost',
        port: 4201,
        url: 'http://localhost:4201',
        instanceId: 'inst_actions_web_01',
        leaseToken: 'lease_actions_web_2200',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 11,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'style',
      },
      {
        id: 'app-act-proj-ui',
        appName: 'Projectarium UI (Dev)',
        role: 'Standalone Projectarium Cockpit (HMR dev)',
        host: 'localhost',
        port: 4203,
        url: 'http://localhost:4203/projectarium',
        instanceId: 'inst_actions_proj_ui_01',
        leaseToken: 'lease_actions_proj_4203',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 9,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'domain',
      },
      {
        id: 'app-act-shield',
        appName: 'Port Shield (Dev API)',
        role: 'Локальный NestJS API & Port Shield Registrar',
        host: 'localhost',
        port: 3000,
        url: 'http://localhost:3000/api/health',
        instanceId: 'inst_actions_shield_01',
        leaseToken: 'lease_actions_shield_3300',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 6,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'verified_user',
      },
      {
        id: 'app-act-watchers',
        appName: 'Lemon Watchers',
        role: 'Монитор файловых импульсов и триггеры событий',
        host: 'localhost',
        port: 4301,
        url: 'http://localhost:4301/health',
        instanceId: 'inst_actions_watchers_01',
        leaseToken: 'lease_actions_watchers_4400',
        environment: 'dev',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 15,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'visibility',
      },
      {
        id: 'app-act-remote-web',
        appName: 'Lemon Core Web (Remote)',
        role: 'Production Web UI на удаленном хосте (также :80)',
        host: '192.168.1.100',
        port: 4201,
        url: 'http://192.168.1.100:4201',
        instanceId: 'inst_actions_remote_web_01',
        leaseToken: 'lease_actions_rem_web_4201',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 12,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'public',
      },
      {
        id: 'app-act-remote-api',
        appName: 'Lemon Core API (Remote)',
        role: 'Production NestJS API и Port Shield на 192.168.1.100',
        host: '192.168.1.100',
        port: 3000,
        url: 'http://192.168.1.100:3000/api/health',
        instanceId: 'inst_actions_remote_api_01',
        leaseToken: 'lease_actions_rem_api_3000',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 9,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'dns',
      },
      {
        id: 'app-act-remote-db',
        appName: 'Lemon Core DB (Remote)',
        role: 'Production PostgreSQL 15 на 192.168.1.100',
        host: '192.168.1.100',
        port: 5432,
        url: 'postgresql://192.168.1.100:5432/lemon_db',
        instanceId: 'inst_actions_remote_db_01',
        leaseToken: 'lease_actions_rem_db_5432',
        environment: 'production',
        networkMode: 'lan',
        status: 'HEALTHY',
        lastLatencyMs: 5,
        lastCheckedAt: new Date(Date.now() - 60000 * 2).toISOString(),
        consecutiveFailures: 0,
        icon: 'database',
      },
    ],
    chronicle: [
      {
        id: 'log-act-1',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        type: 'DEPLOY',
        author: 'Agent-Antigravity',
        title: 'Развёрнут Port Shield на localhost и 192.168.1.100',
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
        details: 'Объединены здоровье сервисов, адреса хостов, история и реактивные задачи',
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
    notes: [
      {
        id: 'note-act-1',
        title: 'Обвязки lemon-core',
        content: 'Ядро потоков (CONTEXT, MUTEX, OBSERVER, FSM, PROJECTION, BATCH) и SDK обвязки в приоритете. После завершения возвращаемся к перенесению прототипов Lemon-Party.',
        author: 'Lead Architect',
        tags: ['LEMON_CORE', 'FLOWS', 'SDK'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
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
        host: 'localhost',
        port: 4310,
        url: 'http://localhost:4310/health',
        instanceId: 'inst_sd_dev_01',
        leaseToken: 'lease_sd_dev_5511',
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
        host: '100.100.1.5',
        port: 4311,
        url: 'http://100.100.1.5:4311/health',
        instanceId: 'inst_sd_lan_01',
        leaseToken: 'lease_sd_lan_5522',
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
        host: 'localhost',
        port: 4312,
        url: 'http://localhost:4312/metrics',
        instanceId: 'inst_sd_media_01',
        leaseToken: 'lease_sd_media_5533',
        environment: 'staging',
        networkMode: 'local',
        status: 'HEALTHY',
        lastLatencyMs: 18,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'video_library',
      },
      {
        id: 'app-sd-funnel',
        appName: 'Funnel tunnel',
        role: 'Публичный туннель Tailscale Funnel для мобильных клиентов',
        host: 'sportdrop-funnel.lemon.ts.net',
        port: 443,
        url: 'https://sportdrop-funnel.lemon.ts.net',
        instanceId: 'inst_sd_funnel_01',
        leaseToken: 'lease_sd_funnel_5544',
        environment: 'production',
        networkMode: 'tailscale-funnel',
        status: 'HEALTHY',
        lastLatencyMs: 45,
        lastCheckedAt: new Date(Date.now() - 60000 * 10).toISOString(),
        consecutiveFailures: 0,
        icon: 'public',
      },
      {
        id: 'app-sd-prod',
        appName: 'Prod port',
        role: 'Основной продуктовый порт с SSL/TLS терминацией',
        host: 'sportdrop-prod.lemon.ts.net',
        port: 8443,
        url: 'https://sportdrop-prod.lemon.ts.net:8443',
        instanceId: 'inst_sd_prod_01',
        leaseToken: 'lease_sd_prod_5555',
        environment: 'production',
        networkMode: 'tailscale-funnel',
        status: 'HEALTHY',
        lastLatencyMs: 38,
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
    notes: [],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // 4. LEMON-PARTY
  {
    id: 'stand-lemon-party',
    name: 'Lemon-Party',
    slug: 'lemon-party',
    projectToken: 'proj_party_arena_9012de',
    description:
      'Проекты и игровые режимы на базе Lemon-Party: асинхронные заметки сквозь время, таймлайны дня и героев, карточки персонажей и желаний.',
    color: 'lavender',
    isPinned: true,
    neuronPath: 'workspace.party',
    tags: ['LEMON_PARTY', 'TIME_TRAVELING', 'TIMELINE', 'HERO_CARDS', 'FSM'],
    environments: ['dev', 'staging', 'production'],
    activeEnvironment: 'ALL',
    apps: [],
    chronicle: [
      {
        id: 'log-lp-1',
        timestamp: new Date().toISOString(),
        type: 'MILESTONE',
        author: 'System',
        title: 'Проект Lemon-Party выделен в отдельный стенд Projectarium',
        details: 'Добавлена заметка по ключевым режимам: Time Traveling, Timeline (Day / Hero), Hero Cards',
        badge: 'STAND_INIT',
      },
    ],
    todos: [
      {
        id: 'todo-lp-1',
        text: 'Закончить все обвязки для lemon-core перед возвращением к режимам Lemon-Party',
        completed: false,
        isReactive: false,
        scope: 'PROJECT',
        priority: 'HIGH',
      },
      {
        id: 'todo-lp-2',
        text: 'Спроектировать прототип Time Traveling (вручную + Stitch) и выделить золотую середину',
        completed: false,
        isReactive: false,
        scope: 'PROJECT',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
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
            return this.mapBackendProjectToStand(p, existing);
          });
          this.persist(merged);
        }
      },
      error: () => {
        // Fallback to loaded stands
      },
    });
  }

  private mapBackendProjectToStand(p: any, existing?: ProjectStand): ProjectStand {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      projectToken: p.projectToken,
      description: p.context?.description || existing?.description || `Пространство проекта ${p.name}`,
      color:
        p.context?.color ||
        existing?.color ||
        (p.slug === 'seasons'
          ? 'amber'
          : p.slug === 'actions'
            ? 'lemon'
            : p.slug === 'lemon-party'
              ? 'lavender'
              : 'sky'),
      isPinned: p.context?.isPinned ?? existing?.isPinned ?? true,
      neuronPath: p.neuronWorkspace || `workspace.${p.slug}`,
      tags: p.context?.tags || existing?.tags || [p.slug.toUpperCase(), 'STAND'],
      environments: p.context?.environments || existing?.environments || ['dev', 'staging', 'production'],
      activeEnvironment: existing?.activeEnvironment || 'ALL',
      apps: (p.apps || []).map((a: any) => {
        const existingApp = existing?.apps.find((ea) => ea.appName === a.appName);
        const networkMode: AppNetworkMode = a.networkMode || 'local';
        const host = resolveAppHost(a.host || a.metadata?.host || existingApp?.host, a.healthUrl);
        return {
          id: a.id,
          appName: a.appName,
          role: a.metadata?.role || existingApp?.role || 'Сервис стенда',
          host,
          port: a.port,
          url: a.healthUrl || buildAppUrl(host, a.port, networkMode),
          instanceId: a.instanceId,
          leaseToken: a.leaseToken,
          environment: a.environment || 'dev',
          networkMode,
          status: a.status === 'ONLINE' ? 'HEALTHY' : (a.status as StandAppStatus),
          lastLatencyMs: a.pingLatencyMs ?? 0,
          lastCheckedAt: a.lastPingAt || new Date().toISOString(),
          consecutiveFailures: a.consecutiveFailures || 0,
          icon: a.metadata?.icon || existingApp?.icon || inferAppIcon(a.appName, networkMode),
        };
      }),
      todos: (p.todos || []).map((t: any) => ({
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
      notes: Array.isArray(p.notes)
        ? p.notes.map((n: any) => ({
            id: n.id,
            title: n.title || undefined,
            content: n.content,
            author: n.author || 'developer',
            tags: Array.isArray(n.tags) ? n.tags : [],
            createdAt: n.createdAt,
            updatedAt: n.updatedAt || n.createdAt,
          }))
        : existing?.notes || [],
      chronicle: (p.chronicle || []).map((c: any) => ({
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
  }

  private loadStands(): ProjectStand[] {
    try {
      const saved = localStorage.getItem(STANDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized: ProjectStand[] = parsed.map((stand: any) => ({
            ...stand,
            notes: Array.isArray(stand.notes) ? stand.notes : [],
          }));
          const alreadySeededParty = localStorage.getItem(PARTY_STAND_SEEDED_KEY) === '1';
          if (!alreadySeededParty && !normalized.some((s) => s.slug === 'lemon-party')) {
            const partyDefault = INITIAL_PROJECT_STANDS.find((s) => s.slug === 'lemon-party');
            if (partyDefault) {
              normalized.push(partyDefault);
            }
            localStorage.setItem(PARTY_STAND_SEEDED_KEY, '1');
          }
          return normalized;
        }
      }
    } catch {
      // fallback
    }
    try {
      localStorage.setItem(PARTY_STAND_SEEDED_KEY, '1');
    } catch {
      // storage unavailable
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
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newStand, ...current];
    this.persist(updated);

    this.http
      .post('/api/projectarium/projects', {
        projectName: newStand.name,
        projectSlug: newStand.slug,
        neuronWorkspace: newStand.neuronPath,
        context: {
          description: newStand.description,
          color: newStand.color,
          tags: newStand.tags,
          environments: newStand.environments,
          isPinned: newStand.isPinned,
        },
        initialTodos: newStand.todos.map((t) => t.text),
        author: 'cockpit-ui',
      })
      .subscribe({
        next: () => this.fetchFromBackend(),
        error: () => {},
      });

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
      host?: string;
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

    const fallbackHost =
      appData.networkMode === 'tailscale-funnel'
        ? `${appData.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts.net`
        : appData.networkMode === 'tailscale-lan'
          ? `100.64.0.${(port % 100) + 10}`
          : appData.networkMode === 'lan'
            ? '192.168.1.100'
            : 'localhost';

    const host = appData.host?.trim() || extractHostFromUrl(appData.customUrl) || fallbackHost;
    const url = appData.customUrl?.trim() || buildAppUrl(host, port, appData.networkMode);
    const defaultIcon = inferAppIcon(appData.appName, appData.networkMode);

    const newApp: StandAppItem = {
      id: 'app-' + Math.random().toString(36).substring(2, 8),
      appName: appData.appName.trim(),
      role: appData.role.trim() || 'Микросервис стенда',
      host,
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
      details: `Адрес ${host}:${port} [${newApp.environment.toUpperCase()} | ${newApp.networkMode}]`,
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
      `В стенд «${stand.name}» добавлено приложение «${newApp.appName}» (${host}:${port})`,
    );

    this.http
      .post(`/api/projectarium/projects/${stand.slug}/apps`, {
        appName: newApp.appName,
        host: newApp.host,
        role: newApp.role,
        icon: newApp.icon,
        preferredPort: appData.desiredPort && appData.desiredPort > 0 ? appData.desiredPort : undefined,
        environment: newApp.environment,
        networkMode: newApp.networkMode,
        healthUrl: newApp.url,
        author: 'cockpit-ui',
      })
      .subscribe({
        next: () => this.fetchFromBackend(),
        error: () => {},
      });

    return newApp;
  }

  removeAppFromStand(standId: string, appId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    const targetApp = stand?.apps.find((a) => a.id === appId || a.instanceId === appId);
    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      const target = s.apps.find((a) => a.id === appId || a.instanceId === appId);
      const remainingApps = s.apps.filter((a) => a.id !== appId && a.instanceId !== appId);

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

    if (stand && targetApp) {
      this.http
        .delete(`/api/projectarium/projects/${stand.slug}/apps/${targetApp.instanceId || targetApp.id}`)
        .subscribe({ error: () => {} });
    }
  }

  /**
   * Executes a real server-side healthcheck round (HTTP/TCP) for all apps in a project stand.
   */
  pingStandApps(standId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) return;

    const checkingStands = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            apps: s.apps.map((app) => ({ ...app, status: 'CHECKING' as StandAppStatus })),
          }
        : s,
    );
    this.persist(checkingStands);

    this.http.post<any>(`/api/projectarium/projects/${stand.slug}/ping`, {}).subscribe({
      next: (updatedProject) => {
        const current = this.stands$.getValue();
        const currentStand = current.find((s) => s.id === standId) || stand;
        const mapped = this.mapBackendProjectToStand(updatedProject, currentStand);
        const nextStands = current.map((s) => (s.id === standId ? mapped : s));
        this.persist(nextStands);

        const onlineCount = mapped.apps.filter((a) => a.status === 'HEALTHY').length;
        this.chronicleService.dispatchReactiveImpulse(
          'HEALTHCHECK_PING',
          `Здоровье стенда «${mapped.name}» проверено (${onlineCount}/${mapped.apps.length} UP)`,
        );
      },
      error: () => {
        const now = new Date().toISOString();
        const current = this.stands$.getValue();
        const failLog: ProjectSessionLogEntry = {
          id: 'log-' + Math.random().toString(36).substring(2, 7),
          timestamp: now,
          type: 'SERVICE_EVENT',
          author: 'Health-Checker',
          title: 'Не удалось выполнить healthcheck стенда: API Projectarium недоступен',
          badge: 'PING_ERROR',
        };

        const reverted = current.map((s) =>
          s.id === standId
            ? {
                ...s,
                apps: stand.apps,
                chronicle: [failLog, ...s.chronicle],
                updatedAt: now,
              }
            : s,
        );
        this.persist(reverted);
      },
    });
  }

  addChronicleEntry(standId: string, entry: Omit<ProjectSessionLogEntry, 'id' | 'timestamp'>): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
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

    if (stand) {
      this.http
        .post(`/api/projectarium/projects/${stand.slug}/events`, {
          description: entry.title,
          scope: 'PROJECT',
          author: entry.author || 'cockpit-ui',
        })
        .subscribe({ error: () => {} });
    }
  }

  toggleTodoItem(standId: string, itemId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
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

    if (stand) {
      this.http
        .patch(`/api/projectarium/projects/${stand.slug}/todos/${itemId}/toggle`, {})
        .subscribe({ error: () => {} });
    }
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
    const stand = stands.find((s) => s.id === standId);
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

    if (stand) {
      this.http
        .post(`/api/projectarium/projects/${stand.slug}/todos`, {
          title: newItem.text,
          scope: 'PROJECT',
          priority: 'MEDIUM',
          author: 'cockpit-ui',
        })
        .subscribe({
          next: () => this.fetchFromBackend(),
          error: () => {},
        });
    }
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

  addNoteItem(
    standId: string,
    noteData: {
      title?: string;
      content: string;
      author?: string;
      tags?: string[];
    },
  ): void {
    const content = noteData.content.trim();
    if (!content) return;

    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    const now = new Date().toISOString();
    const cleanTags = noteData.tags?.map((t) => t.trim()).filter(Boolean) || [];

    const newNote: StandNoteItem = {
      id: 'note-' + Math.random().toString(36).substring(2, 9),
      title: noteData.title?.trim() || undefined,
      content,
      author: noteData.author?.trim() || 'Developer',
      tags: cleanTags,
      createdAt: now,
      updatedAt: now,
    };

    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: now,
      type: 'MILESTONE',
      author: newNote.author,
      title: `Добавлена заметка${newNote.title ? `: «${newNote.title}»` : ''}`,
      badge: 'NOTE_ADDED',
    };

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            notes: [newNote, ...(s.notes || [])],
            chronicle: [newLog, ...s.chronicle],
            updatedAt: now,
          }
        : s,
    );

    this.persist(updated);

    if (stand) {
      this.http
        .post(`/api/projectarium/projects/${stand.slug}/notes`, {
          title: newNote.title,
          content: newNote.content,
          author: newNote.author,
          tags: newNote.tags,
        })
        .subscribe({
          next: () => this.fetchFromBackend(),
          error: () => {},
        });
    }
  }

  updateNoteItem(
    standId: string,
    noteId: string,
    patch: {
      title?: string;
      content: string;
      tags?: string[];
    },
  ): void {
    const content = patch.content.trim();
    if (!content) return;

    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    const now = new Date().toISOString();
    const cleanTags = patch.tags?.map((t) => t.trim()).filter(Boolean);
    const nextTitle = patch.title?.trim() || undefined;

    const newLog: ProjectSessionLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: now,
      type: 'MILESTONE',
      author: 'Developer',
      title: `Обновлена заметка${nextTitle ? `: «${nextTitle}»` : ''}`,
      badge: 'NOTE_UPDATED',
    };

    const updated = stands.map((s) => {
      if (s.id !== standId) return s;
      return {
        ...s,
        notes: (s.notes || []).map((n) =>
          n.id === noteId
            ? {
                ...n,
                title: nextTitle,
                content,
                tags: cleanTags ?? n.tags,
                updatedAt: now,
              }
            : n,
        ),
        chronicle: [newLog, ...s.chronicle],
        updatedAt: now,
      };
    });

    this.persist(updated);

    if (stand) {
      this.http
        .patch(`/api/projectarium/projects/${stand.slug}/notes/${noteId}`, {
          title: nextTitle ?? '',
          content,
          tags: cleanTags,
        })
        .subscribe({
          next: () => this.fetchFromBackend(),
          error: () => {},
        });
    }
  }

  deleteNoteItem(standId: string, noteId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    const now = new Date().toISOString();

    const updated = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            notes: (s.notes || []).filter((n) => n.id !== noteId),
            updatedAt: now,
          }
        : s,
    );

    this.persist(updated);

    if (stand) {
      this.http
        .delete(`/api/projectarium/projects/${stand.slug}/notes/${noteId}`)
        .subscribe({ error: () => {} });
    }
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
    const target = stands.find((s) => s.id === standId);
    const updated = stands.filter((s) => s.id !== standId);
    this.persist(updated);

    if (target) {
      this.http.delete(`/api/projectarium/projects/${target.slug}`).subscribe({ error: () => {} });
    }
  }
}
