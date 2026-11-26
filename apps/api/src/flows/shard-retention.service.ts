import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FlowsRepository } from './flows.repository';

export interface ShardRetentionStatus {
  enabled: boolean;
  retentionDays: number;
  intervalMs: number;
  lastPrunedAt: string | null;
  lastDeletedEvents: number;
  lastDeletedBufferItems: number;
}

export interface ShardRetentionPruneResult {
  prunedAt: string;
  cutoffIso: string;
  retentionDays: number;
  projectSlug: string | null;
  deletedEvents: number;
  deletedBufferItems: number;
}

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class ShardRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShardRetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private isPruning = false;

  private lastPrunedAt: string | null = null;
  private lastDeletedEvents = 0;
  private lastDeletedBufferItems = 0;

  constructor(private readonly repo: FlowsRepository) {}

  get retentionDays(): number {
    const raw = Number(process.env.LEMON_SHARD_EVENT_RETENTION_DAYS);
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    return DEFAULT_RETENTION_DAYS;
  }

  get intervalMs(): number {
    const raw = Number(process.env.LEMON_SHARD_RETENTION_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= 1000) return Math.floor(raw);
    return DEFAULT_RETENTION_INTERVAL_MS;
  }

  get isEnabled(): boolean {
    return process.env.SHARD_RETENTION_ENABLED !== 'false' && this.retentionDays > 0;
  }

  onModuleInit(): void {
    if (!this.isEnabled) {
      return;
    }
    this.timer = setInterval(() => {
      void this.prune().catch((err) => {
        this.logger.warn(`Retention sweep failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getRetentionStatus(): ShardRetentionStatus {
    return {
      enabled: this.isEnabled,
      retentionDays: this.retentionDays,
      intervalMs: this.intervalMs,
      lastPrunedAt: this.lastPrunedAt,
      lastDeletedEvents: this.lastDeletedEvents,
      lastDeletedBufferItems: this.lastDeletedBufferItems,
    };
  }

  async prune(options?: { retentionDays?: number; projectSlug?: string; now?: Date }): Promise<ShardRetentionPruneResult> {
    const days =
      options?.retentionDays !== undefined && Number.isFinite(options.retentionDays) && options.retentionDays > 0
        ? Math.floor(options.retentionDays)
        : this.retentionDays;

    const now = options?.now ?? new Date();
    const scopedProject =
      options?.projectSlug?.trim().toLowerCase() ||
      (process.env.LEMON_SHARD_TIER === 'dedicated' ? process.env.LEMON_SHARD_PROJECT_SLUG?.trim().toLowerCase() : undefined) ||
      null;

    if (days <= 0 || this.isPruning) {
      return {
        prunedAt: now.toISOString(),
        cutoffIso: now.toISOString(),
        retentionDays: days,
        projectSlug: scopedProject,
        deletedEvents: 0,
        deletedBufferItems: 0,
      };
    }

    this.isPruning = true;
    try {
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const res =
        typeof (this.repo as any).purgeExpiredEvents === 'function'
          ? await this.repo.purgeExpiredEvents(cutoffDate, scopedProject ?? undefined)
          : { deletedEvents: 0, deletedBufferItems: 0 };

      this.lastPrunedAt = now.toISOString();
      this.lastDeletedEvents = res.deletedEvents;
      this.lastDeletedBufferItems = res.deletedBufferItems;

      if (res.deletedEvents > 0 || res.deletedBufferItems > 0) {
        this.logger.log(
          `[Retention] Purged ${res.deletedEvents} flow_events & ${res.deletedBufferItems} flushed buffer items older than ${days}d`,
        );
      }

      return {
        prunedAt: this.lastPrunedAt,
        cutoffIso: cutoffDate.toISOString(),
        retentionDays: days,
        projectSlug: scopedProject,
        deletedEvents: res.deletedEvents,
        deletedBufferItems: res.deletedBufferItems,
      };
    } finally {
      this.isPruning = false;
    }
  }
}
