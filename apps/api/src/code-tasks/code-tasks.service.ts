import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { FlowsService } from '../flows/flows.service';
import { FlowsEventBusService } from '../flows/flows-event-bus.service';
import { toLtreeLabel } from '../folders/folders.service';
import { FoldersRepository } from '../folders/folders.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  AgentHeartbeatDto,
  CodeRepoView,
  CommitDailyDigestDto,
  PushCodeResultsDto,
  RecordAgentDecisionDto,
  RegisterCodeRepoDto,
  StartAgentSessionDto,
} from './code-tasks.dto';
import { runAgentDataMigration } from '../migrations/agent-data-migration';

interface RegisteredRepoRecord {
  id: string;
  name: string;
  localPath: string;
  folderId: string;
  folderPath: string;
  profileId: string | null;
  defaultTags: string[];
  lastSyncAt: string | null;
}

interface RawTaskSpec {
  id: string;
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  testSuite?: string;
  createdAt?: string;
}

interface RawTestResult {
  taskId: string;
  status: 'PASSED' | 'FAILED' | 'STUB' | 'IN_PROGRESS';
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped?: number;
  };
  durationMs?: number;
  logs?: Array<{
    test: string;
    error?: string;
    stack?: string;
  }>;
}

@Injectable()
export class CodeTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CodeTasksService.name);
  private readonly repos = new Map<string, RegisteredRepoRecord>();
  private readonly watchers = new Map<string, fs.FSWatcher>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly activeSessions = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly foldersRepo: FoldersRepository,
    private readonly flowsService: FlowsService,
    @Optional() private readonly eventBus?: FlowsEventBusService,
  ) {}

  async onModuleInit() {
    // Автоматически регистрируем встроенный пример challenges-demo, если он существует на диске
    let demoPath = path.resolve(process.cwd(), 'examples', 'challenges-demo');
    if (!fs.existsSync(demoPath)) {
      demoPath = path.resolve(__dirname, '..', '..', '..', '..', 'examples', 'challenges-demo');
    }
    if (fs.existsSync(demoPath)) {
      try {
        await this.registerRepo({
          localPath: demoPath,
          name: 'Starter Challenges (JS/Tauri/Vite/REST)',
          defaultTags: ['#js', '#tauri', '#vite', '#rest'],
        });
        this.logger.log(`[CodeTasks] Auto-registered starter challenges from: ${demoPath}`);
      } catch (err: any) {
        this.logger.warn(`[CodeTasks] Could not auto-register demo repo: ${err.message}`);
      }
    }

    // Автоматически регистрируем JS Async & Promises Lab, если он существует на диске
    let asyncPath = path.resolve(process.cwd(), 'examples', 'async-challenges');
    if (!fs.existsSync(asyncPath)) {
      asyncPath = path.resolve(__dirname, '..', '..', '..', '..', 'examples', 'async-challenges');
    }
    if (fs.existsSync(asyncPath)) {
      try {
        await this.registerRepo({
          localPath: asyncPath,
          name: 'JavaScript Async & Promises Lab',
          defaultTags: ['#js', '#async', '#promises', '#fsm'],
        });
        this.logger.log(`[CodeTasks] Auto-registered async challenges from: ${asyncPath}`);
      } catch (err: any) {
        this.logger.warn(`[CodeTasks] Could not auto-register async repo: ${err.message}`);
      }
    }

    // Автоматически регистрируем автономный практикум js-practice, если он существует
    const candidateJsPracticePaths = [
      path.resolve(process.env.USERPROFILE || '', 'projects', 'js-practice'),
      path.resolve(process.cwd(), '..', 'js-practice'),
      'c:/Users/Ilege/projects/js-practice',
    ];
    for (const jsPracticePath of candidateJsPracticePaths) {
      if (fs.existsSync(path.join(jsPracticePath, '.lemon', 'tasks.json'))) {
        try {
          await this.registerRepo({
            localPath: jsPracticePath,
            name: 'JavaScript Practice Lab (js-practice)',
            defaultTags: ['#js', '#practice', '#algorithms', '#typescript'],
          });
          this.logger.log(`[CodeTasks] Auto-registered js-practice from: ${jsPracticePath}`);
          break;
        } catch (err: any) {
          this.logger.warn(`[CodeTasks] Could not auto-register js-practice: ${err.message}`);
        }
      }
    }
  }

  onModuleDestroy() {
    for (const [id, watcher] of this.watchers.entries()) {
      try {
        watcher.close();
      } catch (_) {}
    }
    this.watchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  async listRepos(profileId?: string): Promise<CodeRepoView[]> {
    const list: CodeRepoView[] = [];

    for (const repo of this.repos.values()) {
      if (profileId && repo.profileId && repo.profileId !== profileId) {
        continue;
      }

      // Подсчитываем задачи в папке репозитория
      const flows = await this.flowsService.list({ folderId: repo.folderId });
      let passedCount = 0;
      let failedCount = 0;

      for (const f of flows) {
        const ct = ((f.config as any)?.codeTask ?? {}) as { status?: string };
        if (ct.status === 'PASSED') passedCount++;
        else if (ct.status === 'FAILED') failedCount++;
      }

      list.push({
        id: repo.id,
        name: repo.name,
        localPath: repo.localPath,
        folderId: repo.folderId,
        folderPath: repo.folderPath,
        profileId: repo.profileId,
        defaultTags: repo.defaultTags,
        tasksCount: flows.length,
        passedCount,
        failedCount,
        lastSyncAt: repo.lastSyncAt,
        isWatching: this.watchers.has(repo.id),
      });
    }

    return list;
  }

  async registerRepo(dto: RegisterCodeRepoDto): Promise<CodeRepoView> {
    const resolvedPath = path.resolve(dto.localPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new BadRequestException(`Directory does not exist: ${resolvedPath}`);
    }

    const lemonDir = path.join(resolvedPath, '.lemon');
    if (!fs.existsSync(lemonDir)) {
      fs.mkdirSync(lemonDir, { recursive: true });
    }

    // Читаем или инициализируем .lemon/config.json
    let repoName = dto.name;
    let repoTags = dto.defaultTags ?? ['#js'];
    const configFile = path.join(lemonDir, 'config.json');

    if (fs.existsSync(configFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (parsed.name && !repoName) repoName = parsed.name;
        if (Array.isArray(parsed.defaultTags)) {
          repoTags = Array.from(new Set([...repoTags, ...parsed.defaultTags]));
        }
      } catch (err: any) {
        this.logger.warn(`Could not parse config.json: ${err.message}`);
      }
    } else {
      const defaultConf = {
        name: repoName || path.basename(resolvedPath),
        defaultTags: repoTags,
        watch: { tasksFile: '.lemon/tasks.json', resultsFile: '.lemon/results.json' },
      };
      fs.writeFileSync(configFile, JSON.stringify(defaultConf, null, 2), 'utf-8');
    }

    repoName = repoName || path.basename(resolvedPath);

    // Определяем профиль
    let profileId = dto.profileId || null;
    if (!profileId) {
      const defaultProfile = await this.prisma.profile.findFirst({ orderBy: { createdAt: 'asc' } });
      profileId = defaultProfile?.id ?? null;
    }

    // Получаем существующие папки в скоупе code для данного профиля
    const codeFolders = await this.foldersRepo.findAll({
      profileId: profileId ?? undefined,
      scope: 'code',
    });

    // Создаем или находим родительскую ltree-папку "code"
    let rootCodeFolder = codeFolders.find((f) => f.path === 'code');
    if (!rootCodeFolder) {
      rootCodeFolder = await this.foldersRepo.insert('Code Lab', null, 'code', profileId);
    }

    // Создаем или находим подпапку репозитория: code.<repo_slug>
    const repoLabel = toLtreeLabel(repoName);
    const expectedPath = `code.${repoLabel}`;

    let repoFolder = codeFolders.find((f) => f.path === expectedPath);
    if (!repoFolder) {
      repoFolder = await this.foldersRepo.insert(repoName, rootCodeFolder.id, expectedPath, profileId);
    }

    const repoId = `repo-${toLtreeLabel(repoName)}`;
    const record: RegisteredRepoRecord = {
      id: repoId,
      name: repoName,
      localPath: resolvedPath,
      folderId: repoFolder.id,
      folderPath: repoFolder.path,
      profileId,
      defaultTags: repoTags,
      lastSyncAt: null,
    };

    this.repos.set(repoId, record);

    // Настраиваем FS Watcher
    this.setupWatcher(record);

    // Выполняем первую синхронизацию
    await this.syncRepo(repoId);

    return (await this.listRepos(profileId ?? undefined)).find((r) => r.id === repoId)!;
  }

  async unregisterRepo(repoId: string): Promise<void> {
    const watcher = this.watchers.get(repoId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(repoId);
    }
    const timer = this.debounceTimers.get(repoId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(repoId);
    }
    this.repos.delete(repoId);
  }

  async syncRepo(repoId: string): Promise<{ syncedTasks: number; updatedResults: number }> {
    const repo = this.repos.get(repoId);
    if (!repo) throw new NotFoundException(`Repo ${repoId} not found`);

    const lemonDir = path.join(repo.localPath, '.lemon');
    const tasksFile = path.join(lemonDir, 'tasks.json');
    const resultsFile = path.join(lemonDir, 'results.json');

    let tasks: RawTaskSpec[] = [];
    let defaultFsm: any = null;
    if (fs.existsSync(tasksFile)) {
      try {
        const content = fs.readFileSync(tasksFile, 'utf-8');
        const parsed = JSON.parse(content);
        tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        if (parsed.defaultFsm) defaultFsm = parsed.defaultFsm;
      } catch (err: any) {
        this.logger.warn(`[CodeTasks] Failed to parse tasks.json for ${repo.name}: ${err.message}`);
      }
    }

    let resultsMap = new Map<string, RawTestResult>();
    if (fs.existsSync(resultsFile)) {
      try {
        const content = fs.readFileSync(resultsFile, 'utf-8');
        const parsed = JSON.parse(content);
        const resultsList: RawTestResult[] = Array.isArray(parsed.results) ? parsed.results : [];
        for (const res of resultsList) {
          resultsMap.set(res.taskId, res);
        }
      } catch (err: any) {
        this.logger.warn(`[CodeTasks] Failed to parse results.json for ${repo.name}: ${err.message}`);
      }
    }

    // Синхронизируем каждую задачу с потоком Flow в Postgres
    const existingFlows = await this.flowsService.list({ folderId: repo.folderId });
    let updatedResults = 0;

    for (const task of tasks) {
      const taskTags = Array.from(
        new Set([...(repo.defaultTags || []), ...(task.tags || [])]),
      );

      // Ищем существующий Flow по slug или названию
      let flow = existingFlows.find(
        (f) =>
          ((f.config as any)?.codeTask?.id === task.id) ||
          ((f.config as any)?.codeTask?.slug === task.slug) ||
          f.name === task.title,
      );

      const testResult = resultsMap.get(task.id);
      const isPassed = testResult?.status === 'PASSED';
      const isFailed = testResult?.status === 'FAILED';
      const isStub = testResult?.status === 'STUB' || !testResult || (testResult.tests?.total === 0);

      const codeTaskMeta = {
        id: task.id,
        slug: task.slug,
        difficulty: task.difficulty || 'medium',
        testSuite: task.testSuite,
        repoId: repo.id,
        repoPath: repo.localPath,
        status: testResult?.status || (isStub ? 'STUB' : 'NEW'),
        testsTotal: testResult?.tests?.total ?? 0,
        testsPassed: testResult?.tests?.passed ?? 0,
        testsFailed: testResult?.tests?.failed ?? 0,
        testsSkipped: testResult?.tests?.skipped ?? 0,
        durationMs: testResult?.durationMs,
        lastLogs: testResult?.logs ?? [],
        lastRunAt: testResult ? new Date().toISOString() : undefined,
      };

      const taskFsm = (task as any).fsm || defaultFsm || null;
      const currentFsmState = isPassed ? 'passed' : isFailed ? 'debugging' : isStub ? 'stub' : 'in_progress';
      const fsmMeta = taskFsm
        ? {
            initial: taskFsm.initial || 'stub',
            currentState: currentFsmState,
            states: taskFsm.states,
          }
        : null;

      if (!flow) {
        // Создаем новый Flow
        flow = await this.flowsService.create({
          name: task.title,
          description: task.description || '',
          type: FlowType.MUTEX,
          folderId: repo.folderId,
          profileId: repo.profileId ?? undefined,
          tags: taskTags,
          config: {
            codeTask: codeTaskMeta,
            ...(fsmMeta ? { fsm: fsmMeta } : {}),
          },
        });

        // Записываем событие обнаружения задачи
        await this.flowsService.appendEvent(flow.id, {
          source: 'lemon-code-watcher',
          eventType: 'TASK_DISCOVERED',
          payload: {
            taskId: task.id,
            slug: task.slug,
            difficulty: task.difficulty,
            tags: taskTags,
            fsmState: currentFsmState,
          },
        });
      } else {
        // Обновляем существующий Flow
        const oldMeta = (flow.config as any)?.codeTask ?? {};
        const oldStatus = oldMeta.status;

        const nextConfig = {
          ...((flow.config as any) ?? {}),
          codeTask: codeTaskMeta,
          ...(fsmMeta ? { fsm: fsmMeta } : {}),
        };

        await this.flowsService.update(flow.id, {
          name: task.title,
          description: task.description || '',
          tags: taskTags,
          config: nextConfig,
        });

        // Логируем события изменения статуса тестов в FlowEvent
        if (testResult && oldStatus !== testResult.status) {
          if (isPassed) {
            await this.flowsService.appendEvent(flow.id, {
              source: 'lemon-code-watcher',
              eventType: 'TESTS_PASSED',
              payload: {
                action: 'all_tests_passed',
                tests: testResult.tests,
                durationMs: testResult.durationMs,
              },
            });

            // Если задача решена, закрываем сессию и помечаем как завершенную
            if (flow.status === FlowStatus.ACTIVE) {
              await this.flowsService.updateStatus(flow.id, FlowStatus.INACTIVE, 'tests:all_passed');
              await this.flowsService.appendEvent(flow.id, {
                source: 'lemon-code-watcher',
                eventType: 'TASK_COMPLETED',
                payload: {
                  note: 'Все тесты пройдены! Задача переведена в архив выполненных.',
                },
              });
            }
          } else if (isFailed) {
            const sanitizedLogs = (testResult.logs || []).slice(0, 3).map((l: any) => ({
              test: l.test,
              error: typeof l.error === 'string' ? l.error.slice(0, 200) : undefined,
            }));

            await this.flowsService.appendEvent(flow.id, {
              source: 'lemon-code-watcher',
              eventType: 'TESTS_FAILED',
              payload: {
                action: 'tests_failing',
                tests: testResult.tests,
                failedCount: testResult.tests?.failed,
                logs: sanitizedLogs,
              },
            });
          }
          updatedResults++;
        }
      }
    }

    repo.lastSyncAt = new Date().toISOString();
    return { syncedTasks: tasks.length, updatedResults };
  }

  async pushResults(repoId: string, dto: PushCodeResultsDto): Promise<{ processed: number }> {
    const repo = this.repos.get(repoId);
    if (!repo) throw new NotFoundException(`Repo ${repoId} not found`);

    const resultsFile = path.join(repo.localPath, '.lemon', 'results.json');
    const payload = {
      timestamp: new Date().toISOString(),
      runner: dto.runner || 'http-push',
      summary: dto.summary,
      results: dto.results,
    };

    fs.writeFileSync(resultsFile, JSON.stringify(payload, null, 2), 'utf-8');
    const syncRes = await this.syncRepo(repoId);
    return { processed: syncRes.updatedResults };
  }

  private setupWatcher(repo: RegisteredRepoRecord): void {
    const lemonDir = path.join(repo.localPath, '.lemon');
    if (!fs.existsSync(lemonDir)) return;

    try {
      const watcher = fs.watch(lemonDir, { recursive: false }, (_event, filename) => {
        if (!filename) return;
        const name = filename.toString();
        if (name === 'tasks.json' || name === 'results.json' || name === 'config.json') {
          this.debouncedSync(repo.id);
        }
      });

      watcher.on('error', (err) => {
        this.logger.warn(`Watcher error for ${repo.name}: ${err.message}`);
      });

      this.watchers.set(repo.id, watcher);
      this.logger.log(`[CodeTasks] Watching filesystem changes in: ${lemonDir}`);
    } catch (err: any) {
      this.logger.warn(`Could not start fs.watch on ${lemonDir}: ${err.message}`);
    }
  }

  private debouncedSync(repoId: string) {
    const existing = this.debounceTimers.get(repoId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(repoId);
      try {
        await this.syncRepo(repoId);
        this.logger.log(`[CodeTasks] Auto-synced repo ${repoId} after file change`);
      } catch (err: any) {
        this.logger.warn(`[CodeTasks] Auto-sync failed for ${repoId}: ${err.message}`);
      }
    }, 300);

    this.debounceTimers.set(repoId, timer);
  }

  /**
   * Гарантирует наличие корневого потока сессий агента.
   */
  private async ensureAgentSessionFlow(): Promise<string> {
    const defaultProfile = await this.prisma.profile.findFirst({ orderBy: { createdAt: 'asc' } });
    const profileId = defaultProfile?.id ?? undefined;

    const existing = await this.prisma.flow.findFirst({
      where: { name: 'Antigravity Agent Session Orchestrator' },
    });
    if (existing) return existing.id;

    // Ищем или создаем папку code
    const codeFolder = await this.prisma.folder.findFirst({
      where: { name: 'Code Lab' },
    });

    const flow = await this.flowsService.create({
      name: 'Antigravity Agent Session Orchestrator',
      description: 'Stream orchestrator for Antigravity coding agent sessions, decisions and EOD commits',
      type: FlowType.OBSERVER,
      folderId: codeFolder?.id,
      profileId,
      tags: ['#agent', '#antigravity', '#session'],
      config: {
        agentConfig: {
          runtime: 'antigravity-2.0',
          streamCoalescing: true,
        },
      },
    });

    return flow.id;
  }

  /**
   * Логирование начала сессии / открытия клиента кодинг-агента.
   */
  async startAgentSession(dto: StartAgentSessionDto) {
    const flowId = await this.ensureAgentSessionFlow();
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startedAt = new Date().toISOString();

    const sessionRecord = {
      sessionId,
      clientId: dto.clientId,
      clientVersion: dto.clientVersion || '2.0.0',
      agentRole: dto.agentRole || 'Full-Stack Coding Agent',
      workspaceRoot: dto.workspaceRoot || process.cwd(),
      repoName: dto.repoName || 'lemon-actions',
      environment: dto.environment || 'development',
      startedAt,
      status: 'ACTIVE',
      lastHeartbeatAt: startedAt,
      decisionsCount: 0,
      tasksCompletedCount: 0,
    };

    this.activeSessions.set(sessionId, sessionRecord);

    // Записываем событие старта сессии в долговечную историю
    await this.flowsService.appendEvent(flowId, {
      source: 'antigravity-agent',
      eventType: 'AGENT_SESSION_INIT',
      payload: sessionRecord,
    });

    // Излучаем оптимизированный импульс в Core Combinator
    if (this.eventBus) {
      this.eventBus.emit({
        id: `pulse-${Date.now()}`,
        type: 'AGENT_SESSION_INIT',
        folderId: null,
        flowId,
        flowName: 'Antigravity Agent Session Orchestrator',
        flowType: FlowType.OBSERVER,
        timestamp: startedAt,
        payload: sessionRecord,
      });
    }

    this.logger.log(`[AgentSession] Agent session initiated: ${sessionId} (${sessionRecord.agentRole})`);
    return sessionRecord;
  }

  /**
   * Легковесный heart-beat (коалесцируется StreamOptimizer, не спамит базу).
   */
  async sendAgentHeartbeat(dto: AgentHeartbeatDto) {
    const session = this.activeSessions.get(dto.sessionId);
    const now = new Date().toISOString();
    if (session) {
      session.lastHeartbeatAt = now;
    }

    if (this.eventBus) {
      const flowId = await this.ensureAgentSessionFlow();
      this.eventBus.emit({
        id: `hb-${Date.now()}`,
        type: 'AGENT_HEARTBEAT',
        folderId: null,
        flowId,
        flowName: 'Antigravity Agent Session Orchestrator',
        flowType: FlowType.OBSERVER,
        timestamp: now,
        payload: { sessionId: dto.sessionId, lastSeen: now },
      });
    }

    return { ok: true, timestamp: now };
  }

  /**
   * Запись архитектурного решения / мысли агента в память.
   */
  async recordAgentDecision(dto: RecordAgentDecisionDto) {
    const flowId = dto.flowId || (await this.ensureAgentSessionFlow());
    const decisionId = `decision-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const session = this.activeSessions.get(dto.sessionId);
    if (session) {
      session.decisionsCount = (session.decisionsCount || 0) + 1;
    }

    const decisionPayload = {
      decisionId,
      sessionId: dto.sessionId,
      title: dto.title,
      rationaleMarkdown: dto.rationaleMarkdown,
      tags: dto.tags || ['architecture', 'decision'],
      repoName: dto.repoName || 'lemon-actions',
      timestamp,
    };

    await this.flowsService.appendEvent(flowId, {
      source: 'antigravity-agent',
      eventType: 'AGENT_DECISION',
      payload: decisionPayload,
    });

    if (this.eventBus) {
      this.eventBus.emit({
        id: `decision-pulse-${Date.now()}`,
        type: 'AGENT_DECISION',
        folderId: null,
        flowId,
        flowName: 'Antigravity Agent Session Orchestrator',
        flowType: FlowType.OBSERVER,
        timestamp,
        payload: decisionPayload,
      });
    }

    this.logger.log(`[AgentDecision] Recorded architectural decision: "${dto.title}"`);
    return { ok: true, decisionId, timestamp };
  }

  /**
   * Создание среза в конце дня и коммит выжимки (End-of-Day Commit & Daily Digest).
   */
  async commitDailyDigest(dto: CommitDailyDigestDto) {
    const flowId = await this.ensureAgentSessionFlow();
    const dateKey = dto.date || new Date().toISOString().split('T')[0];
    const digestId = `digest-${dateKey}-${Date.now()}`;

    // 1. Собираем выполненные задачи за сегодня
    const codeFolders = await this.foldersRepo.findAll({ scope: 'code' });
    const codeFolderIds = codeFolders.map((f) => f.id);

    const codeFlows = await this.prisma.flow.findMany({
      where: {
        folderId: { in: codeFolderIds },
      },
    });

    const completedTasks: Array<{ id: string; title: string; testsPassed?: number; status: string }> = [];
    for (const f of codeFlows) {
      const taskMeta = (f.config as any)?.codeTask;
      if (taskMeta && (taskMeta.status === 'PASSED' || taskMeta.status === 'DONE')) {
        completedTasks.push({
          id: f.id,
          title: f.name,
          testsPassed: taskMeta.testsPassed || 0,
          status: taskMeta.status,
        });
      }
    }

    // 2. Собираем архитектурные решения за сегодня
    const decisionEvents = await this.prisma.flowEvent.findMany({
      where: {
        eventType: 'AGENT_DECISION',
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const decisions = decisionEvents.map((e) => {
      const p = (e.payload as any) || {};
      return {
        title: p.title || 'Architectural Decision',
        summary: (p.rationaleMarkdown || '').slice(0, 200),
      };
    });

    // 3. Получаем хэш коммита Git (если доступен)
    let commitHash = 'snapshot-' + Math.random().toString(36).substring(2, 8);
    try {
      commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // Игнорируем ошибку git если запускается без git cli
    }

    // 4. Формируем структурированный Markdown отчет
    const tasksMd = completedTasks.length > 0
      ? completedTasks.map((t) => `- ✅ **${t.title}** (${t.testsPassed} tests passed)`).join('\n')
      : '_Нет завершенных задач за сегодня._';

    const decisionsMd = decisions.length > 0
      ? decisions.map((d) => `- 💡 **${d.title}**: ${d.summary}`).join('\n')
      : '_Решений не зафиксировано._';

    const markdownSummary = `### 📅 Daily Digest [${dateKey}]
**Git Commit**: \`${commitHash}\` · ${dto.commitMessage || 'End-of-day checkpoint'}

#### 🎯 Выполненные задачи (${completedTasks.length}):
${tasksMd}

#### 💡 Архитектурные решения (${decisions.length}):
${decisionsMd}

---
_Срез сформирован агентом Antigravity в конце рабочего дня._`;

    const snapshot = {
      date: dateKey,
      digestId,
      generatedAt: new Date().toISOString(),
      commitHash,
      commitMessage: dto.commitMessage || `End-of-day digest snapshot for ${dateKey}`,
      repoPath: dto.repoPath || process.cwd(),
      tasksCompleted: completedTasks,
      decisions,
      metrics: {
        totalSessions: this.activeSessions.size || 1,
        tasksPassedCount: completedTasks.length,
        testsPassedCount: completedTasks.reduce((sum, t) => sum + (t.testsPassed || 0), 0),
      },
      markdownSummary,
    };

    // Сохраняем в долговечный лог
    await this.flowsService.appendEvent(flowId, {
      source: 'antigravity-agent',
      eventType: 'DAILY_DIGEST_COMMITTED',
      payload: snapshot,
    });

    // Излучаем импульс в Core Combinator
    if (this.eventBus) {
      this.eventBus.emit({
        id: `digest-pulse-${Date.now()}`,
        type: 'DAILY_DIGEST_COMMITTED',
        folderId: null,
        flowId,
        flowName: 'Antigravity Agent Session Orchestrator',
        flowType: FlowType.OBSERVER,
        timestamp: new Date().toISOString(),
        payload: snapshot,
      });
    }

    this.logger.log(`[DailyDigest] End-of-day commit & digest created for ${dateKey} (Commit: ${commitHash})`);
    return snapshot;
  }

  /**
   * Получение текущей выжимки за день.
   */
  async getTodayDigest(date?: string) {
    const flowId = await this.ensureAgentSessionFlow();
    const dateKey = date || new Date().toISOString().split('T')[0];

    const digestEvent = await this.prisma.flowEvent.findFirst({
      where: {
        flowId,
        eventType: 'DAILY_DIGEST_COMMITTED',
        payload: {
          path: ['date'],
          equals: dateKey,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (digestEvent) {
      return digestEvent.payload;
    }

    // Если коммит за день еще не сделан, генерируем драфт выжимки
    return this.generateDraftDigest(dateKey);
  }

  private async generateDraftDigest(dateKey: string) {
    const codeFolders = await this.foldersRepo.findAll({ scope: 'code' });
    const codeFolderIds = codeFolders.map((f) => f.id);

    const codeFlows = await this.prisma.flow.findMany({
      where: {
        folderId: { in: codeFolderIds },
      },
    });

    const completed = codeFlows
      .filter((f) => (f.config as any)?.codeTask?.status === 'PASSED')
      .map((f) => ({
        id: f.id,
        title: f.name,
        testsPassed: (f.config as any)?.codeTask?.testsPassed || 0,
        status: 'PASSED',
      }));

    return {
      date: dateKey,
      status: 'DRAFT',
      tasksCompleted: completed,
      activeSessionsCount: this.activeSessions.size,
      note: 'Срез за день еще не зафиксирован. Нажмите "Сделать коммит в конце дня".',
    };
  }

  /**
   * Получение истории сессий и решений.
   */
  async getAgentHistory(repoName?: string) {
    const flowId = await this.ensureAgentSessionFlow();

    const events = await this.prisma.flowEvent.findMany({
      where: {
        flowId,
        eventType: {
          in: ['AGENT_SESSION_INIT', 'DAILY_DIGEST_COMMITTED', 'AGENT_DECISION'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      activeSessions: Array.from(this.activeSessions.values()),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        createdAt: e.createdAt,
        payload: e.payload,
      })),
    };
  }

  /**
   * Запуск миграции старых данных.
   */
  async runMigration() {
    this.logger.log('[Migration] Starting data cleanup & migration...');
    const result = await runAgentDataMigration(this.prisma);
    this.logger.log(`[Migration] Completed: ${JSON.stringify(result)}`);
    return result;
  }
}
