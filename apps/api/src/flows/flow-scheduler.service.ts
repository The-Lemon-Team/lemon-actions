import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import { FlowsRepository } from './flows.repository';
import { FlowOrchestratorRules, FlowsService, ScheduleWindowRule } from './flows.service';

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

  constructor(
    private readonly repo: FlowsRepository,
    private readonly flowsService: FlowsService,
  ) {}

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

    let scheduleToggled = 0;
    let leaseTimedOut = 0;
    let timerTicks = 0;
    let circuitBreakersRecovered = 0;
    let batchesFlushed = 0;

    try {
      const flows = await this.repo.findMany({});

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

        // 3. TIMER: циклическое тиканье с заданным интервалом
        if (flow.type === FlowType.TIMER && flow.status === FlowStatus.ACTIVE) {
          const cfg = (flow.config ?? {}) as { intervalSeconds?: number; lastTickAt?: string };
          const intervalSec = cfg.intervalSeconds && cfg.intervalSeconds > 0 ? cfg.intervalSeconds : 60;
          const lastTick = cfg.lastTickAt ? new Date(cfg.lastTickAt).getTime() : 0;
          const elapsed = (now.getTime() - lastTick) / 1000;

          if (elapsed >= intervalSec) {
            try {
              await this.flowsService.emitTimerTick(flow.id, now);
              timerTicks++;
              this.logger.log(`[Timer Tick] "${flow.name}" ticked (interval ${intervalSec}s)`);
            } catch (err: any) {
              this.logger.warn(`[Timer Tick] Could not tick "${flow.name}": ${err.message}`);
            }
          }
        }

        // 4. CIRCUIT_BREAKER: автоматический переход OPEN -> HALF_OPEN по истечении cooldown
        if (flow.type === FlowType.CIRCUIT_BREAKER) {
          const cfg = (flow.config ?? {}) as { state?: string; openedAt?: string; cooldownSeconds?: number };
          if (cfg.state === 'OPEN') {
            const openedAt = cfg.openedAt ? new Date(cfg.openedAt).getTime() : new Date(flow.updatedAt).getTime();
            const cooldownSec = cfg.cooldownSeconds && cfg.cooldownSeconds > 0 ? cfg.cooldownSeconds : 60;
            const elapsed = (now.getTime() - openedAt) / 1000;

            if (elapsed >= cooldownSec) {
              try {
                await this.flowsService.updateCircuitBreaker(flow.id, 'HALF_OPEN', 'cooldown_expired');
                circuitBreakersRecovered++;
                this.logger.log(
                  `[Circuit Breaker] "${flow.name}" OPEN -> HALF_OPEN (cooldown ${cooldownSec}s expired)`,
                );
              } catch (err: any) {
                this.logger.warn(`[Circuit Breaker] Could not probe "${flow.name}": ${err.message}`);
              }
            }
          }
        }

        // 5. BATCH: проверка условий сброса буфера (maxWaitSeconds или idleTimeoutSeconds)
        if (flow.type === FlowType.BATCH && flow.status === FlowStatus.ACTIVE) {
          const cfg = (flow.config ?? {}) as {
            pendingCount?: number;
            maxWaitSeconds?: number;
            idleTimeoutSeconds?: number;
            windowStartedAt?: string;
            lastItemAt?: string;
          };
          const pending = cfg.pendingCount ?? 0;
          if (pending > 0) {
            const maxWait = cfg.maxWaitSeconds && cfg.maxWaitSeconds > 0 ? cfg.maxWaitSeconds : 60;
            const idleTimeout = cfg.idleTimeoutSeconds && cfg.idleTimeoutSeconds > 0 ? cfg.idleTimeoutSeconds : 10;
            const windowStart = cfg.windowStartedAt
              ? new Date(cfg.windowStartedAt).getTime()
              : new Date(flow.updatedAt).getTime();
            const lastItem = cfg.lastItemAt ? new Date(cfg.lastItemAt).getTime() : windowStart;

            const waitElapsed = (now.getTime() - windowStart) / 1000;
            const idleElapsed = (now.getTime() - lastItem) / 1000;

            if (waitElapsed >= maxWait || idleElapsed >= idleTimeout) {
              try {
                await this.flowsService.flushBatch(
                  flow.id,
                  waitElapsed >= maxWait ? 'MAX_WAIT_TIMEOUT' : 'IDLE_TIMEOUT',
                );
                batchesFlushed++;
                this.logger.log(`[Batch Flush] "${flow.name}" auto-flushed ${pending} items`);
              } catch (err: any) {
                this.logger.warn(`[Batch Flush] Could not flush "${flow.name}": ${err.message}`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`[FlowScheduler] Tick error: ${err.message}`);
    } finally {
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
