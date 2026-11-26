import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { FlowStatus } from '@prisma/client';
import { FlowsRepository } from './flows.repository';
import { FlowOrchestratorRules, FlowsService, ScheduleWindowRule } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

export { FlowOrchestratorRules, ScheduleWindowRule };

export interface FlowSchedulerTickResult {
  scheduleToggled: number;
  leaseTimedOut: number;
  timerTicks: number;
  circuitBreakersRecovered: number;
  batchesFlushed: number;
}

@Injectable()
export class FlowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FlowSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastTickAt: string | null = null;
  private lastTickDurationMs = 0;
  private lastSchedulableCount = 0;
  private readonly registry: FlowTypeRegistry;

  constructor(
    private readonly repo: FlowsRepository,
    private readonly flowsService: FlowsService,
    @Optional() registry?: FlowTypeRegistry,
  ) {
    this.registry = registry ?? flowsService.typeRegistry ?? new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  }

  getDiagnostics() {
    return {
      lastTickAt: this.lastTickAt,
      lastTickDurationMs: this.lastTickDurationMs,
      schedulableCount: this.lastSchedulableCount,
    };
  }

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), 15000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Проверяет расписания (Scheduled Mutex), таймауты аренды (leaseTimeoutSeconds),
   * циклы таймеров (FlowType.TIMER), восстановление Circuit Breaker и сброс Batch буферов.
   */
  async tick(now = new Date()): Promise<FlowSchedulerTickResult> {
    if (this.isRunning) {
      return {
        scheduleToggled: 0,
        leaseTimedOut: 0,
        timerTicks: 0,
        circuitBreakersRecovered: 0,
        batchesFlushed: 0,
      };
    }
    this.isRunning = true;
    const startedMs = Date.now();

    let scheduleToggled = 0;
    let leaseTimedOut = 0;
    let timerTicks = 0;
    let circuitBreakersRecovered = 0;
    let batchesFlushed = 0;

    try {
      const flows =
        typeof (this.repo as any).findSchedulableFlows === 'function'
          ? await (this.repo as any).findSchedulableFlows()
          : await this.repo.findMany({});
      this.lastSchedulableCount = flows.length;

      for (const flow of flows) {
        const rules = (flow.orchestratorRules ?? {}) as FlowOrchestratorRules;

        // 1. Scheduled Mutex: разметка начала и конца временного окна
        if (
          rules.schedule &&
          rules.schedule.enabled !== false &&
          Array.isArray(rules.schedule.windows) &&
          rules.schedule.windows.length > 0
        ) {
          const inWindow = this.isWithinSchedule(rules.schedule.windows, now);
          const desiredStatus = inWindow ? FlowStatus.ACTIVE : FlowStatus.INACTIVE;

          if (flow.status !== desiredStatus) {
            try {
              await this.flowsService.updateStatus(
                flow.id,
                desiredStatus,
                inWindow ? 'schedule:window_start' : 'schedule:window_end',
              );
              scheduleToggled++;
              this.logger.log(`[Scheduled Mutex] "${flow.name}" -> ${desiredStatus}`);
            } catch (err: any) {
              this.logger.warn(`[Scheduled Mutex] Could not toggle "${flow.name}": ${err.message}`);
            }
            continue;
          }
        }

        // 2. Lease Timeout: автоматическое закрытие сессии при прекращении пульса от внешнего адаптера
        if (flow.status === FlowStatus.ACTIVE && rules.leaseTimeoutSeconds && rules.leaseTimeoutSeconds > 0) {
          const elapsedSec = (now.getTime() - new Date(flow.updatedAt).getTime()) / 1000;
          if (elapsedSec > rules.leaseTimeoutSeconds) {
            await this.flowsService.updateStatus(flow.id, FlowStatus.INACTIVE, 'lease:timeout');
            leaseTimedOut++;
            this.logger.log(`[Lease Timeout] "${flow.name}" -> INACTIVE (idle ${Math.round(elapsedSec)}s)`);
          }
        }

        // 3. Delegate type-specific scheduling (TIMER, CIRCUIT_BREAKER, BATCH, custom types) to handler
        const handler = this.registry.has(flow.type) ? this.registry.get(flow.type) : null;
        if (handler?.onSchedulerTick) {
          try {
            const metric = await handler.onSchedulerTick({
              flow,
              now,
              emitTimerTick: (flowId, tickAt) => this.flowsService.emitTimerTick(flowId, tickAt),
              updateCircuitBreaker: (flowId, state, reason) =>
                this.flowsService.updateCircuitBreaker(flowId, state, reason),
              flushBatch: (flowId, reason) => this.flowsService.flushBatch(flowId, reason),
            });
            if (metric === 'timerTicks') {
              timerTicks++;
              this.logger.log(`[Timer Tick] "${flow.name}" ticked`);
            } else if (metric === 'circuitBreakersRecovered') {
              circuitBreakersRecovered++;
              this.logger.log(`[Circuit Breaker] "${flow.name}" OPEN -> HALF_OPEN`);
            } else if (metric === 'batchesFlushed') {
              batchesFlushed++;
              this.logger.log(`[Batch Flush] "${flow.name}" auto-flushed`);
            }
          } catch (err: any) {
            this.logger.warn(`[Scheduler Handler:${flow.type}] "${flow.name}" error: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`[FlowScheduler] Tick error: ${err.message}`);
    } finally {
      this.lastTickAt = now.toISOString();
      this.lastTickDurationMs = Date.now() - startedMs;
      this.isRunning = false;
    }

    return { scheduleToggled, leaseTimedOut, timerTicks, circuitBreakersRecovered, batchesFlushed };
  }

  isWithinSchedule(windows: ScheduleWindowRule[], now: Date): boolean {
    const dayOfWeek = now.getDay();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentHm = `${hh}:${mm}`;

    for (const win of windows) {
      if (Array.isArray(win.days) && win.days.length > 0 && !win.days.includes(dayOfWeek)) {
        continue;
      }
      if (win.start <= win.end) {
        if (currentHm >= win.start && currentHm < win.end) return true;
      } else {
        // Ночное окно через полночь (например 20:00 -> 08:00)
        if (currentHm >= win.start || currentHm < win.end) return true;
      }
    }
    return false;
  }
}
