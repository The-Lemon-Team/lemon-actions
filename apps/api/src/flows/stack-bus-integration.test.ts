import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { InMemoryStackBusTransport, StackBusHub } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { MediaService } from '../media/media.service';
import { ProjectariumService } from '../projectarium/projectarium.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';

function createMockFlowsRepo() {
  const flows = new Map<string, any>();
  const folders = new Map<string, { id: string; profileId: string | null; path: string | null }>([
    ['fld-space', { id: 'fld-space', profileId: null, path: 'space.emitter' }],
    ['fld-arena', { id: 'fld-arena', profileId: null, path: 'arena.actors' }],
    ['fld-code', { id: 'fld-code', profileId: null, path: 'code.js_practice' }],
    ['fld-home', { id: 'fld-home', profileId: null, path: 'home.supplies' }],
    ['fld-core', { id: 'fld-core', profileId: null, path: 'workspace.core' }],
  ]);
  const events: any[] = [];
  const sessions: any[] = [];
  let seq = 0;

  const repo: any = {
    transaction: async (fn: any) => fn(repo),
    findById: async (id: string) => flows.get(id) ?? null,
    findMany: async (q: any = {}) => {
      let list = Array.from(flows.values());
      if (q.projectSlug) list = list.filter((f) => f.projectSlug === q.projectSlug);
      if (q.type) list = list.filter((f) => f.type === q.type);
      if (q.status) list = list.filter((f) => f.status === q.status);
      return list;
    },
    findFlowsByFolder: async () => [],
    findRunningExclusive: async () => [],
    getFolderMeta: async (id: string) => folders.get(id) ?? null,
    create: async (data: any, tagNames: string[]) => {
      const id = `flow-${++seq}`;
      const record = {
        id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        status: FlowStatus.INACTIVE,
        isExclusive: data.isExclusive ?? false,
        folderId: null,
        profileId: null,
        projectSlug: data.projectSlug ?? null,
        tags: tagNames.map((name, i) => ({ tag: { id: `t-${i}`, name } })),
        config: data.config ?? null,
        orchestratorRules: data.orchestratorRules ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      flows.set(id, record);
      return record;
    },
    update: async (id: string, data: any) => {
      const cur = flows.get(id);
      if (!cur) throw new Error(`Flow ${id} not found`);
      const next = {
        ...cur,
        ...(data.projectSlug !== undefined ? { projectSlug: data.projectSlug } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
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
    hasOpenSession: async () => false,
    openSession: async (flowId: string) => {
      const s = { id: `sess-${sessions.length + 1}`, flowId, endedAt: null };
      sessions.push(s);
      return s;
    },
    closeSessions: async () => {},
    findOpenSessionsInFolder: async () => [],
    touchFlow: async () => {},
    createFlowEvent: async (data: any) => {
      const ev = { id: `fe-${events.length + 1}`, createdAt: new Date(), ...data };
      events.push(ev);
      return ev;
    },
    events,
  };

  return repo;
}

async function runStackBusIntegrationTests() {
  console.log('=== Running Lemon Stack Bus & Project Flow Isolation Tests ===\n');

  const transport = new InMemoryStackBusTransport();
  await transport.connect();
  const stackBus = new StackBusService(new StackBusHub(transport));

  const eventBus = new FlowsEventBusService();
  const repo = createMockFlowsRepo();
  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const flowsService = new FlowsService(repo, registry, eventBus);
  const relay = new LemonBusRelayService(eventBus, stackBus, flowsService);
  relay.onModuleInit();

  // 1. Per-project flow isolation in lemon-core
  const universeFlow = await flowsService.create({
    name: 'Universe Timeline Trigger',
    type: FlowType.CONTEXT,
    projectSlug: 'Lemon Universe',
    config: { mode: 'timeline' },
  });
  const mediaObserver = await flowsService.create({
    name: 'Media Created Observer',
    type: FlowType.OBSERVER,
    projectSlug: 'media-hub',
    config: {
      selector: {
        topics: ['lemon.media-hub.media.created'],
      },
    },
  });
  const crossProjectObserver = await flowsService.create({
    name: 'Cross-Project Projectarium & Media Observer',
    type: FlowType.OBSERVER,
    config: {
      selector: {
        topics: ['lemon.projectarium.>', 'media.created'],
      },
    },
  });

  await flowsService.updateStatus(mediaObserver.id, FlowStatus.ACTIVE);
  await flowsService.updateStatus(crossProjectObserver.id, FlowStatus.ACTIVE);

  assert.equal(universeFlow.projectSlug, 'lemon-universe');
  const universeList = await flowsService.list({ projectSlug: 'lemon-universe' });
  assert.equal(universeList.length, 1);
  assert.equal(universeList[0].id, universeFlow.id);

  const universeStreamPackets: any[] = [];
  const streamSub = eventBus
    .stream$({ projectSlug: 'lemon-universe', topic: 'lemon.lemon-universe.flow.*' })
    .subscribe((p) => universeStreamPackets.push(p));

  await flowsService.trigger(universeFlow.id, { payload: { board: 'global-day' } });
  eventBus.engine.flush();
  assert.equal(universeStreamPackets.length, 1);
  assert.equal(universeStreamPackets[0].projectSlug, 'lemon-universe');
  assert.equal(universeStreamPackets[0].topic, 'lemon.lemon-universe.flow.triggered');
  streamSub.unsubscribe();
  console.log('✓ 1. CoreCombinator & FlowsService isolate flows and impulses by projectSlug + topic');

  // 2. Observer topic selectors dispatch bus events without feedback loops
  const mediaBus = stackBus.forProject('media-hub', 'lemon-media-hub');
  await mediaBus.publish('media', 'created', { assetId: 'asset-42', kind: 'image' }, { dedupKey: 'media:asset-42' });

  // Allow microtasks from RxJS subscription to settle
  await new Promise((r) => setTimeout(r, 20));

  const mediaObserverEvents = repo.events.filter((e: any) => e.flowId === mediaObserver.id);
  const crossEvents = repo.events.filter((e: any) => e.flowId === crossProjectObserver.id);
  assert.equal(mediaObserverEvents.length, 1);
  assert.equal(mediaObserverEvents[0].eventType, 'lemon.media-hub.media.created');
  assert.equal(crossEvents.length, 1);
  console.log('✓ 2. Observer Flow selectors match full & short topics across projects');

  // 3. MediaService streams browser SSE from StackBus (lemon.media-hub.media.>) without connecting to media-hub SSE
  const mediaService = new MediaService(stackBus);
  mediaService.onModuleInit();
  const browserPackets: any[] = [];
  const mediaEventsSub = mediaService.events$().subscribe((packet) => browserPackets.push(packet));

  await mediaBus.publish(
    'media',
    'created',
    { assetId: 'asset-99', kind: 'VIDEO', folderPath: '/demo', filename: 'clip.mp4' },
    { dedupKey: 'media:created:asset-99' },
  );
  await new Promise((r) => setTimeout(r, 20));

  assert.equal((mediaService as any).axon.sseBus.isConnected, false);
  assert.ok(browserPackets.some((p) => p.type === 'MEDIA_ADDED' && p.impulse?.assetId === 'asset-99'));
  mediaEventsSub.unsubscribe();
  mediaService.onModuleDestroy();
  console.log('✓ 3. MediaService relays StackBus lemon.media-hub.media.created to UI without backend SSE');

  // 4. ProjectariumService publishes domain events on StackBus and skips heartbeat bus spam
  const noopTable = () => ({
    upsert: async () => {},
    findMany: async () => [],
    deleteMany: async () => {},
    createMany: async () => {},
    create: async () => {},
    updateMany: async () => {},
  });
  const mockPrisma: any = {
    $transaction: async (fn: any) => fn(mockPrisma),
    projectariumStand: noopTable(),
    projectariumAppRecord: noopTable(),
    projectariumTodoRecord: noopTable(),
    projectariumNoteRecord: noopTable(),
    projectariumEventRecord: noopTable(),
    projectariumAppRunRecord: noopTable(),
  };
  const projectarium = new ProjectariumService(mockPrisma, stackBus);
  const reg = await projectarium.registerOrAttach({
    projectSlug: 'lemon-universe',
    projectName: 'Lemon Universe',
    appName: 'Timelines API',
    preferredPort: 4321,
    environment: 'dev',
    networkMode: 'local',
  });
  for (let i = 0; i < 3; i++) {
    await projectarium.heartbeat({
      instanceId: reg.allocatedApp.instanceId,
      leaseToken: reg.allocatedApp.leaseToken,
    });
  }
  await projectarium.addTodo('lemon-universe', { title: 'Test Bus Integration', scope: 'PROJECT' });
  await projectarium.addChronicleEvent('lemon-universe', { description: 'Stand connected to NATS bus', scope: 'PROJECT' });

  await new Promise((r) => setTimeout(r, 20));
  const projectariumReplay = await stackBus.replay({ projectSlug: 'projectarium' });
  const topics = projectariumReplay.map((e) => e.topic);
  assert.ok(topics.includes('lemon.projectarium.app.registered'));
  assert.ok(topics.includes('lemon.projectarium.todo.changed'));
  assert.ok(topics.includes('lemon.projectarium.chronicle.added'));
  assert.equal(topics.filter((t) => t === 'lemon.projectarium.app.heartbeat').length, 1);

  // Cross-project observer also received the Projectarium events (including coalesced heartbeat)
  const crossProjectariumEvents = repo.events.filter(
    (e: any) => e.flowId === crossProjectObserver.id && e.eventType.startsWith('lemon.projectarium.'),
  );
  assert.equal(crossProjectariumEvents.length, 4);
  console.log('✓ 4. ProjectariumService emits stand/app/todo/chronicle events & coalesces heartbeats');

  // 5. Folder path automatically infers projectSlug when explicit slug is omitted
  const inferredSpace = await flowsService.create({ name: 'Space Tower Lot', type: FlowType.CONTEXT, folderId: 'fld-space' });
  const inferredArena = await flowsService.create({ name: 'Arena Card', type: FlowType.CONTEXT, folderId: 'fld-arena' });
  const inferredCode = await flowsService.create({ name: 'Code Task', type: FlowType.MUTEX, folderId: 'fld-code' });
  const inferredHome = await flowsService.create({ name: 'Home Supply', type: FlowType.MUTEX, folderId: 'fld-home' });
  const inferredCore = await flowsService.create({ name: 'Core Mutex', type: FlowType.MUTEX, folderId: 'fld-core' });
  const overridden = await flowsService.create({
    name: 'Explicit Override',
    type: FlowType.CONTEXT,
    folderId: 'fld-core',
    projectSlug: 'custom-stand',
  });
  assert.equal(inferredSpace.projectSlug, 'lemon-space');
  assert.equal(inferredArena.projectSlug, 'lemon-universe');
  assert.equal(inferredCode.projectSlug, 'lemon-code');
  assert.equal(inferredHome.projectSlug, 'home');
  assert.equal(inferredCore.projectSlug, 'lemon-core');
  assert.equal(overridden.projectSlug, 'custom-stand');
  console.log('✓ 5. FlowsService auto-derives projectSlug from ltree folder path unless explicitly overridden');

  relay.onModuleDestroy();
  await stackBus.onModuleDestroy();
  console.log('\n=== All Stack Bus Integration Tests Passed! ===');
}

runStackBusIntegrationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
