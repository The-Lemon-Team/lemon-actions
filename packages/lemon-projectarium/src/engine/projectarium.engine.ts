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
  ProjectariumHeartbeatResponse,
  ProjectariumNetworkMode,
  ProjectariumNoteItem,
  ProjectariumPoolItem,
  ProjectariumProject,
  ProjectariumRegisterPayload,
  ProjectariumRegisterResponse,
  ProjectariumReleaseResponse,
  ProjectariumScope,
  ProjectariumTodoItem,
  ProjectShieldStats,
} from '../types/projectarium.types';
import { buildDefaultHealthUrl, resolveAppHost, resolveMachineIdentity } from '../utils/address.utils';
import { createDefaultProjectariumStands } from '../seeds/default-stands.seed';

export class ProjectariumEngine {
  private projects: Map<string, ProjectariumProject> = new Map();
  private nextDynamicPort = 4320;
  private readonly reservedPorts = new Set<number>([
    5433, // PostgreSQL (Local Dev)
    5436, // PostgreSQL (Projectarium Prod)
    5437, // PostgreSQL (Projectarium Dev)
    3000, // API Gateway (Core)
    3200, // API Gateway (Projectarium Prod)
    4201, // Angular Web (Core)
    4202, // Coding Agent UI
    4205, // Projectarium Web Alt
    8088, // Projectarium Web Prod
  ]);

  constructor() {
    this.seedDefaultStands();
  }

  private normalizeHostKey(host?: string): string {
    const clean = (host || 'localhost').trim().toLowerCase();
    if (clean === '127.0.0.1' || clean === '::1' || clean === '0.0.0.0' || clean === '') {
      return 'localhost';
    }
    return clean;
  }

  private buildPortScopeKey(
    host?: string,
    networkMode: ProjectariumNetworkMode = 'local',
    machineId?: string,
  ): string {
    const normalizedHost = this.normalizeHostKey(host);
    if (networkMode === 'local' || normalizedHost === 'localhost') {
      const resolvedMachine = (machineId || 'local-default').trim().toLowerCase();
      return `local::${resolvedMachine}`;
    }
    return `remote::${normalizedHost}`;
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
   * Allocate a unique network port scoped by (machineId, localhost) for local apps
   * or by remote host for shared network apps, so PC-1 and PC-2 never collide.
   */
  private allocatePort(
    preferredPort?: number,
    targetHost = 'localhost',
    networkMode: ProjectariumNetworkMode = 'local',
    machineId = 'local-default',
  ): number {
    const targetScope = this.buildPortScopeKey(targetHost, networkMode, machineId);
    const activePortsInScope = new Set<number>();

    for (const project of this.projects.values()) {
      for (const app of project.apps) {
        if (app.status !== 'EVICTED') {
          const appHost = app.host || (app.metadata?.['host'] as string | undefined);
          const appMachineId =
            app.machineId || (app.metadata?.['machineId'] as string | undefined) || 'local-default';
          const appScope = this.buildPortScopeKey(appHost, app.networkMode, appMachineId);
          if (appScope === targetScope) {
            activePortsInScope.add(app.port);
          }
        }
      }
    }

    if (preferredPort && !activePortsInScope.has(preferredPort)) {
      return preferredPort;
    }

    let candidate = 4320;
    while (activePortsInScope.has(candidate) || this.reservedPorts.has(candidate)) {
      candidate++;
    }
    this.nextDynamicPort = Math.max(this.nextDynamicPort, candidate + 1);
    return candidate;
  }

  /**
   * Seed the four default project stands:
   * 1. Lemon Seasons
   * 2. Lemon Actions
   * 3. Lemon-Universe
   * 4. Sportdrop
   */
  private seedDefaultStands(): void {
    for (const project of createDefaultProjectariumStands()) {
      this.projects.set(project.id, project);
    }
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
    const networkMode: ProjectariumNetworkMode = payload.networkMode || 'local';
    const host = resolveAppHost(payload.host, payload.healthUrl);
    const machine = resolveMachineIdentity({
      machineId: payload.machineId || (payload.context?.['machineId'] as string | undefined),
      machineName: payload.machineName || (payload.context?.['machineName'] as string | undefined),
      networkMode,
      host,
    });
    const allocatedPort = this.allocatePort(payload.preferredPort, host, networkMode, machine.machineId);
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
      machineId: machine.machineId,
      machineName: machine.machineName,
      status: 'ONLINE',
      healthUrl,
      lastPingAt: now,
      pingLatencyMs: Math.floor(Math.random() * 15) + 5,
      consecutiveFailures: 0,
      registeredAt: now,
      metadata: {
        ...(payload.context ?? {}),
        host,
        machineId: machine.machineId,
        machineName: machine.machineName,
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
      description: `Приложение ${newApp.appName} — ${host}:${allocatedPort} [${newApp.networkMode} · ${machine.machineName}]`,
      timestamp: now,
      author: payload.author || 'autonomous-agent',
      metadata: {
        instanceId: newApp.instanceId,
        host,
        port: newApp.port,
        leaseToken: newApp.leaseToken,
        machineId: machine.machineId,
        machineName: machine.machineName,
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
   * List all projects (unfiltered internal state)
   */
  public listProjects(): ProjectariumProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * List projects filtered for a specific viewer:
   * - Public / shared apps (networkMode !== 'local') are always included.
   * - Localhost apps (networkMode === 'local') are only included for the matching machineId
   *   (or when includeAllLocal is true).
   */
  public listProjectsForViewer(options?: {
    machineId?: string;
    includeAllLocal?: boolean;
  }): ProjectariumProject[] {
    const normalizedViewerMachine = options?.machineId?.trim().toLowerCase();
    return Array.from(this.projects.values()).map((project) => ({
      ...project,
      apps: project.apps.filter((app) => {
        if (app.networkMode !== 'local') {
          return true;
        }
        if (options?.includeAllLocal) {
          return true;
        }
        if (!normalizedViewerMachine) {
          return false;
        }
        const appMachine = (
          app.machineId ||
          (app.metadata?.['machineId'] as string | undefined) ||
          'local-default'
        )
          .trim()
          .toLowerCase();
        return appMachine === normalizedViewerMachine;
      }),
    }));
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
        const machine = resolveMachineIdentity({
          machineId: app.machineId || (app.metadata?.['machineId'] as string | undefined),
          machineName: app.machineName || (app.metadata?.['machineName'] as string | undefined),
          networkMode: app.networkMode,
          host: app.host,
        });
        app.machineId = machine.machineId;
        app.machineName = machine.machineName;
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
   * Find an application instance across all project stands by instanceId or app id
   */
  public findAppByInstanceId(
    instanceId: string,
  ): { project: ProjectariumProject; app: ProjectariumApp } | undefined {
    for (const project of this.projects.values()) {
      const app = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
      if (app) {
        return { project, app };
      }
    }
    return undefined;
  }

  /**
   * Release an app instance from a project
   */
  public releaseApp(tokenOrSlug: string, instanceId: string, author = 'user'): boolean {
    const project = this.findProject(tokenOrSlug);
    if (!project) return false;
    return this.removeAppFromProject(project, instanceId, author) !== undefined;
  }

  private removeAppFromProject(
    project: ProjectariumProject,
    instanceId: string,
    author: string,
  ): ProjectariumApp | undefined {
    const index = project.apps.findIndex((a) => a.instanceId === instanceId || a.id === instanceId);
    if (index === -1) return undefined;

    const [app] = project.apps.splice(index, 1);
    const now = new Date().toISOString();
    project.updatedAt = now;

    project.chronicle.unshift({
      id: `ev-rel-${Date.now().toString(36)}`,
      type: 'APP_RELEASED',
      scope: 'APP',
      targetAppName: app.appName,
      description: `Приложение ${app.appName} (порт :${app.port}) освобождено и удалено из пула`,
      timestamp: now,
      author,
    });

    return app;
  }

  /**
   * Renew lease for an active application instance using instanceId + leaseToken
   */
  public heartbeat(
    instanceId: string,
    leaseToken: string,
  ):
    | { ok: true; project: ProjectariumProject; result: ProjectariumHeartbeatResponse }
    | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TOKEN' } {
    const match = this.findAppByInstanceId(instanceId);
    if (!match) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    const { project, app } = match;
    if (app.leaseToken !== leaseToken) {
      return { ok: false, reason: 'INVALID_TOKEN' };
    }

    const now = new Date().toISOString();
    const prevStatus = app.status;
    app.lastPingAt = now;
    app.consecutiveFailures = 0;
    app.status = 'ONLINE';
    project.updatedAt = now;

    if (prevStatus !== 'ONLINE') {
      project.chronicle.unshift({
        id: `ev-hb-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        type: 'APP_HEARTBEAT',
        scope: 'APP',
        targetAppName: app.appName,
        description: `Lease-токен подтверждён (heartbeat) для ${app.appName} на порту :${app.port}`,
        timestamp: now,
        author: 'lease-heartbeat',
      });
    }

    return {
      ok: true,
      project,
      result: {
        status: 'HEARTBEAT_ACK',
        projectSlug: project.slug,
        instanceId: app.instanceId,
        port: app.port,
        renewedAt: now,
      },
    };
  }

  /**
   * Gracefully release an application instance using instanceId + leaseToken
   */
  public releaseByLease(
    instanceId: string,
    leaseToken: string,
    author = 'agent',
  ):
    | { ok: true; project: ProjectariumProject; result: ProjectariumReleaseResponse }
    | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TOKEN' } {
    const match = this.findAppByInstanceId(instanceId);
    if (!match) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    const { project, app } = match;
    if (app.leaseToken !== leaseToken) {
      return { ok: false, reason: 'INVALID_TOKEN' };
    }

    const removed = this.removeAppFromProject(project, app.instanceId, author);
    const releasedAt = new Date().toISOString();

    return {
      ok: true,
      project,
      result: {
        status: 'RELEASED',
        projectSlug: project.slug,
        instanceId: (removed ?? app).instanceId,
        port: (removed ?? app).port,
        releasedAt,
      },
    };
  }

  /**
   * Flat pool view across all stands with optional environment/networkMode/machineId filters
   */
  public listPool(filter?: {
    environment?: ProjectariumEnvironment;
    networkMode?: ProjectariumNetworkMode;
    machineId?: string;
    includeEvicted?: boolean;
  }): ProjectariumPoolItem[] {
    const targetMachine = filter?.machineId?.trim().toLowerCase();
    const items: ProjectariumPoolItem[] = [];
    for (const project of this.projects.values()) {
      for (const app of project.apps) {
        if (!filter?.includeEvicted && app.status === 'EVICTED') continue;
        if (filter?.environment && app.environment !== filter.environment) continue;
        if (filter?.networkMode && app.networkMode !== filter.networkMode) continue;
        if (targetMachine) {
          const appMachine = (app.machineId || 'local-default').trim().toLowerCase();
          if (appMachine !== targetMachine) continue;
        }
        items.push({
          projectId: project.id,
          projectSlug: project.slug,
          projectName: project.name,
          projectToken: project.projectToken,
          app,
        });
      }
    }
    return items;
  }

  /**
   * Expires dynamic local (localhost) leases whose lastPingAt/registeredAt exceeds ttlMs.
   * Seed anchors (metadata.isSeedAnchor === true) are preserved.
   */
  public expireStaleLocalLeases(
    ttlMs: number,
    nowMs = Date.now(),
  ): Array<{ project: ProjectariumProject; app: ProjectariumApp }> {
    const expired: Array<{ project: ProjectariumProject; app: ProjectariumApp }> = [];
    const nowIso = new Date(nowMs).toISOString();

    for (const project of this.projects.values()) {
      const remaining: ProjectariumApp[] = [];
      for (const app of project.apps) {
        const isSeedAnchor = Boolean(app.metadata?.['isSeedAnchor']);
        if (app.networkMode === 'local' && !isSeedAnchor) {
          const lastSeenIso = app.lastPingAt || app.registeredAt;
          const lastSeenMs = Date.parse(lastSeenIso);
          if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs > ttlMs) {
            expired.push({ project, app });
            project.chronicle.unshift({
              id: `ev-ttl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
              type: 'APP_EVICTED',
              scope: 'APP',
              targetAppName: app.appName,
              description: `Локальный сервис ${app.appName} (${app.machineName || app.machineId || 'local'}) завершён по TTL heartbeat`,
              timestamp: nowIso,
              author: 'lease-ttl-reaper',
              metadata: {
                instanceId: app.instanceId,
                machineId: app.machineId,
                port: app.port,
              },
            });
            project.updatedAt = nowIso;
            continue;
          }
        }
        remaining.push(app);
      }
      if (remaining.length !== project.apps.length) {
        project.apps = remaining;
      }
    }

    return expired;
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
    let publicAppsCount = 0;
    let localAppsCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const activeMachines = new Set<string>();

    for (const project of this.projects.values()) {
      for (const app of project.apps) {
        totalApps++;
        if (app.networkMode === 'local') {
          localAppsCount++;
        } else {
          publicAppsCount++;
        }
        if (app.status !== 'EVICTED' && app.machineId) {
          activeMachines.add(app.machineId);
        }
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
      publicAppsCount,
      localAppsCount,
      activeMachinesCount: activeMachines.size,
    };
  }
}
