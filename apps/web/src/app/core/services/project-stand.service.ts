import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
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
import { LemonWorkerService } from './lemon-worker.service';
import { buildAppUrl, extractHostFromUrl, inferAppIcon, resolveAppHost } from './project-stand.helpers';
import { INITIAL_PROJECT_STANDS } from './project-stand.seeds';

const STANDS_STORAGE_KEY = 'lemon_actions_project_stands_v1';
const PARTY_STAND_SEEDED_KEY = 'lemon_actions_projectarium_party_seeded_v1';
const PROJECTARIUM_API_BASE = '/api/projectarium';

@Injectable({ providedIn: 'root' })
export class ProjectStandService {
  private readonly http = inject(HttpClient);
  private readonly chronicleService = inject(LemonChronicleService);
  private readonly workerService = inject(LemonWorkerService);

  private readonly stands$ = new BehaviorSubject<ProjectStand[]>(this.loadStands());

  readonly allStands$: Observable<ProjectStand[]> = this.stands$.asObservable();

  private nextDynamicPort = 4320;

  constructor() {
    this.bindReactiveListeners();
    this.fetchFromBackend();
  }

  fetchFromBackend(): void {
    this.http.get<any[]>(`${PROJECTARIUM_API_BASE}/projects`).subscribe({
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
      .post(`${PROJECTARIUM_API_BASE}/projects`, {
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
      .post(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/apps`, {
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
        .delete(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/apps/${targetApp.instanceId || targetApp.id}`)
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

    this.http.post<any>(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/ping`, {}).subscribe({
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

  /**
   * Executes a real server-side healthcheck for a single app instance in a project stand.
   */
  pingSingleApp(standId: string, instanceId: string): void {
    const stands = this.stands$.getValue();
    const stand = stands.find((s) => s.id === standId);
    if (!stand) return;

    const checkingStands = stands.map((s) =>
      s.id === standId
        ? {
            ...s,
            apps: s.apps.map((app) =>
              app.instanceId === instanceId || app.id === instanceId
                ? { ...app, status: 'CHECKING' as StandAppStatus }
                : app,
            ),
          }
        : s,
    );
    this.persist(checkingStands);

    this.http
      .post<any>(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/apps/${instanceId}/ping`, {})
      .subscribe({
        next: () => this.fetchFromBackend(),
        error: () => {
          const current = this.stands$.getValue();
          const reverted = current.map((s) =>
            s.id === standId ? { ...s, apps: stand.apps } : s,
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
        .post(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/events`, {
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
        .patch(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/todos/${itemId}/toggle`, {})
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
        .post(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/todos`, {
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
        .post(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/notes`, {
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
        .patch(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/notes/${noteId}`, {
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
        .delete(`${PROJECTARIUM_API_BASE}/projects/${stand.slug}/notes/${noteId}`)
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
      this.http.delete(`${PROJECTARIUM_API_BASE}/projects/${target.slug}`).subscribe({ error: () => {} });
    }
  }

  /**
   * Executes the unified Smart Touch Handler ("Upsert on First Touch") and refreshes stands.
   */
  smartRegister(payload: {
    projectName: string;
    appName: string;
    host: string;
    preferredPort?: number;
    environment: AppEnvironment;
    networkMode: AppNetworkMode;
    author?: string;
  }): Observable<any> {
    return this.http
      .post<any>(`${PROJECTARIUM_API_BASE}/register`, {
        ...payload,
        author: payload.author || 'cockpit-ui',
      })
      .pipe(tap(() => this.fetchFromBackend()));
  }
}
