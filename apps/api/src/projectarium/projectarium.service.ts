import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import {
  HealthProbeResult,
  ProjectariumAnalytics,
  ProjectariumApp,
  ProjectariumAppRunSummary,
  ProjectariumEngine,
  ProjectariumEnvironment,
  ProjectariumEvent,
  ProjectariumEventType,
  ProjectariumHeartbeatResponse,
  ProjectariumMachineStats,
  ProjectariumMachineSummary,
  ProjectariumNetworkMode,
  ProjectariumNoteItem,
  ProjectariumPoolItem,
  ProjectariumPriority,
  ProjectariumProject,
  ProjectariumRegisterResponse,
  ProjectariumReleaseResponse,
  ProjectariumRunEndReason,
  ProjectariumScope,
  ProjectariumAppStatus,
  ProjectariumTodoItem,
  ProjectShieldStats,
  probeAppHealth,
  resolveAppHost,
  resolveMachineIdentity,
} from '@lemon/projectarium';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddAppToProjectDto,
  AddChronicleEventDto,
  AddProjectNoteDto,
  AddProjectTodoDto,
  CreateProjectStandDto,
  ProjectariumHeartbeatDto,
  ProjectariumRegisterDto,
  ProjectariumReleaseDto,
  UpdateProjectNoteDto,
} from './projectarium.dto';

const MAX_PERSISTED_CHRONICLE_EVENTS = 100;
const AUTO_PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 2_500;
const DEFAULT_LOCAL_LEASE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface ProjectariumChangeEvent {
  kind: 'STAND_CREATED' | 'TODO_CHANGED' | 'NOTE_CHANGED' | 'CHRONICLE_ADDED';
  project: ProjectariumProject;
  note?: ProjectariumNoteItem;
  todo?: ProjectariumTodoItem;
  event?: ProjectariumEvent;
}

@Injectable()
export class ProjectariumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProjectariumService.name);
  private readonly engine: ProjectariumEngine;
  private readonly changesSubject$ = new Subject<ProjectariumChangeEvent>();
  private probeTimer: NodeJS.Timeout | null = null;
  private isProbingAll = false;

  constructor(private readonly prisma: PrismaService) {
    this.engine = new ProjectariumEngine();
  }

  changes$(): Observable<ProjectariumChangeEvent> {
    return this.changesSubject$.asObservable();
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
        void this.reapAndProbeAll();
      }, AUTO_PROBE_INTERVAL_MS);
      this.probeTimer.unref();
    }
  }

  private getLocalLeaseTtlMs(): number {
    const raw = Number(process.env.PROJECTARIUM_LOCAL_TTL_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOCAL_LEASE_TTL_MS;
  }

  private async reapAndProbeAll(): Promise<void> {
    await this.expireStaleLocalLeases();
    await this.probeAllStands();
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
    this.changesSubject$.next({ kind: 'STAND_CREATED', project });
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
      machineId: dto.machineId,
      machineName: dto.machineName,
      healthUrl: dto.healthUrl,
      context: Object.keys(appContext).length > 0 ? appContext : undefined,
      initialTodos: dto.initialTodos,
      author: dto.author,
    });
    await this.persistProject(response.project);
    await this.safeRecordAppRunStarted(response.project, response.allocatedApp);
    this.changesSubject$.next({ kind: 'CHRONICLE_ADDED', project: response.project });
    return response;
  }

  listProjects(options?: { machineId?: string; includeAllLocal?: boolean }): ProjectariumProject[] {
    return this.engine.listProjectsForViewer(options);
  }

  getLocalApps(machineId?: string): ProjectariumPoolItem[] {
    if (!machineId?.trim()) {
      return [];
    }
    return this.engine.listPool({
      networkMode: 'local',
      machineId: machineId.trim(),
    });
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
      machineId: dto.machineId,
      machineName: dto.machineName,
      healthUrl: dto.healthUrl,
      context: Object.keys(appContext).length > 0 ? appContext : undefined,
      author: dto.author,
    });
    await this.persistProject(response.project);
    await this.safeRecordAppRunStarted(response.project, response.allocatedApp);
    return response;
  }

  async releaseApp(slugOrToken: string, instanceId: string, author?: string): Promise<{ success: boolean }> {
    const project = this.getProject(slugOrToken);
    const targetApp = project.apps.find((a) => a.instanceId === instanceId || a.id === instanceId);
    const success = this.engine.releaseApp(slugOrToken, instanceId, author);
    if (!success) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    if (targetApp) {
      await this.safeRecordAppRunEnded(targetApp.instanceId, 'RELEASED');
    }
    return { success: true };
  }

  async heartbeat(dto: ProjectariumHeartbeatDto): Promise<ProjectariumHeartbeatResponse> {
    const outcome = this.engine.heartbeat(dto.instanceId, dto.leaseToken);
    if (!outcome.ok) {
      if (outcome.reason === 'NOT_FOUND') {
        throw new NotFoundException(`Application instance '${dto.instanceId}' not found in active pool`);
      }
      throw new UnauthorizedException(`Invalid lease token for instance '${dto.instanceId}'`);
    }
    await this.safePersistProject(outcome.project);
    await this.safeRecordAppRunHeartbeat(dto.instanceId, outcome.result.renewedAt);
    return outcome.result;
  }

  async releaseByLease(dto: ProjectariumReleaseDto): Promise<ProjectariumReleaseResponse> {
    const outcome = this.engine.releaseByLease(dto.instanceId, dto.leaseToken, dto.author || 'agent');
    if (!outcome.ok) {
      if (outcome.reason === 'NOT_FOUND') {
        throw new NotFoundException(`Application instance '${dto.instanceId}' not found in active pool`);
      }
      throw new UnauthorizedException(`Invalid lease token for instance '${dto.instanceId}'`);
    }
    await this.safePersistProject(outcome.project);
    await this.safeRecordAppRunEnded(outcome.result.instanceId, 'RELEASED', outcome.result.releasedAt);
    return outcome.result;
  }

  getPool(
    environment?: ProjectariumEnvironment,
    networkMode?: ProjectariumNetworkMode,
    machineId?: string,
    includeEvicted = false,
  ): ProjectariumPoolItem[] {
    return this.engine.listPool({ environment, networkMode, machineId, includeEvicted });
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
    const shouldProbeLocal = process.env.PROJECTARIUM_PROBE_LOCAL === 'true';

    const probeTargets = project.apps.filter(
      (app) => shouldProbeLocal || app.networkMode !== 'local',
    );

    const results = await Promise.all(
      probeTargets.map(async (app) => ({
        app,
        probe: await probeAppHealth(app, { timeoutMs: PROBE_TIMEOUT_MS, dockerHostAlias }),
      })),
    );

    for (const { app, probe } of results) {
      const prevStatus = app.status;
      const updated = this.engine.recordProbeResult(project.slug, app.instanceId || app.id, probe, {
        recordChronicleOnFailure: Boolean(options.recordSummary),
      });
      if (updated && prevStatus !== 'EVICTED' && updated.status === 'EVICTED') {
        await this.safeRecordAppRunEnded(updated.instanceId, 'EVICTED');
      }
    }

    if (options.recordSummary) {
      this.engine.recordStandPingSummary(project.slug, options.author || 'health-probe');
    }

    await this.safePersistProject(project);
    return project;
  }

  async expireStaleLocalLeases(): Promise<void> {
    const expired = this.engine.expireStaleLocalLeases(this.getLocalLeaseTtlMs());
    if (expired.length === 0) {
      return;
    }

    const touchedProjects = new Map<string, ProjectariumProject>();
    for (const { project, app } of expired) {
      touchedProjects.set(project.id, project);
      await this.safeRecordAppRunEnded(app.instanceId, 'TTL_EXPIRED');
    }

    for (const project of touchedProjects.values()) {
      await this.safePersistProject(project);
    }
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
    this.changesSubject$.next({ kind: 'TODO_CHANGED', project, todo });
    return todo;
  }

  async toggleTodo(slugOrToken: string, todoId: string): Promise<ProjectariumTodoItem> {
    const project = this.getProject(slugOrToken);
    const todo = this.engine.toggleTodo(slugOrToken, todoId);
    if (!todo) {
      throw new NotFoundException(`Todo '${todoId}' not found in project '${slugOrToken}'`);
    }
    await this.persistProject(project);
    this.changesSubject$.next({ kind: 'TODO_CHANGED', project, todo });
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
    this.changesSubject$.next({ kind: 'NOTE_CHANGED', project, note });
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
    this.changesSubject$.next({ kind: 'NOTE_CHANGED', project, note });
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
    this.changesSubject$.next({ kind: 'CHRONICLE_ADDED', project, event });
    return event;
  }

  getStats(): ProjectShieldStats {
    return this.engine.getStats();
  }

  async getMachines(): Promise<ProjectariumMachineSummary[]> {
    const map = new Map<string, ProjectariumMachineSummary>();
    const touch = (machineId: string, machineName: string, lastSeenAt: string): ProjectariumMachineSummary => {
      const existing = map.get(machineId);
      if (existing) {
        if (lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = lastSeenAt;
        }
        if (machineName && existing.machineName === existing.machineId) {
          existing.machineName = machineName;
        }
        return existing;
      }
      const created: ProjectariumMachineSummary = {
        machineId,
        machineName,
        activeLocalCount: 0,
        activePublicCount: 0,
        lastSeenAt,
      };
      map.set(machineId, created);
      return created;
    };

    for (const project of this.engine.listProjects()) {
      for (const app of project.apps) {
        if (app.status === 'EVICTED') continue;
        const machine = resolveMachineIdentity({
          machineId: app.machineId,
          machineName: app.machineName,
          networkMode: app.networkMode,
          host: app.host,
        });
        const entry = touch(machine.machineId, machine.machineName, app.lastPingAt || app.registeredAt);
        if (app.networkMode === 'local') {
          entry.activeLocalCount++;
        } else {
          entry.activePublicCount++;
        }
      }
    }

    try {
      const recentRuns = await this.prisma.projectariumAppRunRecord.findMany({
        select: {
          machineId: true,
          machineName: true,
          lastHeartbeatAt: true,
        },
        orderBy: { lastHeartbeatAt: 'desc' },
        take: 250,
      });
      for (const run of recentRuns) {
        touch(run.machineId, run.machineName, run.lastHeartbeatAt.toISOString());
      }
    } catch (error) {
      this.logger.warn(
        `Projectarium machines query skipped (DB unavailable): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return Array.from(map.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async getAnalytics(windowDays = 30): Promise<ProjectariumAnalytics> {
    const days = Math.min(365, Math.max(1, Math.round(windowDays || 30)));
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let runs: ProjectariumAppRunSummary[] = [];
    try {
      const dbRuns = await this.prisma.projectariumAppRunRecord.findMany({
        where: {
          OR: [{ startedAt: { gte: since } }, { endReason: 'ACTIVE' }],
        },
        orderBy: { startedAt: 'desc' },
        take: 1000,
      });
      runs = dbRuns.map((row) => {
        const isActive = row.endReason === 'ACTIVE' && !row.endedAt;
        const computedDurationSec = isActive
          ? Math.max(1, Math.round((now.getTime() - row.startedAt.getTime()) / 1000))
          : row.durationSec ??
            Math.max(1, Math.round(((row.endedAt ?? row.lastHeartbeatAt).getTime() - row.startedAt.getTime()) / 1000));
        return {
          id: row.id,
          standSlug: row.standSlug,
          standName: row.standName,
          appName: row.appName,
          host: row.host,
          port: row.port,
          environment: row.environment as ProjectariumEnvironment,
          networkMode: row.networkMode as ProjectariumNetworkMode,
          machineId: row.machineId,
          machineName: row.machineName,
          startedAt: row.startedAt.toISOString(),
          lastHeartbeatAt: row.lastHeartbeatAt.toISOString(),
          endedAt: row.endedAt ? row.endedAt.toISOString() : undefined,
          durationSec: computedDurationSec,
          endReason: row.endReason as ProjectariumRunEndReason,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Projectarium analytics falling back to in-memory snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
      runs = this.buildFallbackRunsFromMemory(now);
    }

    if (runs.length === 0) {
      runs = this.buildFallbackRunsFromMemory(now);
    }

    const machineMap = new Map<
      string,
      {
        machineId: string;
        machineName: string;
        activeCount: number;
        totalRuns: number;
        totalDurationSec: number;
        lastActiveAt?: string;
        apps: Map<string, { appName: string; standSlug: string; standName: string; runs: number; activeCount: number; totalDurationSec: number }>;
      }
    >();

    const appMap = new Map<
      string,
      {
        appName: string;
        standSlug: string;
        standName: string;
        totalRuns: number;
        activeCount: number;
        totalDurationSec: number;
        machines: Set<string>;
      }
    >();

    let activeRuns = 0;
    let totalDurationSec = 0;

    for (const run of runs) {
      const isActive = run.endReason === 'ACTIVE';
      if (isActive) activeRuns++;
      totalDurationSec += run.durationSec;

      let mEntry = machineMap.get(run.machineId);
      if (!mEntry) {
        mEntry = {
          machineId: run.machineId,
          machineName: run.machineName,
          activeCount: 0,
          totalRuns: 0,
          totalDurationSec: 0,
          lastActiveAt: run.lastHeartbeatAt,
          apps: new Map(),
        };
        machineMap.set(run.machineId, mEntry);
      }
      mEntry.totalRuns++;
      mEntry.totalDurationSec += run.durationSec;
      if (isActive) mEntry.activeCount++;
      if (!mEntry.lastActiveAt || run.lastHeartbeatAt > mEntry.lastActiveAt) {
        mEntry.lastActiveAt = run.lastHeartbeatAt;
      }

      const mAppKey = `${run.standSlug}::${run.appName}`;
      const mApp = mEntry.apps.get(mAppKey) ?? {
        appName: run.appName,
        standSlug: run.standSlug,
        standName: run.standName,
        runs: 0,
        activeCount: 0,
        totalDurationSec: 0,
      };
      mApp.runs++;
      mApp.totalDurationSec += run.durationSec;
      if (isActive) mApp.activeCount++;
      mEntry.apps.set(mAppKey, mApp);

      const gApp = appMap.get(mAppKey) ?? {
        appName: run.appName,
        standSlug: run.standSlug,
        standName: run.standName,
        totalRuns: 0,
        activeCount: 0,
        totalDurationSec: 0,
        machines: new Set<string>(),
      };
      gApp.totalRuns++;
      gApp.totalDurationSec += run.durationSec;
      if (isActive) gApp.activeCount++;
      gApp.machines.add(run.machineName);
      appMap.set(mAppKey, gApp);
    }

    const machines: ProjectariumMachineStats[] = Array.from(machineMap.values())
      .map((m) => ({
        machineId: m.machineId,
        machineName: m.machineName,
        activeCount: m.activeCount,
        totalRuns: m.totalRuns,
        totalDurationSec: m.totalDurationSec,
        lastActiveAt: m.lastActiveAt,
        topApps: Array.from(m.apps.values())
          .sort((a, b) => b.runs - a.runs || b.totalDurationSec - a.totalDurationSec)
          .slice(0, 6),
      }))
      .sort((a, b) => b.activeCount - a.activeCount || b.totalRuns - a.totalRuns);

    const topApps = Array.from(appMap.values())
      .map((a) => ({
        appName: a.appName,
        standSlug: a.standSlug,
        standName: a.standName,
        totalRuns: a.totalRuns,
        activeCount: a.activeCount,
        totalDurationSec: a.totalDurationSec,
        machines: Array.from(a.machines),
      }))
      .sort((a, b) => b.totalRuns - a.totalRuns || b.totalDurationSec - a.totalDurationSec)
      .slice(0, 12);

    return {
      windowDays: days,
      generatedAt: now.toISOString(),
      totalRuns: runs.length,
      activeRuns,
      totalDurationSec,
      machines,
      topApps,
      recentRuns: runs.slice(0, 30),
    };
  }

  private buildFallbackRunsFromMemory(now: Date): ProjectariumAppRunSummary[] {
    const runs: ProjectariumAppRunSummary[] = [];
    for (const project of this.engine.listProjects()) {
      for (const app of project.apps) {
        const machine = resolveMachineIdentity({
          machineId: app.machineId,
          machineName: app.machineName,
          networkMode: app.networkMode,
          host: app.host,
        });
        const startedMs = Date.parse(app.registeredAt) || now.getTime();
        runs.push({
          id: `mem-${app.instanceId}`,
          standSlug: project.slug,
          standName: project.name,
          appName: app.appName,
          host: app.host || 'localhost',
          port: app.port,
          environment: app.environment,
          networkMode: app.networkMode,
          machineId: machine.machineId,
          machineName: machine.machineName,
          startedAt: app.registeredAt,
          lastHeartbeatAt: app.lastPingAt || app.registeredAt,
          durationSec: Math.max(1, Math.round((now.getTime() - startedMs) / 1000)),
          endReason: app.status === 'EVICTED' ? 'EVICTED' : 'ACTIVE',
        });
      }
    }
    return runs;
  }

  private async safeRecordAppRunStarted(project: ProjectariumProject, app: ProjectariumApp): Promise<void> {
    try {
      const machine = resolveMachineIdentity({
        machineId: app.machineId,
        machineName: app.machineName,
        networkMode: app.networkMode,
        host: app.host,
      });
      await this.prisma.projectariumAppRunRecord.upsert({
        where: { instanceId: app.instanceId },
        create: {
          id: `run-${app.instanceId}`,
          standId: project.id,
          standSlug: project.slug,
          standName: project.name,
          appName: app.appName,
          host: app.host || 'localhost',
          port: app.port,
          instanceId: app.instanceId,
          environment: app.environment,
          networkMode: app.networkMode,
          machineId: machine.machineId,
          machineName: machine.machineName,
          startedAt: new Date(app.registeredAt),
          lastHeartbeatAt: new Date(app.lastPingAt || app.registeredAt),
          endReason: 'ACTIVE',
        },
        update: {
          lastHeartbeatAt: new Date(app.lastPingAt || app.registeredAt),
          endReason: 'ACTIVE',
          endedAt: null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Skipped recording app run start for '${app.instanceId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async safeRecordAppRunHeartbeat(instanceId: string, renewedAtIso: string): Promise<void> {
    try {
      await this.prisma.projectariumAppRunRecord.updateMany({
        where: { instanceId, endedAt: null },
        data: { lastHeartbeatAt: new Date(renewedAtIso) },
      });
    } catch (error) {
      this.logger.warn(
        `Skipped recording app run heartbeat for '${instanceId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async safeRecordAppRunEnded(
    instanceId: string,
    endReason: Exclude<ProjectariumRunEndReason, 'ACTIVE'>,
    endedAtIso = new Date().toISOString(),
  ): Promise<void> {
    try {
      const existing = await this.prisma.projectariumAppRunRecord.findUnique({
        where: { instanceId },
      });
      if (!existing || existing.endedAt) {
        return;
      }
      const endedAt = new Date(endedAtIso);
      const durationSec = Math.max(1, Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000));
      await this.prisma.projectariumAppRunRecord.update({
        where: { instanceId },
        data: {
          endedAt,
          durationSec,
          endReason,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Skipped recording app run end for '${instanceId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async syncFromDatabase(): Promise<void> {
    const defaultUniverseProject = this.engine.getProject('lemon-universe');
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
      await this.safeBackfillActiveRuns(defaults);
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
        const host = resolveAppHost(metadata?.['host'] as string | undefined, app.healthUrl ?? undefined);
        const networkMode = app.networkMode as ProjectariumNetworkMode;
        const machine = resolveMachineIdentity({
          machineId: app.machineId ?? (metadata?.['machineId'] as string | undefined),
          machineName: app.machineName ?? (metadata?.['machineName'] as string | undefined),
          networkMode,
          host,
        });
        return {
          id: app.id,
          appName: app.appName,
          host,
          port: app.port,
          instanceId: app.instanceId,
          leaseToken: app.leaseToken,
          environment: app.environment as ProjectariumEnvironment,
          networkMode,
          machineId: machine.machineId,
          machineName: machine.machineName,
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

    await this.migrateLegacyPartyStand(hydrated);

    if (defaultUniverseProject && !hydrated.some((p) => p.slug === 'lemon-universe')) {
      hydrated.push(defaultUniverseProject);
      await this.persistProject(defaultUniverseProject);
      this.logger.log('Seeded Lemon-Universe stand into existing Projectarium PostgreSQL.');
    }

    this.engine.hydrateSnapshot(hydrated);
    await this.safeBackfillActiveRuns(hydrated);
    this.logger.log(`Hydrated ${hydrated.length} Projectarium stands from PostgreSQL.`);
  }

  private async migrateLegacyPartyStand(hydrated: ProjectariumProject[]): Promise<void> {
    const legacyIndex = hydrated.findIndex(
      (p) => p.slug === 'lemon-party' || p.id === 'stand-lemon-party',
    );
    if (legacyIndex === -1 || hydrated.some((p) => p.slug === 'lemon-universe')) {
      return;
    }

    const legacy = hydrated[legacyIndex];
    const replacePartyText = (text: string): string =>
      text.replace(/Lemon-Party/gi, 'Lemon-Universe').replace(/Party Modes/g, 'Universe Modes');
    const tags = Array.isArray(legacy.context?.['tags'])
      ? legacy.context['tags'].map((tag: unknown) => (tag === 'LEMON_PARTY' ? 'LEMON_UNIVERSE' : tag))
      : undefined;

    const migrated: ProjectariumProject = {
      ...legacy,
      id: legacy.id === 'stand-lemon-party' ? 'stand-lemon-universe' : legacy.id,
      name: legacy.name.toLowerCase() === 'lemon-party' ? 'Lemon-Universe' : replacePartyText(legacy.name),
      slug: 'lemon-universe',
      neuronWorkspace: legacy.neuronWorkspace === 'workspace.party' ? 'workspace.universe' : legacy.neuronWorkspace,
      projectToken: legacy.projectToken === 'proj_party_arena_9012de' ? 'proj_universe_arena_9012de' : legacy.projectToken,
      context: {
        ...legacy.context,
        ...(typeof legacy.context?.['domain'] === 'string'
          ? { domain: replacePartyText(legacy.context['domain']) }
          : {}),
        ...(typeof legacy.context?.['description'] === 'string'
          ? { description: replacePartyText(legacy.context['description']) }
          : {}),
        ...(tags ? { tags } : {}),
      },
      todos: legacy.todos.map((t) => ({ ...t, title: replacePartyText(t.title) })),
      notes: (legacy.notes ?? []).map((n) => ({
        ...n,
        ...(n.title ? { title: replacePartyText(n.title) } : {}),
        content: replacePartyText(n.content),
      })),
      chronicle: legacy.chronicle.map((ev) => ({
        ...ev,
        description: replacePartyText(ev.description),
      })),
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.projectariumStand.deleteMany({ where: { id: legacy.id } });
    try {
      await this.prisma.projectariumAppRunRecord.updateMany({
        where: { OR: [{ standId: legacy.id }, { standSlug: 'lemon-party' }] },
        data: {
          standId: migrated.id,
          standSlug: migrated.slug,
          standName: migrated.name,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Skipped migrating app runs for '${legacy.slug}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await this.persistProject(migrated);
    hydrated[legacyIndex] = migrated;
    this.logger.log(`Migrated legacy stand '${legacy.slug}' -> '${migrated.slug}' in PostgreSQL.`);
  }

  private async safeBackfillActiveRuns(projects: ProjectariumProject[]): Promise<void> {
    try {
      const rows = projects.flatMap((project) =>
        project.apps
          .filter((app) => app.status !== 'EVICTED')
          .map((app) => {
            const machine = resolveMachineIdentity({
              machineId: app.machineId,
              machineName: app.machineName,
              networkMode: app.networkMode,
              host: app.host,
            });
            return {
              id: `run-${app.instanceId}`,
              standId: project.id,
              standSlug: project.slug,
              standName: project.name,
              appName: app.appName,
              host: app.host || 'localhost',
              port: app.port,
              instanceId: app.instanceId,
              environment: app.environment,
              networkMode: app.networkMode,
              machineId: machine.machineId,
              machineName: machine.machineName,
              startedAt: new Date(app.registeredAt),
              lastHeartbeatAt: new Date(app.lastPingAt || app.registeredAt),
              endReason: 'ACTIVE',
            };
          }),
      );
      if (rows.length > 0) {
        await this.prisma.projectariumAppRunRecord.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Skipped backfilling active runs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
            const machine = resolveMachineIdentity({
              machineId: app.machineId,
              machineName: app.machineName,
              networkMode: app.networkMode,
              host: app.host,
            });
            const metadata = {
              ...(app.metadata ?? {}),
              ...(app.host ? { host: app.host } : {}),
              machineId: machine.machineId,
              machineName: machine.machineName,
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
              machineId: machine.machineId,
              machineName: machine.machineName,
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
