import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { ShardRetentionService } from './shard-retention.service';
import { ShardTelemetryService } from './shard-telemetry.service';
import { ShardController } from './shard.controller';

async function runStage4RetentionTests() {
  console.log('=== Running Stage 4: Shard Event Retention & Health Policy Tests ===\n');

  const now = new Date('2026-11-27T00:00:00.000Z');
  const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
  const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

  const flows = [
    { id: 'f-watchers', projectSlug: 'lemon-watchers' },
    { id: 'f-other', projectSlug: 'lemon-space' },
  ];
  const flowEvents = [
    { id: 'ev-old-w', flowId: 'f-watchers', createdAt: oldDate },
    { id: 'ev-new-w', flowId: 'f-watchers', createdAt: recentDate },
    { id: 'ev-old-other', flowId: 'f-other', createdAt: oldDate },
  ];
  const bufferItems = [
    { id: 'buf-old-flushed', flowId: 'f-watchers', flushedAt: oldDate },
    { id: 'buf-old-pending', flowId: 'f-watchers', flushedAt: null },
    { id: 'buf-new-flushed', flowId: 'f-watchers', flushedAt: recentDate },
  ];

  const mockPrisma: any = {
    $queryRaw: async () => [{ '?column?': 1 }],
    flowEvent: {
      deleteMany: async ({ where }: any) => {
        const lt: Date = where.createdAt.lt;
        const slug: string | undefined = where.flow?.projectSlug;
        let deleted = 0;
        for (let i = flowEvents.length - 1; i >= 0; i--) {
          const ev = flowEvents[i];
          const flow = flows.find((f) => f.id === ev.flowId);
          if (ev.createdAt < lt && (!slug || flow?.projectSlug === slug)) {
            flowEvents.splice(i, 1);
            deleted++;
          }
        }
        return { count: deleted };
      },
    },
    flowBufferItem: {
      deleteMany: async ({ where }: any) => {
        const lt: Date = where.flushedAt.lt;
        const slug: string | undefined = where.flow?.projectSlug;
        let deleted = 0;
        for (let i = bufferItems.length - 1; i >= 0; i--) {
          const item = bufferItems[i];
          const flow = flows.find((f) => f.id === item.flowId);
          if (item.flushedAt !== null && item.flushedAt < lt && (!slug || flow?.projectSlug === slug)) {
            bufferItems.splice(i, 1);
            deleted++;
          }
        }
        return { count: deleted };
      },
    },
    flow: {
      groupBy: async () => [],
      findMany: async () => [],
    },
    flowSession: { count: async () => 0 },
  };

  const repo = new FlowsRepository(mockPrisma);
  const retention = new ShardRetentionService(repo);
  const eventBus = new FlowsEventBusService();
  const flowsService = new FlowsService(repo, new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS), eventBus);
  const scheduler = new FlowSchedulerService(repo, flowsService);
  const telemetry = new ShardTelemetryService(flowsService, scheduler, eventBus, mockPrisma, undefined, retention);
  const controller = new ShardController(telemetry, retention);

  const prevTier = process.env.LEMON_SHARD_TIER;
  const prevSlug = process.env.LEMON_SHARD_PROJECT_SLUG;
  const prevDays = process.env.LEMON_SHARD_EVENT_RETENTION_DAYS;

  process.env.LEMON_SHARD_TIER = 'dedicated';
  process.env.LEMON_SHARD_PROJECT_SLUG = 'lemon-watchers';
  process.env.LEMON_SHARD_EVENT_RETENTION_DAYS = '30';

  try {
    // 1. Prune scoped to dedicated projectSlug ('lemon-watchers')
    const pruneRes = await retention.prune({ retentionDays: 30, now });
    assert.equal(pruneRes.projectSlug, 'lemon-watchers');
    assert.equal(pruneRes.deletedEvents, 1, 'Only old lemon-watchers event must be deleted');
    assert.equal(pruneRes.deletedBufferItems, 1, 'Only old flushed lemon-watchers buffer item must be deleted');
    assert.ok(flowEvents.some((e) => e.id === 'ev-new-w'), 'Recent event must be preserved');
    assert.ok(flowEvents.some((e) => e.id === 'ev-old-other'), 'Other project event must not be touched');
    assert.ok(bufferItems.some((b) => b.id === 'buf-old-pending'), 'Unflushed buffer item must be preserved');
    console.log('✓ 1. ShardRetentionService purges expired flow_events & flushed buffer items scoped by projectSlug');

    // 2. Verify /api/shard/health exposes retention status and controller prune endpoint works
    const health = await controller.health();
    assert.ok(health.retention);
    assert.equal(health.retention.retentionDays, 30);
    assert.equal(health.retention.lastDeletedEvents, 1);
    assert.equal(health.retention.lastDeletedBufferItems, 1);

    const status = controller.retentionStatus();
    assert.equal(status.lastDeletedEvents, 1);

    const postPrune = await controller.pruneRetention({ retentionDays: 1, projectSlug: 'lemon-space' });
    assert.equal(postPrune.deletedEvents, 1, 'Explicit projectSlug prune cleans lemon-space old event');
    console.log('✓ 2. ShardController exposes /api/shard/retention/status, /prune, and health.retention');

    console.log('\n=== Stage 4 Retention & Policy Tests Passed! ===');
  } finally {
    if (prevTier === undefined) delete process.env.LEMON_SHARD_TIER;
    else process.env.LEMON_SHARD_TIER = prevTier;
    if (prevSlug === undefined) delete process.env.LEMON_SHARD_PROJECT_SLUG;
    else process.env.LEMON_SHARD_PROJECT_SLUG = prevSlug;
    if (prevDays === undefined) delete process.env.LEMON_SHARD_EVENT_RETENTION_DAYS;
    else process.env.LEMON_SHARD_EVENT_RETENTION_DAYS = prevDays;
  }
}

runStage4RetentionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
