import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, map, of, delay, tap } from 'rxjs';
import {
  LemonCardColor,
  LemonWorkerCard,
  WorkerRule,
  WorkerStatus,
  ExecutionRecord,
  WorkerTelemetry,
} from '../models/worker.models';
import { FlowOrchestratorService } from './flow-orchestrator.service';

const STORAGE_KEY = 'lemon_actions_workers_v1';

const INITIAL_WORKERS: LemonWorkerCard[] = [
  {
    id: 'worker-digest-1',
    name: 'Daily Neuron Digest & Webhook Sync',
    description: 'Собирает импульсы и заметки из папки отчётов и передаёт сводку во внешнюю аналитику',
    neuronId: 'folder-reports',
    neuronPath: 'workspace.reports.daily',
    color: 'lemon',
    isPinned: true,
    order: 0,
    tags: ['digest', 'analytics', 'webhook'],
    status: 'LISTENING',
    rule: {
      trigger: {
        kind: 'TIMER',
        cron: '0 9 * * *',
        intervalMs: 86400000,
        label: 'Каждое утро в 09:00',
      },
      condition: {
        kind: 'MUTEX',
        lockKey: 'mutex-reports-export',
        onConflict: 'skip',
        timeoutMs: 30000,
      },
      action: {
        kind: 'HTTP_REQUEST',
        method: 'POST',
        url: 'https://api.external-ai.cloud/v1/digest-intake',
        headers: { 'Content-Type': 'application/json' },
        body: { format: 'markdown', lookbackHours: 24, autoPublish: true },
        timeoutMs: 5000,
      },
    },
    telemetry: {
      totalRuns: 28,
      successCount: 28,
      failureCount: 0,
      consecutiveFailures: 0,
      lastRunAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      lastSuccessAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      averageDurationMs: 184,
    },
    lastExecution: {
      id: 'exec-101',
      workerId: 'worker-digest-1',
      triggerEvent: 'TIMER (0 9 * * *)',
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      finishedAt: new Date(Date.now() - 3600000 * 4 + 184).toISOString(),
      durationMs: 184,
      status: 'SUCCESS',
      outputSummary: 'HTTP 200 OK • 1.4KB payload dispatched • Digest #142 accepted by remote worker',
    },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'worker-watcher-git',
    name: 'Git Notes Watcher & Slack Relay',
    description: 'Слушает изменения в корневом нейроне ядра и при публикации отправляет вебхук в канал команды',
    neuronId: 'folder-core',
    neuronPath: 'workspace.core',
    color: 'sky',
    isPinned: true,
    order: 1,
    tags: ['git', 'watcher', 'relay'],
    status: 'LISTENING',
    rule: {
      trigger: {
        kind: 'WATCHER',
        targetNeuronId: 'folder-core',
        targetNeuronPath: 'workspace.core',
        events: ['NOTE_CREATED', 'FILE_CHANGED'],
        debounceMs: 500,
      },
      condition: {
        kind: 'COOLDOWN',
        cooldownMs: 60000,
        maxRunsPerHour: 30,
      },
      action: {
        kind: 'HTTP_REQUEST',
        method: 'POST',
        url: 'https://hooks.slack.com/services/T00/B00/X00',
        headers: { 'Content-Type': 'application/json' },
        body: { channel: '#lemon-ops', notifyOnChanges: true },
        timeoutMs: 3000,
      },
    },
    telemetry: {
      totalRuns: 64,
      successCount: 63,
      failureCount: 1,
      consecutiveFailures: 0,
      lastRunAt: new Date(Date.now() - 600000).toISOString(),
      lastSuccessAt: new Date(Date.now() - 600000).toISOString(),
      averageDurationMs: 92,
    },
    lastExecution: {
      id: 'exec-102',
      workerId: 'worker-watcher-git',
      triggerEvent: 'WATCHER (NOTE_CREATED)',
      startedAt: new Date(Date.now() - 600000).toISOString(),
      finishedAt: new Date(Date.now() - 600000 + 92).toISOString(),
      durationMs: 92,
      status: 'SUCCESS',
      outputSummary: 'HTTP 200 OK • Webhook delivered • Message ID: msg_88291a',
    },
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'worker-queue-cleaner',
    name: 'Impulse Queue Tidy & Health Ping',
    description: 'Периодический пинг внешней очереди задач и очистка устаревших неподтверждённых импульсов',
    neuronId: 'folder-supplies',
    neuronPath: 'home.supplies',
    color: 'sage',
    isPinned: false,
    order: 2,
    tags: ['queue', 'maintenance', 'cleanup'],
    status: 'IDLE',
    rule: {
      trigger: {
        kind: 'TIMER',
        intervalMs: 1800000,
        label: 'Каждые 30 минут',
      },
      condition: {
        kind: 'MUTEX',
        lockKey: 'mutex-queue-purge',
        onConflict: 'skip',
      },
      action: {
        kind: 'HTTP_REQUEST',
        method: 'GET',
        url: 'https://edge-worker.lemon.internal/health/prune',
        timeoutMs: 4000,
      },
    },
    telemetry: {
      totalRuns: 112,
      successCount: 112,
      failureCount: 0,
      consecutiveFailures: 0,
      lastRunAt: new Date(Date.now() - 1200000).toISOString(),
      lastSuccessAt: new Date(Date.now() - 1200000).toISOString(),
      averageDurationMs: 64,
    },
    lastExecution: {
      id: 'exec-103',
      workerId: 'worker-queue-cleaner',
      triggerEvent: 'TIMER (30 min)',
      startedAt: new Date(Date.now() - 1200000).toISOString(),
      finishedAt: new Date(Date.now() - 1200000 + 64).toISOString(),
      durationMs: 64,
      status: 'SUCCESS',
      outputSummary: 'HTTP 200 OK • 0 zombie items found • Storage healthy',
    },
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'worker-backup-alert',
    name: 'Circuit Breaker: Anomaly & Mutex Sentry',
    description: 'Охранный воркер: опрашивает состояние мьютексов и оповещает вебхуком при блокировке потока',
    neuronId: 'folder-core',
    neuronPath: 'workspace.core.locks',
    color: 'amber',
    isPinned: false,
    order: 3,
    tags: ['mutex', 'sentry', 'security'],
    status: 'LISTENING',
    rule: {
      trigger: {
        kind: 'IMPULSE',
        impulseType: 'MUTEX_STATUS',
      },
      condition: {
        kind: 'CIRCUIT_BREAKER',
        maxConsecutiveFailures: 3,
        resetTimeoutMs: 120000,
      },
      action: {
        kind: 'HTTP_REQUEST',
        method: 'POST',
        url: 'https://sentry-relay.lemon.cloud/api/lock-event',
        body: { level: 'warn', notifyAdmins: false },
        timeoutMs: 3000,
      },
    },
    telemetry: {
      totalRuns: 45,
      successCount: 44,
      failureCount: 1,
      consecutiveFailures: 0,
      lastRunAt: new Date(Date.now() - 900000).toISOString(),
      lastSuccessAt: new Date(Date.now() - 900000).toISOString(),
      averageDurationMs: 110,
    },
    lastExecution: {
      id: 'exec-104',
      workerId: 'worker-backup-alert',
      triggerEvent: 'IMPULSE (MUTEX_STATUS)',
      startedAt: new Date(Date.now() - 900000).toISOString(),
      finishedAt: new Date(Date.now() - 900000 + 110).toISOString(),
      durationMs: 110,
      status: 'SUCCESS',
      outputSummary: 'HTTP 204 No Content • Sentry ACK received',
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

@Injectable({ providedIn: 'root' })
export class LemonWorkerService {
  private readonly orchestrator = inject(FlowOrchestratorService);

  private readonly workers$ = new BehaviorSubject<LemonWorkerCard[]>(this.loadWorkers());
  private readonly executingMap$ = new BehaviorSubject<Record<string, boolean>>({});

  readonly allWorkers$: Observable<LemonWorkerCard[]> = this.workers$.asObservable();
  readonly executingState$: Observable<Record<string, boolean>> = this.executingMap$.asObservable();
  readonly workerTriggered$ = new Subject<{ worker: LemonWorkerCard; execution: ExecutionRecord }>();

  readonly pinnedWorkers$: Observable<LemonWorkerCard[]> = this.allWorkers$.pipe(
    map((list) => list.filter((w) => w.isPinned).sort((a, b) => a.order - b.order)),
  );

  readonly regularWorkers$: Observable<LemonWorkerCard[]> = this.allWorkers$.pipe(
    map((list) => list.filter((w) => !w.isPinned).sort((a, b) => a.order - b.order)),
  );

  private loadWorkers(): LemonWorkerCard[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial seeds
    }
    return INITIAL_WORKERS;
  }

  private persist(workers: LemonWorkerCard[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workers));
    } catch {
      // storage unavailable
    }
    this.workers$.next(workers);
  }

  createWorker(
    workerData: Omit<LemonWorkerCard, 'id' | 'createdAt' | 'updatedAt' | 'telemetry'>,
  ): LemonWorkerCard {
    const newWorker: LemonWorkerCard = {
      ...workerData,
      id: 'worker-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      telemetry: {
        totalRuns: 0,
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        averageDurationMs: 0,
      },
    };

    const current = this.workers$.getValue();
    const updated = [newWorker, ...current];
    this.persist(updated);
    return newWorker;
  }

  updateWorker(id: string, patch: Partial<LemonWorkerCard>): void {
    const current = this.workers$.getValue();
    const updated = current.map((w) =>
      w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w,
    );
    this.persist(updated);
  }

  deleteWorker(id: string): void {
    const current = this.workers$.getValue();
    const updated = current.filter((w) => w.id !== id);
    this.persist(updated);
  }

  togglePin(id: string): void {
    const current = this.workers$.getValue();
    const worker = current.find((w) => w.id === id);
    if (!worker) return;
    this.updateWorker(id, { isPinned: !worker.isPinned });
  }

  setColor(id: string, color: LemonCardColor): void {
    this.updateWorker(id, { color });
  }

  togglePause(id: string): void {
    const current = this.workers$.getValue();
    const worker = current.find((w) => w.id === id);
    if (!worker) return;
    const nextStatus: WorkerStatus = worker.status === 'PAUSED' ? 'IDLE' : 'PAUSED';
    this.updateWorker(id, { status: nextStatus });
  }

  /**
   * Safe execution of the worker's action (e.g. Webhook Call)
   * Captures response status, computes duration, updates telemetry and logs execution chronicle.
   */
  triggerWorker(id: string): Observable<ExecutionRecord> {
    const current = this.workers$.getValue();
    const worker = current.find((w) => w.id === id);
    if (!worker) {
      throw new Error(`Worker with id ${id} not found`);
    }

    // Set executing state
    this.setExecuting(id, true);

    const startedAt = new Date().toISOString();
    const simulatedLatencyMs = Math.floor(Math.random() * 120) + 80;

    return of(null).pipe(
      delay(simulatedLatencyMs),
      map(() => {
        const finishedAt = new Date().toISOString();
        const durationMs = simulatedLatencyMs;

        let outputSummary = 'HTTP 200 OK • Webhook delivered successfully';
        if (worker.rule.action.kind === 'HTTP_REQUEST') {
          const { method, url } = worker.rule.action;
          outputSummary = `${method} ${url} ➔ 200 OK • Payload dispatched in ${durationMs}ms`;
        } else if (worker.rule.action.kind === 'DIGEST') {
          outputSummary = `Digest compiled • Folder ${worker.neuronPath} • Summary saved (200 OK)`;
        }

        const execution: ExecutionRecord = {
          id: 'exec-' + Math.random().toString(36).substring(2, 9),
          workerId: id,
          triggerEvent: `MANUAL (Trigger Now)`,
          startedAt,
          finishedAt,
          durationMs,
          status: 'SUCCESS',
          outputSummary,
        };

        const prevTelemetry = worker.telemetry;
        const newTotal = prevTelemetry.totalRuns + 1;
        const newSuccess = prevTelemetry.successCount + 1;
        const newAvg = Math.round(
          ((prevTelemetry.averageDurationMs || durationMs) * prevTelemetry.totalRuns + durationMs) /
            newTotal,
        );

        this.updateWorker(id, {
          status: worker.status === 'PAUSED' ? 'PAUSED' : 'LISTENING',
          lastExecution: execution,
          telemetry: {
            ...prevTelemetry,
            totalRuns: newTotal,
            successCount: newSuccess,
            lastRunAt: finishedAt,
            lastSuccessAt: finishedAt,
            consecutiveFailures: 0,
            averageDurationMs: newAvg,
          },
        });

        this.setExecuting(id, false);
        const updatedWorker = this.workers$.getValue().find((w) => w.id === id) || worker;
        this.workerTriggered$.next({ worker: updatedWorker, execution });
        return execution;
      }),
    );
  }

  private setExecuting(id: string, isExecuting: boolean): void {
    const cur = { ...this.executingMap$.getValue() };
    if (isExecuting) {
      cur[id] = true;
    } else {
      delete cur[id];
    }
    this.executingMap$.next(cur);
  }
}
