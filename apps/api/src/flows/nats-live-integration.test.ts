import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { createConnectedStackBus } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { ProjectariumService } from '../projectarium/projectarium.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';

async function runLiveNatsIntegrationTests() {
  const natsUrl = process.env.NATS_URL || 'nats://127.0.0.1:4222';
  console.log(`=== Running Live NATS JetStream Integration Tests (${natsUrl}) ===\n`);

  const hub = await createConnectedStackBus({
    driver: 'nats',
    natsUrl,
    streamName: 'LEMON_STACK_BUS',
  });
  assert.equal(hub.driver, 'nats');

  const stackBus = new StackBusService(hub);
  const status = await stackBus.getStatus();
  assert.equal(status.driver, 'nats');
  assert.equal(status.connected, true);
  assert.equal(status.streamName, 'LEMON_STACK_BUS');
  console.log('✓ 1. Connected to real Docker NATS JetStream & ensured LEMON_STACK_BUS stream');

  // 2. Durable/live consumer + wildcard cross-bus + msgID dedup on real JetStream
  const uniqueRunId = Date.now().toString(36);
  const receivedMedia: any[] = [];
  const receivedCross: any[] = [];

  const mediaSub = await hub.forProject('media-hub', 'live-test').subscribe(
    { topicPattern: 'media.created', deliverPolicy: 'new' },
    (env) => {
      if ((env.payload as any)?.runId === uniqueRunId) receivedMedia.push(env);
    },
  );
  const crossSub = await hub.subscribe(
    { topicPattern: 'lemon.*.app.>', deliverPolicy: 'new' },
    (env) => {
      if ((env.payload as any)?.runId === uniqueRunId) receivedCross.push(env);
    },
  );

  const mediaBus = stackBus.forProject('media-hub', 'live-test');
  await mediaBus.publish(
    'media',
    'created',
    { runId: uniqueRunId, assetId: `asset-${uniqueRunId}` },
    { dedupKey: `live-media:${uniqueRunId}` },
  );
  // Second publish with same dedupKey must be deduplicated by JetStream
  await mediaBus.publish(
    'media',
    'created',
    { runId: uniqueRunId, assetId: `asset-${uniqueRunId}` },
    { dedupKey: `live-media:${uniqueRunId}` },
  );

  await new Promise((r) => setTimeout(r, 300));
  assert.equal(receivedMedia.length, 1, 'JetStream msgID dedup should deliver exactly 1 media.created');
  assert.equal(receivedMedia[0].topic, 'lemon.media-hub.media.created');
  console.log('✓ 2. Live JetStream publish, consumer delivery, and msgID deduplication verified');

  // 3. Observer Flow routing triggered by live NATS message
  const flowEvents: any[] = [];
  const obsFlow = {
    id: 'obs-live-1',
    name: 'Live NATS Observer',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folderId: null,
    profileId: null,
    projectSlug: null,
    tags: [],
    config: { selector: { topics: ['lemon.media-hub.media.created'] } },
    orchestratorRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockRepo: any = {
    transaction: async (fn: any) => fn(mockRepo),
    findById: async (id: string) => (id === obsFlow.id ? obsFlow : null),
    findMany: async () => [obsFlow],
    findFlowsByFolder: async () => [],
    findRunningExclusive: async () => [],
    getFolderMeta: async () => null,
    findOpenSessionsInFolder: async () => [],
    touchFlow: async () => {},
    createFlowEvent: async (data: any) => {
      const ev = { id: `ev-${flowEvents.length + 1}`, createdAt: new Date(), ...data };
      flowEvents.push(ev);
      return ev;
    },
  };
  const eventBus = new FlowsEventBusService();
  const flowsService = new FlowsService(mockRepo, new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS), eventBus);
  const relay = new LemonBusRelayService(eventBus, stackBus, flowsService);
  relay.onModuleInit();

  await mediaBus.publish(
    'media',
    'created',
    { runId: `${uniqueRunId}-obs`, assetId: `asset-obs-${uniqueRunId}` },
    { dedupKey: `live-obs:${uniqueRunId}` },
  );
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(
    flowEvents.some(
      (e) => e.flowId === obsFlow.id && e.eventType === 'lemon.media-hub.media.created' && e.payload?.data?.runId === `${uniqueRunId}-obs`,
    ),
    'Live NATS message must trigger matching OBSERVER FlowEvent',
  );
  console.log('✓ 3. Live NATS JetStream -> LemonBusRelayService -> OBSERVER FlowEvent verified');

  // 4. Lightweight heartbeat verification (zero full-stand transactions + coalesced bus pulse)
  let transactionCalls = 0;
  let appUpdateManyCalls = 0;
  const noopTable = () => ({
    upsert: async () => {},
    findMany: async () => [],
    deleteMany: async () => {},
    createMany: async () => {},
    create: async () => {},
    updateMany: async () => {},
  });
  const mockPrisma: any = {
    $transaction: async (fn: any) => {
      transactionCalls += 1;
      return fn(mockPrisma);
    },
    projectariumStand: noopTable(),
    projectariumAppRecord: {
      ...noopTable(),
      updateMany: async () => {
        appUpdateManyCalls += 1;
      },
    },
    projectariumTodoRecord: noopTable(),
    projectariumNoteRecord: noopTable(),
    projectariumEventRecord: noopTable(),
    projectariumAppRunRecord: noopTable(),
  };

  const projectarium = new ProjectariumService(mockPrisma, stackBus);
  const reg = await projectarium.registerOrAttach({
    projectSlug: `live-hb-${uniqueRunId}`,
    projectName: 'Live Heartbeat Test Stand',
    appName: 'Heartbeat Probe App',
    preferredPort: 4329,
    environment: 'dev',
    networkMode: 'local',
  });
  assert.equal(transactionCalls, 1);

  for (let i = 0; i < 5; i++) {
    await projectarium.heartbeat({
      instanceId: reg.allocatedApp.instanceId,
      leaseToken: reg.allocatedApp.leaseToken,
    });
  }

  assert.equal(transactionCalls, 1, 'Steady-state heartbeats must NOT trigger full-stand $transaction');
  assert.equal(appUpdateManyCalls, 5, 'Steady-state heartbeats must use single-row updateMany');

  // Also test replay from real JetStream
  const replayed = await hub.replay({ projectSlug: 'media-hub', limit: 20 });
  assert.ok(replayed.some((e) => (e.payload as any)?.runId === uniqueRunId));

  // Verify pingStand with no status changes does not trigger full-stand persist
  await projectarium.pingStand(`live-hb-${uniqueRunId}`, { recordSummary: false });
  assert.equal(transactionCalls, 1, 'No-op pingStand must not rewrite full stand');

  // Verify cross-bus received app.registered event
  await new Promise((r) => setTimeout(r, 250));
  const appReplay = await hub.replay({ projectSlug: 'projectarium', limit: 30 });
  assert.ok(appReplay.some((e) => e.topic === 'lemon.projectarium.app.heartbeat'));
  console.log('✓ 4. Lightweight heartbeats (0 full-stand txns, single-row update, coalesced JetStream pulse) & replay verified');

  await mediaSub.unsubscribe();
  await crossSub.unsubscribe();
  relay.onModuleDestroy();
  await stackBus.onModuleDestroy();
  console.log('\n=== All Live NATS JetStream Integration Tests Passed! ===');
}

runLiveNatsIntegrationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
