import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FlowStatus } from '@prisma/client';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';

export interface ScheduleWindowRule {
  days?: number[]; // 0 (Вс) .. 6 (Сб), например [1, 2, 3, 4, 5]
  start: string;   // 'HH:mm'
  end: string;     // 'HH:mm'
}

export interface FlowOrchestratorRules {
  onConflict?: 'reject' | 'pause';
  leaseTimeoutSeconds?: number;
  schedule?: {
    enabled?: boolean;
    windows: ScheduleWindowRule[];
  };
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
   * Проверяет расписания (Scheduled Mutex) и таймауты аренды (leaseTimeoutSeconds).
   * Меняет только статус самого потока и открывает/закрывает его сессию (flow_sessions),
   * не отсекая и не блокируя историю событий нейрона.
   */
  async tick(now = new Date()): Promise<{ scheduleToggled: number; leaseTimedOut: number }> {
    if (this.isRunning) return { scheduleToggled: 0, leaseTimedOut: 0 };
    this.isRunning = true;

    let scheduleToggled = 0;
    let leaseTimedOut = 0;

    try {
      const flows = await this.repo.findMany({});

      for (const flow of flows) {
        const rules = (flow.orchestratorRules ?? {}) as FlowOrchestratorRules;

        // 1. Scheduled Mutex: разметка начала и конца временного окна
        if (rules.schedule && rules.schedule.enabled !== false && Array.isArray(rules.schedule.windows) && rules.schedule.windows.length > 0) {
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
      }
    } catch (err: any) {
      this.logger.error(`[FlowScheduler] Tick error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }

    return { scheduleToggled, leaseTimedOut };
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
