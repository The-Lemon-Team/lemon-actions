import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { InMemoryStackBusTransport, StackBusHub } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';

function createStatefulMockRepo() {
  const flows = new Map<string, any>();
  const sessions: any[] = [];
  const events: any[] = [];
  const bufferItems: any[] = [];

  let flowSeq = 0;
  let sessionSeq = 0;
  let eventSeq = 0;
  let bufSeq = 0;
  let lockAcquires = 0;
  let listCalls = 0;
  let touchCalls = 0;
  let schedulableCalls = 0;
  let batchUpsertCalls = 0;
  let outOfTxWriteDetected = false;

  const makeApi = (inTx: boolean): any => ({
    transaction: async (fn: any) => {
      const txProxy = makeApi(true);
      const snapshotFlows = structuredClone(Array.from(flows.entries()));
      const snapshotSessions = structuredClone(sessions);
      const snapshotEvents = structuredClone(events);
      const snapshotBuffer = structuredClone(bufferItems);
      try {
        return await fn(txProxy);
      } catch (err) {
        flows.clear();
        for (const [k, v] of snapshotFlows) flows.set(k, v);
        sessions.splice(0, sessions.length, ...snapshotSessions);
        events.splice(0, events.length, ...snapshotEvents);
        bufferItems.splice(0, bufferItems.length, ...snapshotBuffer);
        throw err;
      }
    },
    acquireExclusiveScopeLock: async () => {
      lockAcquires++;
    },
    findById: async (id: string) => flows.get(id) ?? null,
    findByIdLite: async (id: string) => flows.get(id) ?? null,
    findMany: async (q: any = {}) => {
      if (q.type === FlowType.OBSERVER && q.status === FlowStatus.ACTIVE) {
        listCalls++;
      }
      let list = Array.from(flows.values());
      if (q.folderId !== undefined) list = list.filter((f) => f.folderId === q.folderId);
      if (q.type) list = list.filter((f) => f.type === q.type);
      if (q.status) list = list.filter((f) => f.status === q.status);
      return list;
    },
    findSchedulableFlows: async () => {
      schedulableCalls++;
      return Array.from(flows.values()).filter((f) => {
        const rules = f.orchestratorRules ?? {};
        const cfg = f.config ?? {};
        return (
          (f.status === FlowStatus.ACTIVE && f.type === FlowType.TIMER) ||
          (f.status === FlowStatus.ACTIVE && f.type === FlowType.BATCH && (cfg.pendingCount ?? 0) > 0) ||
          (f.status === FlowStatus.ACTIVE && Boolean(rules.leaseTimeoutSeconds)) ||
          (f.type === FlowType.CIRCUIT_BREAKER && cfg.state === 'OPEN') ||
          (Array.isArray(rules.schedule?.windows) && rules.schedule.windows.length > 0)
        );
      });
    },
    findFlowsByFolder: async (folderId: string) =>
      Array.from(flows.values()).filter((f) => f.folderId === folderId),
    findRunningExclusive: async (folderId: string | null, excludeId: string) =>
      Array.from(flows.values()).filter(
        (f) =>
          f.isExclusive &&
          f.folderId === folderId &&
          f.id !== excludeId &&
          (f.status === FlowStatus.ACTIVE || f.status === FlowStatus.PROCESSING),
      ),
    getFolderMeta: async (id: string) => ({ id, profileId: null }),
    create: async (data: any, tagNames: string[]) => {
      const id = `flow-${++flowSeq}`;
      const row = {
        id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        status: FlowStatus.INACTIVE,
        isExclusive: data.isExclusive ?? false,
        folderId: data.folder?.connect?.id ?? null,
        profileId: null,
        projectSlug: data.projectSlug ?? null,
        tags: tagNames.map((n, i) => ({ tag: { id: `t-${i}`, name: n } })),
        config: data.config ?? null,
        orchestratorRules: data.orchestratorRules ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      flows.set(id, row);
      return row;
    },
    update: async (id: string, data: any) => {
      if (!inTx) outOfTxWriteDetected = true;
      const cur = flows.get(id);
      const next = {
        ...cur,
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.orchestratorRules !== undefined ? { orchestratorRules: data.orchestratorRules } : {}),
        updatedAt: new Date(),
      };
      flows.set(id, next);
      return next;
    },
    updateLite: async (id: string, data: any) => {
      const cur = flows.get(id);
      const next = {
        ...cur,
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.orchestratorRules !== undefined ? { orchestratorRules: data.orchestratorRules } : {}),
        updatedAt: new Date(),
      };
      flows.set(id, next);
      return next;
    },
    setStatus: async (id: string, status: FlowStatus) => {
      const cur = flows.get(id);
      const next = { ...cur, status, updatedAt: new Date() };
      flows.set(id, next);
      return next;
    },
    hasOpenSession: async (flowId: string) => sessions.some((s) => s.flowId === flowId && s.endedAt === null),
    openSession: async (flowId: string) => {
      const s = { id: `sess-${++sessionSeq}`, flowId, startedAt: new Date(), endedAt: null };
      sessions.push(s);
      return s;
    },
    closeSessions: async (flowId: string, closedBy: string) => {
      for (const s of sessions) {
        if (s.flowId === flowId && s.endedAt === null) {
          s.endedAt = new Date();
          s.closedBy = closedBy;
        }
      }
    },
    findOpenSessionsInFolder: async () => [],
    touchFlow: async (id: string) => {
      touchCalls++;
      const cur = flows.get(id);
      if (cur) cur.updatedAt = new Date();
    },
    createFlowEvent: async (data: any) => {
      const ev = { id: `ev-${++eventSeq}`, createdAt: new Date(), ...data };
      events.push(ev);
      return ev;
    },
    pushBufferItemsBatch: async (flowId: string, items: Array<{ payload: any; dedupKey?: string }>) => {
      batchUpsertCalls++;
      const now = new Date();
      for (const item of items) {
        if (item.dedupKey) {
          const existing = bufferItems.find(
            (b) => b.flowId === flowId && b.dedupKey === item.dedupKey && b.flushedAt === null,
          );
          if (existing) {
            existing.payload = item.payload;
            existing.enqueuedAt = now;
            continue;
          }
        }
        bufferItems.push({
          id: `buf-${++bufSeq}`,
          flowId,
          dedupKey: item.dedupKey,
          payload: item.payload,
          enqueuedAt: now,
          flushedAt: null,
        });
      }
      const pendingTotal = bufferItems.filter((b) => b.flowId === flowId && b.flushedAt === null).length;
      return { inserted: items.length, updated: 0, pendingTotal };
    },
    flushBufferItems: async (flowId: string) => {
      const pending = bufferItems.filter((b) => b.flowId === flowId && b.flushedAt === null);
      const now = new Date();
      pending.forEach((b) => (b.flushedAt = now));
      return pending;
    },
  });

  const root = makeApi(false);
  return {
    repo: root,
    flows,
    events,
    getMetrics: () => ({
      lockAcquires,
      listCalls,
      touchCalls,
      schedulableCalls,
      batchUpsertCalls,
      outOfTxWriteDetected,
    }),
    resetOutOfTxFlag: () => {
      outOfTxWriteDetected = false;
    },
  };
}

async function runP0P1Tests() {
  console.log('=== Running P0/P1 Optimization & Correctness Tests ===\n');

  const store = createStatefulMockRepo();
  const eventBus = new FlowsEventBusService();
  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const flowsService = new FlowsService(store.repo, registry, eventBus);
  const scheduler = new FlowSchedulerService(store.repo, flowsService);

  const emittedImpulses: any[] = [];
  const sub = eventBus.stream$().subscribe((p) => emittedImpulses.push(p));

  // 1. P0: Post-commit impulse safety (rolled-back transaction emits 0 impulses)
  const mutexA = await flowsService.create({
    name: 'Mutex A',
    type: FlowType.MUTEX,
    folderId: 'folder-1',
    isExclusive: true,
    orchestratorRules: { onConflict: 'reject' },
  });
  const mutexB = await flowsService.create({
    name: 'Mutex B',
    type: FlowType.MUTEX,
    folderId: 'folder-1',
    isExclusive: true,
    orchestratorRules: { onConflict: 'queue' },
  });
  await flowsService.updateStatus(mutexA.id, FlowStatus.ACTIVE);
  eventBus.engine.flush();
  emittedImpulses.length = 0;

  // Attempt conflicting activation with 'reject' -> throws ConflictException, emits 0 impulses
  const mutexC = await flowsService.create({
    name: 'Mutex C',
    type: FlowType.MUTEX,
    folderId: 'folder-1',
    isExclusive: true,
    orchestratorRules: { onConflict: 'reject' },
  });
  await assert.rejects(() => flowsService.updateStatus(mutexC.id, FlowStatus.ACTIVE));
  eventBus.engine.flush();
  assert.equal(emittedImpulses.length, 0, 'Failed transaction must emit 0 impulses');
  assert.ok(store.getMetrics().lockAcquires >= 2, 'Exclusive mutex transitions must acquire scope lock');
  console.log('✓ 1. P0-1/P0-3: Scope lock acquired and rolled-back transitions emit 0 impulses');

  // 2. P0: Queue promotion emits MUTEX_STATUS impulse after commit
  await flowsService.updateStatus(mutexB.id, FlowStatus.ACTIVE); // queued
  await flowsService.updateStatus(mutexA.id, FlowStatus.INACTIVE); // releases & promotes mutexB
  eventBus.engine.flush();
  assert.equal((await flowsService.findOne(mutexB.id)).status, FlowStatus.ACTIVE);
  assert.ok(
    emittedImpulses.some((p) => p.flowId === mutexB.id && p.type === 'MUTEX_STATUS' && p.payload.currentStatus === 'ACTIVE'),
    'Queue-promoted mutex must emit MUTEX_STATUS impulse',
  );
  console.log('✓ 2. P0-3: Queue-promoted MUTEX emits MUTEX_STATUS impulse');

  // 3. P0: Circuit Breaker transition runs completely inside appendEvent transaction
  const cb = await flowsService.create({
    name: 'CB Guard',
    type: FlowType.CIRCUIT_BREAKER,
    folderId: 'folder-1',
    config: { state: 'CLOSED', failureThreshold: 2, cooldownSeconds: 30 },
  });
  store.resetOutOfTxFlag();
  emittedImpulses.length = 0;
  await flowsService.appendEvent(cb.id, { eventType: 'API_ERROR', payload: { statusCode: 500 } });
  await flowsService.appendEvent(cb.id, { eventType: 'API_ERROR', payload: { statusCode: 503 } });
  eventBus.engine.flush();
  assert.equal(store.getMetrics().outOfTxWriteDetected, false, 'Circuit breaker trip must not write outside tx');
  assert.equal((await flowsService.findOne(cb.id)).config && (await flowsService.findOne(cb.id) as any).config.state, 'OPEN');
  assert.ok(emittedImpulses.some((p) => p.flowId === cb.id && p.type === 'CIRCUIT_BREAKER_STATE'));
  console.log('✓ 3. P0-2: Circuit Breaker trips cleanly inside single transaction');

  // 4. P1: Batch bulk upsert + accurate pendingCount with duplicate dedupKeys
  const batchFlow = await flowsService.create({
    name: 'Bulk Batch',
    type: FlowType.BATCH,
    folderId: 'folder-1',
    config: { maxBatchSize: 4, maxWaitSeconds: 60, idleTimeoutSeconds: 10 },
  });
  await flowsService.updateStatus(batchFlow.id, FlowStatus.ACTIVE);

  const push1: any = await flowsService.pushBatch(batchFlow.id, {
    items: [
      { dedupKey: 'k1', payload: { v: 1 } },
      { dedupKey: 'k1', payload: { v: 2 } }, // duplicate in same push
      { dedupKey: 'k2', payload: { v: 3 } },
    ],
  });
  assert.equal(push1.pendingTotal, 2, 'Duplicate dedupKey must not overcount pendingTotal');
  assert.equal(store.getMetrics().batchUpsertCalls, 1);

  const push2: any = await flowsService.pushBatch(batchFlow.id, {
    items: [
      { dedupKey: 'k3', payload: { v: 4 } },
      { dedupKey: 'k4', payload: { v: 5 } },
    ],
  });
  assert.equal(push2.itemsCount, 4, 'Auto-flush must deliver all 4 unique items');
  console.log('✓ 4. P1-3: Bulk pushBatch deduplicates accurately and flushes in O(1) calls');

  // 5. P1: Scheduler uses findSchedulableFlows instead of scanning all flows
  await scheduler.tick(new Date());
  assert.equal(store.getMetrics().schedulableCalls, 1, 'Scheduler must call findSchedulableFlows');
  console.log('✓ 5. P1-1: FlowSchedulerService uses selective findSchedulableFlows()');

  // 6. P1: Observer cache in LemonBusRelayService (0 DB queries on steady state, instant invalidation)
  const transport = new InMemoryStackBusTransport();
  await transport.connect();
  const stackBus = new StackBusService(new StackBusHub(transport));
  const relay = new LemonBusRelayService(eventBus, stackBus, flowsService);
  relay.onModuleInit();

  const obs = await flowsService.create({
    name: 'Cached Observer',
    type: FlowType.OBSERVER,
    projectSlug: 'alpha',
    config: { selector: { topics: ['lemon.alpha.job.done'] } },
  });
  await flowsService.updateStatus(obs.id, FlowStatus.ACTIVE);

  const beforeCalls = store.getMetrics().listCalls;
  const alphaBus = stackBus.forProject('alpha', 'worker');
  for (let i = 0; i < 50; i++) {
    await alphaBus.publish('job', 'done', { i });
  }
  await new Promise((r) => setTimeout(r, 30));
  const afterCalls = store.getMetrics().listCalls;
  assert.equal(afterCalls - beforeCalls, 1, '50 bus events must execute only 1 DB observer query');

  // Pausing observer immediately invalidates cache
  await flowsService.updateStatus(obs.id, FlowStatus.PAUSED);
  await alphaBus.publish('job', 'done', { i: 999 });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(store.getMetrics().listCalls - afterCalls, 1, 'Status change must invalidate observer cache');
  assert.equal(
    store.events.filter((e) => e.flowId === obs.id).length,
    50,
    'Paused observer must not receive event after cache invalidation',
  );
  console.log('✓ 6. P1-2: LemonBusRelayService caches observers (50 events -> 1 query) and invalidates immediately');

  // 7. P1: Heartbeat throttling reduces redundant touchFlow writes
  const beforeTouch = store.getMetrics().touchCalls;
  for (let i = 0; i < 20; i++) {
    await flowsService.trigger(mutexB.id, { action: 'heartbeat' });
  }
  const touchDelta = store.getMetrics().touchCalls - beforeTouch;
  assert.equal(touchDelta, 1, 'Burst of 20 heartbeats within 5s must perform only 1 DB touch');
  console.log('✓ 7. P1-4: Heartbeat burst throttled (20 heartbeats -> 1 DB write)');

  sub.unsubscribe();
  relay.onModuleDestroy();
  await stackBus.onModuleDestroy();
  console.log('\n=== All P0/P1 Tests Passed! ===');
}

runP0P1Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
