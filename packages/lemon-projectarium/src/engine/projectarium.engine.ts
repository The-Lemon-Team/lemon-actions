/**
 * Lemon Actions — Lemon-Projectarium Stand Engine
 *
 * Implements the Smart Upsert Handler ("Upsert on First Touch"), Port Shield
 * port allocation, dual-level reactive todo checklists, and immutable chronicle logs.
 */

import {
  ProjectariumApp,
  ProjectariumEvent,
  ProjectariumProject,
  ProjectariumRegisterPayload,
  ProjectariumRegisterResponse,
  ProjectariumScope,
  ProjectariumTodoItem,
  ProjectShieldStats,
} from '../types/projectarium.types';

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

    // 1. Lemon Seasons Stand
    const seasonsProject: ProjectariumProject = {
      id: 'stand-seasons',
      name: 'Lemon Seasons',
      slug: 'seasons',
      neuronWorkspace: 'workspace.seasons',
      projectToken: 'proj_seasons_sec_4f9a12',
      context: {
        domain: 'Seasonal Content & Calendar Engine',
        environment: 'staging',
        stack: ['Angular', 'NestJS', 'PostgreSQL', 'Redis'],
        description: 'Multi-season campaign engine, calendar planner, and feed distribution CMS.',
      },
      apps: [
        {
          id: 'app-seasons-cal',
          appName: 'Calendar - app',
          port: 5173,
          instanceId: 'inst_seasons_cal_01',
          leaseToken: 'lease_seasons_cal_9912',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:5173/health',
          lastPingAt: now,
          pingLatencyMs: 14,
          consecutiveFailures: 0,
          registeredAt: now,
        },
        {
          id: 'app-seasons-admin',
          appName: 'Admin - cms',
          port: 3002,
          instanceId: 'inst_seasons_cms_01',
          leaseToken: 'lease_seasons_cms_8821',
          environment: 'staging',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:3002/health',
          lastPingAt: now,
          pingLatencyMs: 19,
          consecutiveFailures: 0,
          registeredAt: now,
        },
        {
          id: 'app-seasons-backend',
          appName: 'Lemon-seasons backend',
          port: 3001,
          instanceId: 'inst_seasons_api_01',
          leaseToken: 'lease_seasons_api_7733',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:3001/health',
          lastPingAt: now,
          pingLatencyMs: 8,
          consecutiveFailures: 0,
          registeredAt: now,
        },
        {
          id: 'app-seasons-feed',
          appName: 'Feed-app',
          port: 8081,
          instanceId: 'inst_seasons_feed_01',
          leaseToken: 'lease_seasons_feed_6644',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:8081/health',
          lastPingAt: now,
          pingLatencyMs: 22,
          consecutiveFailures: 0,
          registeredAt: now,
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
      chronicle: [
        {
          id: 'ev-s-1',
          type: 'PROJECT_CREATED',
          scope: 'PROJECT',
          description: 'Проект Lemon Seasons зарегистрирован в инфраструктурном стэнде',
          timestamp: now,
          author: 'system',
        },
        {
          id: 'ev-s-2',
          type: 'APP_REGISTERED',
          scope: 'APP',
          targetAppName: 'Calendar - app',
          description: 'Приложение Calendar - app привязано к порту :5173 (Shield Verified)',
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
        description: 'Core infrastructure hub: Port Shield, Combinator flows, and autonomous workers.',
      },
      apps: [
        {
          id: 'app-actions-db',
          appName: 'Core combinator',
          port: 5433,
          instanceId: 'inst_actions_comb_01',
          leaseToken: 'lease_actions_comb_1100',
          environment: 'dev',
          networkMode: 'local',
          status: 'ONLINE',
          healthUrl: 'http://localhost:5433',
          lastPingAt: now,
          pingLatencyMs: 3,
          consecutiveFailures: 0,
          registeredAt: now,
        },
        {
          id: 'app-actions-web',
          appName: 'Lemon actions',
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
        },
        {
          id: 'app-actions-shield',
          appName: 'Port Shield',
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
        },
        {
          id: 'app-actions-watchers',
          appName: 'Lemon Watchers',
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
          targetAppName: 'Port Shield',
          createdAt: now,
          completedAt: now,
          author: 'Security Bot',
          priority: 'HIGH',
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
          targetAppName: 'Port Shield',
          description: 'Port Shield активирован на порту :3000 в режиме Zero-Deadlock',
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
        },
        {
          id: 'app-sd-lan',
          appName: 'Lan port',
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
        },
        {
          id: 'app-sd-media',
          appName: 'Media gateway port',
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
        },
        {
          id: 'app-sd-funnel',
          appName: 'Funnel tunnel',
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
        },
        {
          id: 'app-sd-prod',
          appName: 'Prod port',
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

    this.projects.set(seasonsProject.id, seasonsProject);
    this.projects.set(actionsProject.id, actionsProject);
    this.projects.set(sportdropProject.id, sportdropProject);
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
      const projectId = `stand-${slug}-${Date.now().toString(36)}`;
      const randomSecret = Math.random().toString(36).substring(2, 8);
      const projectToken = `proj_${slug}_${randomSecret}`;

      project = {
        id: projectId,
        name: rawName,
        slug: slug,
        neuronWorkspace: `workspace.${slug}`,
        projectToken: projectToken,
        context: payload.context || {
          createdBy: payload.author || 'autonomous-agent',
          bootstrapMode: 'smart-upsert',
          env: payload.environment || 'dev',
        },
        apps: [],
        todos: [],
        chronicle: [
          {
            id: `ev-init-${Date.now()}`,
            type: 'PROJECT_CREATED',
            scope: 'PROJECT',
            description: `Стенд "${rawName}" автоматически создан через Smart Handler (first touch)`,
            timestamp: now,
            author: payload.author || 'autonomous-agent',
            metadata: { neuronWorkspace: `workspace.${slug}` },
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      // Add initial todos if passed
      if (payload.initialTodos && payload.initialTodos.length > 0) {
        for (const todoTitle of payload.initialTodos) {
          project.todos.push({
            id: `todo-${Math.random().toString(36).substring(2, 9)}`,
            title: todoTitle,
            completed: false,
            scope: 'PROJECT',
            createdAt: now,
            author: payload.author || 'autonomous-agent',
            priority: 'HIGH',
          });
        }
      }

      this.projects.set(project.id, project);
    }

    // 3. Allocate port & create application instance
    const appName = payload.appName || `${project.slug}-core`;
    const allocatedPort = this.allocatePort(payload.preferredPort);
    const instanceId = `inst_${project.slug}_${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`;
    const leaseToken = `lease_${Math.random().toString(36).substring(2, 12)}`;

    const newApp: ProjectariumApp = {
      id: `app-${project.slug}-${Date.now().toString(36)}`,
      appName: appName,
      port: allocatedPort,
      instanceId: instanceId,
      leaseToken: leaseToken,
      environment: payload.environment || 'dev',
      networkMode: payload.networkMode || 'local',
      status: 'ONLINE',
      healthUrl: payload.healthUrl || `http://localhost:${allocatedPort}/health`,
      lastPingAt: now,
      pingLatencyMs: Math.floor(Math.random() * 15) + 5,
      consecutiveFailures: 0,
      registeredAt: now,
    };

    project.apps.push(newApp);
    project.updatedAt = now;

    // 4. Chronicle log
    const event: ProjectariumEvent = {
      id: `ev-reg-${Date.now().toString(36)}`,
      type: 'APP_REGISTERED',
      scope: 'APP',
      targetAppName: newApp.appName,
      description: `Приложение ${newApp.appName} выделен защищенный порт :${allocatedPort} [${newApp.networkMode}]`,
      timestamp: now,
      author: payload.author || 'autonomous-agent',
      metadata: {
        instanceId: newApp.instanceId,
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
   * Simulate failure (Circuit Breaker demo)
   */
  public simulateFailure(
    tokenOrSlug: string,
    instanceId: string
  ): { app?: ProjectariumApp; evicted: boolean; consecutiveFailures: number } {
    const project = this.findProject(tokenOrSlug);
    if (!project) return { evicted: false, consecutiveFailures: 0 };

    const app = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
    if (!app) return { evicted: false, consecutiveFailures: 0 };

    app.consecutiveFailures++;
    const now = new Date().toISOString();
    let evicted = false;

    if (app.consecutiveFailures >= 5) {
      app.status = 'EVICTED';
      evicted = true;
      project.chronicle.unshift({
        id: `ev-evict-${Date.now().toString(36)}`,
        type: 'APP_EVICTED',
        scope: 'APP',
        targetAppName: app.appName,
        description: `Приложение ${app.appName} превысило лимит сбоев (${app.consecutiveFailures}/5) и было EVICTED`,
        timestamp: now,
        author: 'circuit-breaker',
      });
    } else if (app.consecutiveFailures >= 2) {
      app.status = 'DEGRADED';
      project.chronicle.unshift({
        id: `ev-deg-${Date.now().toString(36)}`,
        type: 'APP_DEGRADED',
        scope: 'APP',
        targetAppName: app.appName,
        description: `Приложение ${app.appName} зафиксировало сбой (${app.consecutiveFailures}/5) -> DEGRADED`,
        timestamp: now,
        author: 'circuit-breaker',
      });
    }

    project.updatedAt = now;
    return { app, evicted, consecutiveFailures: app.consecutiveFailures };
  }

  /**
   * Heartbeat ping recovery
   */
  public heartbeat(tokenOrSlug: string, instanceId: string, latencyMs = 12): boolean {
    const project = this.findProject(tokenOrSlug);
    if (!project) return false;

    const app = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
    if (!app) return false;

    app.consecutiveFailures = 0;
    app.status = 'ONLINE';
    app.lastPingAt = new Date().toISOString();
    app.pingLatencyMs = latencyMs;
    project.updatedAt = new Date().toISOString();

    return true;
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
