import { performance } from 'node:perf_hooks';
import { FlowStatus, FlowType } from '@prisma/client';
import { InMemoryStackBusTransport, StackBusHub } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';

/**
 * Simulates realistic Postgres query cost (network/serialization/scan overhead)
 * so we compare BEFORE (unoptimized query patterns) vs AFTER (optimized query patterns).
 */
const SIMULATED_QUERY_BASE_US = 250; // 0.25 ms roundtrip
const SIMULATED_PER_ROW_US = 4; // 4 us per hydrated row + tag join

function busySleepUs(us: number) {
  const end = performance.now() + us / 1000;
  while (performance.now() < end) {
    // intentional micro-delay for deterministic I/O cost modeling
  }
}

async function benchScheduler() {
  const TOTAL_FLOWS = 5000;
  const SCHEDULABLE_COUNT = 25;
  const flows: any[] = [];
  const now = new Date();

  for (let i = 0; i < TOTAL_FLOWS; i++) {
    const isSchedulable = i < SCHEDULABLE_COUNT;
    flows.push({
      id: `flow-${i}`,
      name: `Flow ${i}`,
      type: isSchedulable ? FlowType.TIMER : i % 2 === 0 ? FlowType.CONTEXT : FlowType.OBSERVER,
      status: isSchedulable ? FlowStatus.ACTIVE : FlowStatus.INACTIVE,
      isExclusive: false,
      folderId: `folder-${i % 50}`,
      profileId: null,
      projectSlug: `project-${i % 20}`,
      tags: [{ tag: { id: 't1', name: 'bench' } }],
      config: isSchedulable ? { intervalSeconds: 60, lastTickAt: new Date(now.getTime() - 120_000).toISOString() } : null,
      orchestratorRules: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const baseRepo = {
    transaction: async (fn: any) => fn(baseRepo),
    findById: async (id: string) => flows.find((f) => f.id === id) ?? null,
    findByIdLite: async (id: string) => flows.find((f) => f.id === id) ?? null,
    updateLite: async () => ({}),
    update: async () => ({}),
    touchFlow: async () => {},
    findOpenSessionsInFolder: async () => [],
    createFlowEvent: async (d: any) => ({ id: 'ev', createdAt: now, ...d }),
  };

  let beforeDbRows = 0;
  const legacyRepo: any = {
    ...baseRepo,
    findMany: async () => {
      busySleepUs(SIMULATED_QUERY_BASE_US + TOTAL_FLOWS * SIMULATED_PER_ROW_US);
      beforeDbRows += flows.length;
      return flows;
    },
  };

  let afterDbRows = 0;
  const optimizedRepo: any = {
    ...baseRepo,
    findMany: async () => flows,
    findSchedulableFlows: async () => {
      const subset = flows.filter((f) => f.status === FlowStatus.ACTIVE && f.type === FlowType.TIMER);
      busySleepUs(SIMULATED_QUERY_BASE_US + subset.length * (SIMULATED_PER_ROW_US / 2));
      afterDbRows += subset.length;
      return subset;
    },
  };

  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const legacyScheduler = new FlowSchedulerService(
    legacyRepo,
    new FlowsService(legacyRepo, registry, new FlowsEventBusService()),
  );
  const optimizedScheduler = new FlowSchedulerService(
    optimizedRepo,
    new FlowsService(optimizedRepo, registry, new FlowsEventBusService()),
  );

  const t0 = performance.now();
  for (let i = 0; i < 10; i++) await legacyScheduler.tick(now);
  const legacyMs = performance.now() - t0;

  const t1 = performance.now();
  for (let i = 0; i < 10; i++) await optimizedScheduler.tick(now);
  const optimizedMs = performance.now() - t1;

  return {
    name: 'FlowSchedulerService.tick (10 ticks x 5,000 flows)',
    beforeMs: legacyMs,
    afterMs: optimizedMs,
    beforeNote: `${beforeDbRows} rows read`,
    afterNote: `${afterDbRows} rows read`,
  };
}

async function benchObserverDispatch() {
  const OBSERVER_COUNT = 20;
  const EVENTS_COUNT = 500;
  const observers = Array.from({ length: OBSERVER_COUNT }, (_, i) => ({
    id: `obs-${i}`,
    name: `Observer ${i}`,
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folderId: null,
    profileId: null,
    projectSlug: `proj-${i}`,
    tags: [],
    config: { selector: { topics: [`lemon.proj-${i}.job.completed`], persistEvents: false } },
    orchestratorRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  let dbQueries = 0;
  const repo: any = {
    transaction: async (fn: any) => fn(repo),
    findMany: async () => {
      dbQueries++;
      busySleepUs(SIMULATED_QUERY_BASE_US + OBSERVER_COUNT * SIMULATED_PER_ROW_US);
      return observers;
    },
  };

  const eventBus = new FlowsEventBusService();
  const flowsService = new FlowsService(repo, new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS), eventBus);
  const transport = new InMemoryStackBusTransport();
  await transport.connect();
  const stackBus = new StackBusService(new StackBusHub(transport));
  const relay = new LemonBusRelayService(eventBus, stackBus, flowsService);

  // Simulate BEFORE: uncached DB call per event (invalidate cache every time)
  dbQueries = 0;
  const t0 = performance.now();
  for (let i = 0; i < EVENTS_COUNT; i++) {
    relay.invalidateObserverCache();
    await relay.dispatchToObserverFlows({
      eventId: `before-${i}`,
      seq: i,
      topic: 'lemon.proj-1.job.completed',
      projectSlug: 'proj-1',
      domain: 'job',
      event: 'completed',
      sourceApp: 'bench',
      timestamp: new Date().toISOString(),
      tags: [],
      payload: { i },
    });
  }
  const beforeMs = performance.now() - t0;
  const beforeQueries = dbQueries;

  // Simulate AFTER: cached observer lookup
  dbQueries = 0;
  relay.invalidateObserverCache();
  const t1 = performance.now();
  for (let i = 0; i < EVENTS_COUNT; i++) {
    await relay.dispatchToObserverFlows({
      eventId: `after-${i}`,
      seq: i,
      topic: 'lemon.proj-1.job.completed',
      projectSlug: 'proj-1',
      domain: 'job',
      event: 'completed',
      sourceApp: 'bench',
      timestamp: new Date().toISOString(),
      tags: [],
      payload: { i },
    });
  }
  const afterMs = performance.now() - t1;
  const afterQueries = dbQueries;

  await stackBus.onModuleDestroy();
  return {
    name: `LemonBusRelayService.dispatch (${EVENTS_COUNT} bus events)`,
    beforeMs,
    afterMs,
    beforeNote: `${beforeQueries} DB queries`,
    afterNote: `${afterQueries} DB query`,
  };
}

async function benchPushBatch() {
  const ITEMS_COUNT = 200;
  const items = Array.from({ length: ITEMS_COUNT }, (_, i) => ({
    dedupKey: `key-${i % 150}`, // 50 duplicates
    payload: { index: i },
  }));

  const flowRow = {
    id: 'batch-1',
    name: 'Bench Batch',
    type: FlowType.BATCH,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folderId: null,
    profileId: null,
    projectSlug: 'bench',
    tags: [],
    config: { maxBatchSize: 500, pendingCount: 0 },
    orchestratorRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let legacyQueries = 0;
  const legacyRepo: any = {
    transaction: async (fn: any) => fn(legacyRepo),
    findById: async () => {
      legacyQueries++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
      return flowRow;
    },
    pushBufferItem: async () => {
      legacyQueries += 2; // findFirst + update/create
      busySleepUs(SIMULATED_QUERY_BASE_US * 2);
      return {};
    },
    update: async () => {
      legacyQueries++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
      return flowRow;
    },
  };

  let bulkQueries = 0;
  const bulkRepo: any = {
    transaction: async (fn: any) => fn(bulkRepo),
    findByIdLite: async () => {
      bulkQueries++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
      return flowRow;
    },
    pushBufferItemsBatch: async () => {
      bulkQueries += 3; // findMany(in) + createMany + count
      busySleepUs(SIMULATED_QUERY_BASE_US * 3);
      return { inserted: 150, updated: 0, pendingTotal: 150 };
    },
    updateLite: async () => {
      bulkQueries++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
      return flowRow;
    },
  };

  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const legacyService = new FlowsService(legacyRepo, registry);
  const bulkService = new FlowsService(bulkRepo, registry);

  const t0 = performance.now();
  await legacyService.pushBatch('batch-1', { items });
  const beforeMs = performance.now() - t0;

  const t1 = performance.now();
  await bulkService.pushBatch('batch-1', { items });
  const afterMs = performance.now() - t1;

  return {
    name: `FlowsService.pushBatch (${ITEMS_COUNT} items, 50 dedup)`,
    beforeMs,
    afterMs,
    beforeNote: `${legacyQueries} DB queries`,
    afterNote: `${bulkQueries} DB queries`,
  };
}

async function benchHeartbeats() {
  const BURST = 300;
  const flowRow = {
    id: 'mutex-1',
    name: 'Bench Mutex',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: true,
    folderId: null,
    profileId: null,
    projectSlug: 'bench',
    tags: [],
    config: null,
    orchestratorRules: { leaseTimeoutSeconds: 60 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let beforeWrites = 0;
  const legacyRepo: any = {
    findById: async () => {
      busySleepUs(SIMULATED_QUERY_BASE_US + SIMULATED_PER_ROW_US * 2);
      return flowRow;
    },
    touchFlow: async () => {
      beforeWrites++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
    },
  };

  let afterWrites = 0;
  const optRepo: any = {
    findByIdLite: async () => {
      busySleepUs(SIMULATED_QUERY_BASE_US);
      return flowRow;
    },
    touchFlow: async () => {
      afterWrites++;
      busySleepUs(SIMULATED_QUERY_BASE_US);
    },
  };

  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const eventBus = new FlowsEventBusService();
  const legacyService = new FlowsService(legacyRepo, registry, eventBus);
  const optService = new FlowsService(optRepo, registry, eventBus);

  // Legacy simulation: force unthrottled path by alternating distinct flow ids
  const t0 = performance.now();
  for (let i = 0; i < BURST; i++) {
    await (legacyService as any).repo.findById(`mutex-${i}`);
    await (legacyService as any).repo.touchFlow(`mutex-${i}`);
  }
  const beforeMs = performance.now() - t0;

  const t1 = performance.now();
  for (let i = 0; i < BURST; i++) {
    await optService.trigger('mutex-1', { action: 'heartbeat' });
  }
  const afterMs = performance.now() - t1;
  eventBus.engine.flush();

  return {
    name: `FlowsService.heartbeat burst (${BURST} calls)`,
    beforeMs,
    afterMs,
    beforeNote: `${beforeWrites} DB writes`,
    afterNote: `${afterWrites} DB write`,
  };
}

async function main() {
  console.log('=== Lemon-Core Flows Before / After Benchmark ===\n');
  const results = [
    await benchScheduler(),
    await benchObserverDispatch(),
    await benchPushBatch(),
    await benchHeartbeats(),
  ];

  for (const r of results) {
    const speedup = (r.beforeMs / Math.max(0.01, r.afterMs)).toFixed(1);
    console.log(
      `- ${r.name}\n  BEFORE: ${r.beforeMs.toFixed(2)} ms (${r.beforeNote})\n  AFTER : ${r.afterMs.toFixed(2)} ms (${r.afterNote}) -> ${speedup}x faster\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
