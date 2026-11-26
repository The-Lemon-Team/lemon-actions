import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { StackBusEnvelope, StackBusSubscriptionHandle } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { ShardHealthSnapshot } from '../flows/shard-telemetry.service';

export interface ShardAnalyticsEntry {
  projectSlug: string;
  shardId: string;
  tier: string;
  status: string;
  lastMetricsAt: string | null;
  lastFlowEventAt: string | null;
  latestSnapshot: ShardHealthSnapshot | null;
  snapshotHistory: Array<{
    timestamp: string;
    activeFlows: number;
    openSessions: number;
    openCircuitBreakers: number;
    reductionRatePct: number;
    dbLatencyMs: number | null;
    schedulerDurationMs: number;
  }>;
  totalFlowEvents: number;
  eventsByType: Record<string, number>;
  recentAlerts: Array<{
    timestamp: string;
    topic: string;
    severity: 'warn' | 'critical';
    message: string;
  }>;
}

const MAX_HISTORY_PER_SHARD = 30;
const MAX_ALERTS_PER_SHARD = 20;

@Injectable()
export class ShardAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShardAnalyticsService.name);
  private subscription: StackBusSubscriptionHandle | null = null;
  private readonly shards = new Map<string, ShardAnalyticsEntry>();

  constructor(@Optional() private readonly stackBus?: StackBusService) {}

  async onModuleInit(): Promise<void> {
    if (!this.stackBus || process.env.SHARD_ANALYTICS_ENABLED === 'false') {
      return;
    }

    try {
      this.subscription = await this.stackBus.subscribe(
        {
          topicPattern: ['lemon.*.shard.>', 'lemon.*.flow.>'],
          durableName: 'main_shard_analytics',
          deliverPolicy: 'new',
        },
        (envelope) => {
          this.ingestEnvelope(envelope);
        },
      );
      this.logger.log('ShardAnalyticsService attached durable consumer (main_shard_analytics)');
    } catch (err) {
      this.logger.warn(
        `ShardAnalyticsService durable subscription skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscription) {
      await Promise.resolve(this.subscription.unsubscribe()).catch(() => {});
      this.subscription = null;
    }
  }

  ingestEnvelope(envelope: StackBusEnvelope<any>): void {
    const slug = (envelope.projectSlug || 'lemon-core').trim().toLowerCase();
    const entry = this.getOrCreateEntry(slug, envelope.sourceApp);

    if (envelope.domain === 'shard') {
      if (envelope.event === 'metrics') {
        const snapshot = envelope.payload as ShardHealthSnapshot;
        entry.shardId = snapshot.shardId || entry.shardId;
        entry.tier = snapshot.tier || entry.tier;
        entry.status = snapshot.status || entry.status;
        entry.lastMetricsAt = snapshot.timestamp || envelope.timestamp;
        entry.latestSnapshot = snapshot;

        entry.snapshotHistory.push({
          timestamp: entry.lastMetricsAt,
          activeFlows: snapshot.flows?.active ?? 0,
          openSessions: snapshot.flows?.openSessions ?? 0,
          openCircuitBreakers: snapshot.flows?.openCircuitBreakers ?? 0,
          reductionRatePct: snapshot.optimizer?.reductionRatePct ?? 0,
          dbLatencyMs: snapshot.db?.latencyMs ?? null,
          schedulerDurationMs: snapshot.scheduler?.lastTickDurationMs ?? 0,
        });
        if (entry.snapshotHistory.length > MAX_HISTORY_PER_SHARD) {
          entry.snapshotHistory.shift();
        }

        if (snapshot.status === 'degraded' || (snapshot.flows?.openCircuitBreakers ?? 0) > 0) {
          this.pushAlert(entry, {
            timestamp: entry.lastMetricsAt,
            topic: envelope.topic,
            severity: snapshot.status === 'degraded' ? 'critical' : 'warn',
            message:
              snapshot.status === 'degraded'
                ? `Shard "${entry.shardId}" reported degraded status`
                : `Shard "${entry.shardId}" has ${snapshot.flows.openCircuitBreakers} OPEN circuit breaker(s)`,
          });
        }
      } else if (envelope.event === 'degraded' || envelope.event === 'evicted') {
        entry.status = envelope.event;
        this.pushAlert(entry, {
          timestamp: envelope.timestamp,
          topic: envelope.topic,
          severity: 'critical',
          message: `Shard lifecycle alert: ${envelope.topic}`,
        });
      }
      return;
    }

    if (envelope.domain === 'flow') {
      const impulseType = String(envelope.payload?.impulseType || envelope.event || 'unknown').toUpperCase();
      entry.totalFlowEvents += 1;
      entry.lastFlowEventAt = envelope.timestamp;
      entry.eventsByType[impulseType] = (entry.eventsByType[impulseType] ?? 0) + 1;

      if (impulseType === 'CIRCUIT_BREAKER_STATE' && envelope.payload?.data?.state === 'OPEN') {
        this.pushAlert(entry, {
          timestamp: envelope.timestamp,
          topic: envelope.topic,
          severity: 'warn',
          message: `Circuit Breaker "${envelope.payload?.flowName || 'unknown'}" tripped to OPEN`,
        });
      }
    }
  }

  getAnalyticsSummary(projectSlug?: string) {
    if (projectSlug) {
      const normalized = projectSlug.trim().toLowerCase();
      const item = this.shards.get(normalized) ?? null;
      return {
        generatedAt: new Date().toISOString(),
        totalShards: item ? 1 : 0,
        shards: item ? [item] : [],
      };
    }

    const list = Array.from(this.shards.values());
    const degradedCount = list.filter((s) => s.status !== 'ok').length;
    const totalFlowEvents = list.reduce((sum, s) => sum + s.totalFlowEvents, 0);

    return {
      generatedAt: new Date().toISOString(),
      totalShards: list.length,
      healthyShards: list.length - degradedCount,
      degradedShards: degradedCount,
      totalFlowEvents,
      shards: list,
    };
  }

  private getOrCreateEntry(projectSlug: string, sourceApp?: string): ShardAnalyticsEntry {
    let entry = this.shards.get(projectSlug);
    if (!entry) {
      entry = {
        projectSlug,
        shardId: sourceApp || `shard-${projectSlug}`,
        tier: 'logical',
        status: 'ok',
        lastMetricsAt: null,
        lastFlowEventAt: null,
        latestSnapshot: null,
        snapshotHistory: [],
        totalFlowEvents: 0,
        eventsByType: {},
        recentAlerts: [],
      };
      this.shards.set(projectSlug, entry);
    }
    return entry;
  }

  private pushAlert(
    entry: ShardAnalyticsEntry,
    alert: { timestamp: string; topic: string; severity: 'warn' | 'critical'; message: string },
  ) {
    entry.recentAlerts.unshift(alert);
    if (entry.recentAlerts.length > MAX_ALERTS_PER_SHARD) {
      entry.recentAlerts.length = MAX_ALERTS_PER_SHARD;
    }
  }
}
