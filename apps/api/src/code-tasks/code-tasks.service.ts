import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { FlowsService } from '../flows/flows.service';
import { toLtreeLabel } from '../folders/folders.service';
import { FoldersRepository } from '../folders/folders.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CodeRepoView, PushCodeResultsDto, RegisterCodeRepoDto } from './code-tasks.dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly foldersRepo: FoldersRepository,
    private readonly flowsService: FlowsService,
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
    if (fs.existsSync(tasksFile)) {
      try {
        const content = fs.readFileSync(tasksFile, 'utf-8');
        const parsed = JSON.parse(content);
        tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
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

      if (!flow) {
        // Создаем новый Flow
        flow = await this.flowsService.create({
          name: task.title,
          description: task.description || '',
          type: FlowType.MUTEX,
          folderId: repo.folderId,
          profileId: repo.profileId ?? undefined,
          tags: taskTags,
          config: { codeTask: codeTaskMeta },
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
          },
        });
      } else {
        // Обновляем существующий Flow
        const oldMeta = (flow.config as any)?.codeTask ?? {};
        const oldStatus = oldMeta.status;

        const nextConfig = {
          ...((flow.config as any) ?? {}),
          codeTask: codeTaskMeta,
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
            await this.flowsService.appendEvent(flow.id, {
              source: 'lemon-code-watcher',
              eventType: 'TESTS_FAILED',
              payload: {
                action: 'tests_failing',
                tests: testResult.tests,
                failedCount: testResult.tests?.failed,
                logs: testResult.logs,
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
}
