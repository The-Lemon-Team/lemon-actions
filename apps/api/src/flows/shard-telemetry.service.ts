import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import { StackBusService } from '../bus/stack-bus.service';
import { PrismaService } from '../prisma/prisma.service';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { ShardRetentionService, ShardRetentionStatus } from './shard-retention.service';

export type ShardTier = 'logical' | 'embedded' | 'dedicated';

export interface ShardHealthSnapshot {
  status: 'ok' | 'degraded';
  projectSlug: string;
  shardId: string;
  tier: ShardTier;
  uptimeSec: number;
  timestamp: string;
  db: { connected: boolean; latencyMs: number | null };
  bus: { driver: string; connected: boolean };
  flows: {
    total: number;
    active: number;
    paused: number;
    processing: number;
    inactive: number;
    openSessions: number;
    openCircuitBreakers: number;
  };
  scheduler: {
    lastTickAt: string | null;
    lastTickDurationMs: number;
    schedulableCount: number;
  };
  optimizer: {
    totalImpulsesReceived: number;
    totalImpulsesEmitted: number;
    totalImpulsesSuppressed: number;
    reductionRatePct: number;
    pendingCoalesceBuffers: number;
  };
  retention?: ShardRetentionStatus | null;
}

const DEFAULT_METRICS_INTERVAL_MS = 30_000;

@Injectable()
export class ShardTelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShardTelemetryService.name);
  private readonly startedAtMs = Date.now();
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly flowsService: FlowsService,
    private readonly scheduler: FlowSchedulerService,
    private readonly eventBus: FlowsEventBusService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly stackBus?: StackBusService,
    @Optional() private readonly retention?: ShardRetentionService,
  ) {}

  get projectSlug(): string {
    return (process.env.LEMON_SHARD_PROJECT_SLUG || 'lemon-core').trim().toLowerCase();
  }

  get shardId(): string {
    return (process.env.LEMON_SHARD_ID || `shard-${this.projectSlug}-main`).trim();
  }

  get tier(): ShardTier {
    const raw = (process.env.LEMON_SHARD_TIER || 'logical').trim().toLowerCase();
    if (raw === 'embedded' || raw === 'dedicated') return raw;
    return 'logical';
  }

  onModuleInit(): void {
    if (process.env.SHARD_METRICS_PUBLISH === 'false') {
      return;
    }
    const intervalMs = Number(process.env.SHARD_METRICS_INTERVAL_MS) || DEFAULT_METRICS_INTERVAL_MS;
    this.metricsTimer = setInterval(() => {
      void this.publishMetricsSnapshot().catch((err) => {
        this.logger.debug(`Shard metrics publish skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, Math.max(5000, intervalMs));
    this.metricsTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  async getHealthSnapshot(): Promise<ShardHealthSnapshot> {
    const now = new Date();
    const dbCheck = await this.checkDatabase();
    const busCheck = await this.checkBus();
    const flowStats = await this.collectFlowStats();
    const schedulerDiag = this.scheduler.getDiagnostics();
    const optMetrics = this.eventBus.getMetrics();

    return {
      status: dbCheck.connected ? 'ok' : 'degraded',
      projectSlug: this.projectSlug,
      shardId: this.shardId,
      tier: this.tier,
      uptimeSec: Math.round((Date.now() - this.startedAtMs) / 1000),
      timestamp: now.toISOString(),
      db: dbCheck,
      bus: busCheck,
      flows: flowStats,
      scheduler: schedulerDiag,
      optimizer: {
        totalImpulsesReceived: optMetrics.totalImpulsesReceived,
        totalImpulsesEmitted: optMetrics.totalImpulsesEmitted,
        totalImpulsesSuppressed: optMetrics.totalImpulsesSuppressed,
        reductionRatePct: optMetrics.overallReductionRate,
        pendingCoalesceBuffers: optMetrics.activeRegisteredStreams,
      },
      retention: this.retention?.getRetentionStatus() ?? null,
    };
  }

  async publishMetricsSnapshot(): Promise<{ snapshot: ShardHealthSnapshot; published: boolean }> {
    const snapshot = await this.getHealthSnapshot();
    if (!this.stackBus) {
      return { snapshot, published: false };
    }

    const minuteBucket = snapshot.timestamp.slice(0, 16); // YYYY-MM-DDTHH:mm
    await this.stackBus.publish({
      topic: `lemon.${this.projectSlug}.shard.metrics`,
      projectSlug: this.projectSlug,
      domain: 'shard',
      event: 'metrics',
      sourceApp: this.shardId,
      dedupKey: `shard:${this.shardId}:${minuteBucket}`,
      tags: ['core-shard', this.tier, this.projectSlug],
      payload: snapshot as unknown as Record<string, unknown>,
    });

    return { snapshot, published: true };
  }

  async publishLifecycleEvent(
    event: 'registered' | 'degraded' | 'recovered',
    extraPayload: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (!this.stackBus) return false;
    await this.stackBus.publish({
      topic: `lemon.${this.projectSlug}.shard.${event}`,
      projectSlug: this.projectSlug,
      domain: 'shard',
      event,
      sourceApp: this.shardId,
      dedupKey: `shard:${this.shardId}:${event}:${new Date().toISOString().slice(0, 16)}`,
      tags: ['core-shard', this.tier, this.projectSlug],
      payload: {
        shardId: this.shardId,
        projectSlug: this.projectSlug,
        tier: this.tier,
        timestamp: new Date().toISOString(),
        ...extraPayload,
      },
    });
    return true;
  }

  private async checkDatabase(): Promise<{ connected: boolean; latencyMs: number | null }> {
    if (!this.prisma) {
      return { connected: true, latencyMs: 0 };
    }
    const start = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('DB healthcheck timeout')), 1200);
        }),
      ]);
      return { connected: true, latencyMs: Math.max(1, Date.now() - start) };
    } catch {
      return { connected: false, latencyMs: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async checkBus(): Promise<{ driver: string; connected: boolean }> {
    if (!this.stackBus) {
      return { driver: 'none', connected: false };
    }
    try {
      const status = await this.stackBus.getStatus();
      return { driver: status.driver, connected: status.connected };
    } catch {
      return { driver: this.stackBus.driver, connected: false };
    }
  }

  private async collectFlowStats() {
    try {
      const metrics = await this.flowsService.metrics();
      let openSessions = 0;
      let openCircuitBreakers = 0;

      if (this.prisma?.flowSession && this.prisma?.flow) {
        const [sessCount, cbRows] = await Promise.all([
          this.prisma.flowSession.count({ where: { endedAt: null } }),
          this.prisma.flow.findMany({
            where: { type: FlowType.CIRCUIT_BREAKER },
            select: { config: true },
          }),
        ]);
        openSessions = sessCount;
        openCircuitBreakers = cbRows.filter((r) => (r.config as any)?.state === 'OPEN').length;
      }

      const activeFlows = await this.flowsService.list({ status: FlowStatus.ACTIVE }).catch(() => []);
      const processingFlows = await this.flowsService.list({ status: FlowStatus.PROCESSING }).catch(() => []);
      const pausedFlows = await this.flowsService.list({ status: FlowStatus.PAUSED }).catch(() => []);

      return {
        total: metrics.registered,
        active: activeFlows.length,
        paused: pausedFlows.length || metrics.paused,
        processing: processingFlows.length,
        inactive: metrics.standby,
        openSessions,
        openCircuitBreakers,
      };
    } catch {
      return {
        total: 0,
        active: 0,
        paused: 0,
        processing: 0,
        inactive: 0,
        openSessions: 0,
        openCircuitBreakers: 0,
      };
    }
  }
}
