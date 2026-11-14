import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  HealthProbeResult,
  ProjectariumApp,
  ProjectariumEngine,
  ProjectariumEnvironment,
  ProjectariumEvent,
  ProjectariumEventType,
  ProjectariumNetworkMode,
  ProjectariumNoteItem,
  ProjectariumPriority,
  ProjectariumProject,
  ProjectariumRegisterResponse,
  ProjectariumScope,
  ProjectariumAppStatus,
  ProjectariumTodoItem,
  ProjectShieldStats,
  probeAppHealth,
  resolveAppHost,
} from '@lemon/projectarium';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddAppToProjectDto,
  AddChronicleEventDto,
  AddProjectNoteDto,
  AddProjectTodoDto,
  CreateProjectStandDto,
  ProjectariumRegisterDto,
  UpdateProjectNoteDto,
} from './projectarium.dto';

const MAX_PERSISTED_CHRONICLE_EVENTS = 100;
const AUTO_PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 2_500;

@Injectable()
export class ProjectariumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProjectariumService.name);
  private readonly engine: ProjectariumEngine;
  private probeTimer: NodeJS.Timeout | null = null;
  private isProbingAll = false;

  constructor(private readonly prisma: PrismaService) {
    this.engine = new ProjectariumEngine();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.syncFromDatabase();
    } catch (error) {
      this.logger.warn(
        `Projectarium DB sync skipped during init: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (process.env.PROJECTARIUM_AUTO_PROBE !== 'false') {
      void this.probeAllStands();
      this.probeTimer = setInterval(() => {
        void this.probeAllStands();
      }, AUTO_PROBE_INTERVAL_MS);
      this.probeTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  async createProject(dto: CreateProjectStandDto): Promise<ProjectariumProject> {
    const { project } = this.engine.createProject({
      projectName: dto.projectName,
      projectSlug: dto.projectSlug,
      neuronWorkspace: dto.neuronWorkspace,
      context: dto.context,
      initialTodos: dto.initialTodos,
      author: dto.author,
    });
    await this.persistProject(project);
    return project;
  }

  async registerOrAttach(dto: ProjectariumRegisterDto): Promise<ProjectariumRegisterResponse> {
    const appContext = {
      ...(dto.context ?? {}),
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.icon ? { icon: dto.icon } : {}),
    };
    const response = this.engine.registerOrAttach({
      projectSlug: dto.projectSlug,
      projectName: dto.projectName,
      projectToken: dto.projectToken,
      appName: dto.appName,
      host: dto.host,
      preferredPort: dto.preferredPort,
      environment: dto.environment,
      networkMode: dto.networkMode,
      healthUrl: dto.healthUrl,
      context: Object.keys(appContext).length > 0 ? appContext : undefined,
      initialTodos: dto.initialTodos,
      author: dto.author,
    });
    await this.persistProject(response.project);
    return response;
  }

  listProjects(): ProjectariumProject[] {
    return this.engine.listProjects();
  }

  getProject(query: string): ProjectariumProject {
    const project = this.engine.getProject(query);
    if (!project) {
      throw new NotFoundException(`Project stand '${query}' not found`);
    }
    return project;
  }

  async addAppToProject(slugOrToken: string, dto: AddAppToProjectDto): Promise<ProjectariumRegisterResponse> {
    const project = this.getProject(slugOrToken);
    const appContext = {
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.icon ? { icon: dto.icon } : {}),
    };
    const response = this.engine.registerOrAttach({
      projectToken: project.projectToken,
      appName: dto.appName,
      host: dto.host,
      preferredPort: dto.preferredPort,
      environment: dto.environment,
      networkMode: dto.networkMode,
      healthUrl: dto.healthUrl,
      context: Object.keys(appContext).length > 0 ? appContext : undefined,
      author: dto.author,
    });
    await this.persistProject(response.project);
    return response;
  }

  async releaseApp(slugOrToken: string, instanceId: string, author?: string): Promise<{ success: boolean }> {
    const project = this.getProject(slugOrToken);
    const success = this.engine.releaseApp(slugOrToken, instanceId, author);
    if (!success) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    return { success: true };
  }

  async deleteProject(slugOrToken: string): Promise<{ success: boolean }> {
    const project = this.getProject(slugOrToken);
    this.engine.deleteProject(project.id);
    await this.prisma.projectariumStand.deleteMany({ where: { id: project.id } });
    return { success: true };
  }

  async pingStand(
    slugOrToken: string,
    options: { recordSummary?: boolean; author?: string } = { recordSummary: true },
  ): Promise<ProjectariumProject> {
    const project = this.getProject(slugOrToken);
    const dockerHostAlias = process.env.PROJECTARIUM_LOCALHOST_ALIAS;

    const results = await Promise.all(
      project.apps.map(async (app) => ({
        app,
        probe: await probeAppHealth(app, { timeoutMs: PROBE_TIMEOUT_MS, dockerHostAlias }),
      })),
    );

    for (const { app, probe } of results) {
      this.engine.recordProbeResult(project.slug, app.instanceId || app.id, probe, {
        recordChronicleOnFailure: Boolean(options.recordSummary),
      });
    }

    if (options.recordSummary) {
      this.engine.recordStandPingSummary(project.slug, options.author || 'health-probe');
    }

    await this.safePersistProject(project);
    return project;
  }

  async pingApp(
    slugOrToken: string,
    instanceId: string,
  ): Promise<{ app: ProjectariumApp; probe: HealthProbeResult }> {
    const project = this.getProject(slugOrToken);
    const targetApp = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
    if (!targetApp) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }

    const probe = await probeAppHealth(targetApp, {
      timeoutMs: PROBE_TIMEOUT_MS,
      dockerHostAlias: process.env.PROJECTARIUM_LOCALHOST_ALIAS,
    });
    const updated = this.engine.recordProbeResult(project.slug, targetApp.instanceId || targetApp.id, probe, {
      recordChronicleOnFailure: true,
    });
    await this.safePersistProject(project);

    return { app: updated || targetApp, probe };
  }

  async probeAllStands(): Promise<void> {
    if (this.isProbingAll) {
      return;
    }
    this.isProbingAll = true;
    try {
      const stands = this.engine.listProjects();
      await Promise.all(
        stands.map((stand) =>
          this.pingStand(stand.slug, { recordSummary: false }).catch((err) => {
            this.logger.warn(
              `Background probe failed for stand '${stand.slug}': ${err instanceof Error ? err.message : String(err)}`,
            );
          }),
        ),
      );
    } finally {
      this.isProbingAll = false;
    }
  }

  private async safePersistProject(project: ProjectariumProject): Promise<void> {
    try {
      await this.persistProject(project);
    } catch (error) {
      this.logger.warn(
        `Skipped persisting stand '${project.slug}' (DB unavailable): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async addTodo(slugOrToken: string, dto: AddProjectTodoDto): Promise<ProjectariumTodoItem> {
    const project = this.getProject(slugOrToken);
    const todo = this.engine.addTodo(slugOrToken, {
      title: dto.title,
      scope: dto.scope,
      targetAppName: dto.targetAppName,
      priority: dto.priority,
      author: dto.author,
    });
    if (!todo) {
      throw new NotFoundException(`Project stand '${slugOrToken}' not found`);
    }
    await this.persistProject(project);
    return todo;
  }

  async toggleTodo(slugOrToken: string, todoId: string): Promise<ProjectariumTodoItem> {
    const project = this.getProject(slugOrToken);
    const todo = this.engine.toggleTodo(slugOrToken, todoId);
    if (!todo) {
      throw new NotFoundException(`Todo '${todoId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    return todo;
  }

  async addNote(slugOrToken: string, dto: AddProjectNoteDto): Promise<ProjectariumNoteItem> {
    const project = this.getProject(slugOrToken);
    const note = this.engine.addNote(slugOrToken, {
      title: dto.title,
      content: dto.content,
      author: dto.author,
      tags: dto.tags,
    });
    if (!note) {
      throw new NotFoundException(`Project stand '${slugOrToken}' not found`);
    }
    await this.persistProject(project);
    return note;
  }

  async updateNote(
    slugOrToken: string,
    noteId: string,
    dto: UpdateProjectNoteDto,
  ): Promise<ProjectariumNoteItem> {
    const project = this.getProject(slugOrToken);
    const note = this.engine.updateNote(slugOrToken, noteId, {
      title: dto.title,
      content: dto.content,
      author: dto.author,
      tags: dto.tags,
    });
    if (!note) {
      throw new NotFoundException(`Note '${noteId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    return note;
  }

  async deleteNote(slugOrToken: string, noteId: string): Promise<{ success: boolean }> {
    const project = this.getProject(slugOrToken);
    const deleted = this.engine.deleteNote(slugOrToken, noteId);
    if (!deleted) {
      throw new NotFoundException(`Note '${noteId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    return { success: true };
  }

  async addChronicleEvent(slugOrToken: string, dto: AddChronicleEventDto): Promise<ProjectariumEvent> {
    const project = this.getProject(slugOrToken);
    const event = this.engine.addChronicleEvent(slugOrToken, {
      description: dto.description,
      scope: dto.scope,
      targetAppName: dto.targetAppName,
      author: dto.author,
    });
    if (!event) {
      throw new NotFoundException(`Project stand '${slugOrToken}' not found`);
    }
    await this.persistProject(project);
    return event;
  }

  getStats(): ProjectShieldStats {
    return this.engine.getStats();
  }

  private async syncFromDatabase(): Promise<void> {
    const defaultPartyProject = this.engine.getProject('lemon-party');
    const stands = await this.prisma.projectariumStand.findMany({
      include: {
        apps: { orderBy: { registeredAt: 'asc' } },
        todos: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { updatedAt: 'desc' } },
        chronicle: {
          orderBy: { timestamp: 'desc' },
          take: MAX_PERSISTED_CHRONICLE_EVENTS,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (stands.length === 0) {
      const defaults = this.engine.listProjects();
      for (const project of defaults) {
        await this.persistProject(project);
      }
      this.logger.log(`Seeded ${defaults.length} default Projectarium stands into PostgreSQL.`);
      return;
    }

    const hydrated: ProjectariumProject[] = stands.map((stand) => ({
      id: stand.id,
      name: stand.name,
      slug: stand.slug,
      neuronWorkspace: stand.neuronWorkspace,
      projectToken: stand.projectToken,
      context: this.asJsonRecord(stand.context),
      createdAt: stand.createdAt.toISOString(),
      updatedAt: stand.updatedAt.toISOString(),
      apps: stand.apps.map((app) => {
        const metadata = app.metadata ? this.asJsonRecord(app.metadata) : undefined;
        return {
          id: app.id,
          appName: app.appName,
          host: resolveAppHost(metadata?.['host'] as string | undefined, app.healthUrl ?? undefined),
          port: app.port,
          instanceId: app.instanceId,
          leaseToken: app.leaseToken,
          environment: app.environment as ProjectariumEnvironment,
          networkMode: app.networkMode as ProjectariumNetworkMode,
          status: app.status as ProjectariumAppStatus,
          healthUrl: app.healthUrl ?? undefined,
          lastPingAt: app.lastPingAt ? app.lastPingAt.toISOString() : undefined,
          pingLatencyMs: app.pingLatencyMs ?? undefined,
          consecutiveFailures: app.consecutiveFailures,
          registeredAt: app.registeredAt.toISOString(),
          metadata,
        };
      }),
      todos: stand.todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        scope: todo.scope as ProjectariumScope,
        targetAppName: todo.targetAppName ?? undefined,
        createdAt: todo.createdAt.toISOString(),
        completedAt: todo.completedAt ? todo.completedAt.toISOString() : undefined,
        author: todo.author,
        priority: todo.priority as ProjectariumPriority,
      })),
      notes: stand.notes.map((note) => ({
        id: note.id,
        title: note.title ?? undefined,
        content: note.content,
        author: note.author,
        tags: note.tags ?? [],
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
      chronicle: stand.chronicle.map((ev) => ({
        id: ev.id,
        type: ev.type as ProjectariumEventType,
        scope: ev.scope as ProjectariumScope,
        targetAppName: ev.targetAppName ?? undefined,
        description: ev.description,
        timestamp: ev.timestamp.toISOString(),
        author: ev.author,
        metadata: ev.metadata ? this.asJsonRecord(ev.metadata) : undefined,
      })),
    }));

    if (defaultPartyProject && !hydrated.some((p) => p.slug === 'lemon-party')) {
      hydrated.push(defaultPartyProject);
      await this.persistProject(defaultPartyProject);
      this.logger.log('Seeded Lemon-Party stand into existing Projectarium PostgreSQL.');
    }

    this.engine.hydrateSnapshot(hydrated);
    this.logger.log(`Hydrated ${hydrated.length} Projectarium stands from PostgreSQL.`);
  }

  private async persistProject(project: ProjectariumProject): Promise<void> {
    const chronicleSlice = project.chronicle.slice(0, MAX_PERSISTED_CHRONICLE_EVENTS);

    await this.prisma.$transaction(async (tx) => {
      await tx.projectariumStand.upsert({
        where: { id: project.id },
        create: {
          id: project.id,
          slug: project.slug,
          name: project.name,
          neuronWorkspace: project.neuronWorkspace,
          projectToken: project.projectToken,
          context: project.context as Prisma.InputJsonValue,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
        },
        update: {
          slug: project.slug,
          name: project.name,
          neuronWorkspace: project.neuronWorkspace,
          projectToken: project.projectToken,
          context: project.context as Prisma.InputJsonValue,
          updatedAt: new Date(project.updatedAt),
        },
      });

      await tx.projectariumAppRecord.deleteMany({ where: { standId: project.id } });
      if (project.apps.length > 0) {
        await tx.projectariumAppRecord.createMany({
          data: project.apps.map((app) => {
            const metadata = {
              ...(app.metadata ?? {}),
              ...(app.host ? { host: app.host } : {}),
            };
            return {
              id: app.id,
              standId: project.id,
              appName: app.appName,
              port: app.port,
              instanceId: app.instanceId,
              leaseToken: app.leaseToken,
              environment: app.environment,
              networkMode: app.networkMode,
              status: app.status,
              healthUrl: app.healthUrl ?? null,
              lastPingAt: app.lastPingAt ? new Date(app.lastPingAt) : null,
              pingLatencyMs: app.pingLatencyMs ?? null,
              consecutiveFailures: app.consecutiveFailures,
              registeredAt: new Date(app.registeredAt),
              metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            };
          }),
        });
      }

      await tx.projectariumTodoRecord.deleteMany({ where: { standId: project.id } });
      if (project.todos.length > 0) {
        await tx.projectariumTodoRecord.createMany({
          data: project.todos.map((todo) => ({
            id: todo.id,
            standId: project.id,
            title: todo.title,
            completed: todo.completed,
            scope: todo.scope,
            targetAppName: todo.targetAppName ?? null,
            author: todo.author,
            priority: todo.priority,
            createdAt: new Date(todo.createdAt),
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
          })),
        });
      }

      await tx.projectariumNoteRecord.deleteMany({ where: { standId: project.id } });
      if (project.notes && project.notes.length > 0) {
        await tx.projectariumNoteRecord.createMany({
          data: project.notes.map((note) => ({
            id: note.id,
            standId: project.id,
            title: note.title ?? null,
            content: note.content,
            author: note.author,
            tags: note.tags ?? [],
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
          })),
        });
      }

      await tx.projectariumEventRecord.deleteMany({ where: { standId: project.id } });
      if (chronicleSlice.length > 0) {
        await tx.projectariumEventRecord.createMany({
          data: chronicleSlice.map((ev) => ({
            id: ev.id,
            standId: project.id,
            type: ev.type,
            scope: ev.scope,
            targetAppName: ev.targetAppName ?? null,
            description: ev.description,
            author: ev.author,
            metadata: ev.metadata ? (ev.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            timestamp: new Date(ev.timestamp),
          })),
        });
      }
    });
  }

  private asJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }
    return {};
  }
}
