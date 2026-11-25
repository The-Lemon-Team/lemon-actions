import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { SPACE_FOLDERS, SPACE_TOWER_FLOWS } from '../seeds/space-towers.seed';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

async function runSpaceTowersTests() {
  console.log('=== Running Space Towers & Main Emitter Verification ===\n');

  const db = {
    folders: new Map<string, any>(),
    flows: new Map<string, any>(),
    sessions: [] as any[],
    events: [] as any[],
  };

  SPACE_FOLDERS.forEach((f, idx) => {
    db.folders.set(`folder-${idx + 1}`, {
      id: `folder-${idx + 1}`,
      name: f.name,
      path: f.path,
      profileId: null,
    });
  });

  const folderIdByPath = (path: string) => {
    for (const [id, f] of db.folders.entries()) {
      if (f.path === path) return id;
    }
    return null;
  };

  const mockRepo: any = {
    transaction: async (fn: any) => fn(mockRepo),
    findById: async (id: string) => db.flows.get(id) ?? null,
    findMany: async (q: any = {}) => {
      let list = Array.from(db.flows.values());
      if (q.folderId) list = list.filter((f) => f.folderId === q.folderId);
      return list;
    },
    findFlowsByFolder: async (folderId: string) =>
      Array.from(db.flows.values()).filter((f) => f.folderId === folderId),
    findRunningExclusive: async () => [],
    getFolderMeta: async (id: string) => db.folders.get(id) ?? null,
    create: async (data: any, tagNames: string[]) => {
      const id = `flow-${db.flows.size + 1}`;
      const f = {
        id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        status: FlowStatus.INACTIVE,
        isExclusive: data.isExclusive ?? false,
        folderId: data.folder?.connect?.id ?? null,
        profileId: null,
        tags: tagNames.map((n, i) => ({ tag: { id: `t-${i}`, name: n } })),
        config: data.config ?? null,
        orchestratorRules: data.orchestratorRules ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.flows.set(id, f);
      return f;
    },
    update: async (id: string, data: any) => {
      const cur = db.flows.get(id);
      if (!cur) throw new Error(`Flow ${id} not found`);
      const next = {
        ...cur,
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.orchestratorRules !== undefined ? { orchestratorRules: data.orchestratorRules } : {}),
        updatedAt: new Date(),
      };
      db.flows.set(id, next);
      return next;
    },
    setStatus: async (id: string, status: FlowStatus) => {
      const cur = db.flows.get(id);
      const next = { ...cur, status, updatedAt: new Date() };
      db.flows.set(id, next);
      return next;
    },
    hasOpenSession: async (flowId: string) =>
      db.sessions.some((s) => s.flowId === flowId && s.endedAt === null),
    openSession: async (flowId: string) => {
      const s = { id: `sess-${db.sessions.length + 1}`, flowId, startedAt: new Date(), endedAt: null };
      db.sessions.push(s);
      return s;
    },
    closeSessions: async (flowId: string, closedBy: string) => {
      for (const s of db.sessions) {
        if (s.flowId === flowId && s.endedAt === null) {
          s.endedAt = new Date();
          s.closedBy = closedBy;
        }
      }
    },
    findOpenSessionsInFolder: async (folderId: string | null) => {
      if (!folderId) return [];
      const flowIds = new Set(
        Array.from(db.flows.values())
          .filter((f) => f.folderId === folderId)
          .map((f) => f.id),
      );
      return db.sessions.filter((s) => flowIds.has(s.flowId) && s.endedAt === null);
    },
    touchFlow: async () => {},
    createFlowEvent: async (data: any) => {
      const ev = { id: `ev-${db.events.length + 1}`, ...data, createdAt: new Date() };
      db.events.push(ev);
      return ev;
    },
    listEvents: async (flowId: string) => db.events.filter((e) => e.flowId === flowId),
  };

  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const eventBus = new FlowsEventBusService();
  const flowsService = new FlowsService(mockRepo, registry, eventBus);

  // 1. Seed all Main Emitter + 4 Towers flows
  const createdByName = new Map<string, any>();
  for (const seed of SPACE_TOWER_FLOWS) {
    const flow = await flowsService.create({
      name: seed.name,
      description: seed.description,
      type: seed.type,
      isExclusive: seed.isExclusive,
      folderId: folderIdByPath(seed.folder) ?? undefined,
      tags: seed.tags,
      config: seed.config,
    });
    if (seed.status === FlowStatus.ACTIVE) {
      await flowsService.updateStatus(flow.id, FlowStatus.ACTIVE);
    }
    createdByName.set(seed.name, await flowsService.findOne(flow.id));
  }

  assert.equal(createdByName.size, 15, 'Expected 15 flows (Main Emitter x3 + 4 Towers x3)');
  console.log('✓ 1. Seeded Main Emitter + 4 Elemental Towers (15 flows across 7 ltree folders)');

  // 2. Verify Easy in Air & Ansy in Fire
  const airVault = createdByName.get('Башня Воздуха: Казна, Склад и Participants')!;
  const fireVault = createdByName.get('Башня Огня: Казна, Склад и Participants')!;
  assert.equal((airVault.config as any).projectionState.participants[0].actorId, 'actor-easy');
  assert.equal((airVault.config as any).projectionState.participants[0].element, 'AIR');
  assert.equal((fireVault.config as any).projectionState.participants[0].actorId, 'actor-ansy');
  assert.equal((fireVault.config as any).projectionState.participants[0].element, 'FIRE');
  console.log('✓ 2. Easy assigned to AIR Tower, Ansy assigned to FIRE Tower');

  // 3. Simple Open / Close via MUTEX without FSM
  const earthSwitch = createdByName.get('Башня Земли: Статус (Открыто / Закрыто)')!;
  assert.equal(earthSwitch.type, FlowType.MUTEX);
  assert.equal(earthSwitch.status, FlowStatus.ACTIVE);
  await flowsService.updateStatus(earthSwitch.id, FlowStatus.INACTIVE);
  assert.equal((await flowsService.findOne(earthSwitch.id)).status, FlowStatus.INACTIVE);
  await flowsService.updateStatus(earthSwitch.id, FlowStatus.ACTIVE);
  assert.equal((await flowsService.findOne(earthSwitch.id)).status, FlowStatus.ACTIVE);
  console.log('✓ 3. Open/Close toggle via MUTEX works cleanly without FSM');

  // 4. Main Emitter issues & retains completed task (AP + GAP)
  const emitterProj = createdByName.get('Главный Эмитент: Монетный Двор и Реестр Задач')!;
  await flowsService.appendEvent(emitterProj.id, {
    eventType: 'TASK_ISSUED',
    payload: {
      taskId: 'bounty-5-test-ap',
      title: 'Тестовая задача с AP и GAP',
      reward: 400,
      currency: 'ancient_point',
      rewards: [
        { currency: 'ancient_point', amount: 400 },
        { currency: 'golden_ancient_point', amount: 200 },
      ],
    },
  });
  await flowsService.appendEvent(emitterProj.id, {
    eventType: 'TASK_CLAIMED_BY_TOWER',
    payload: {
      taskId: 'bounty-5-test-ap',
      claimedByTower: 'AIR',
      participants: ['actor-easy'],
    },
  });
  await flowsService.appendEvent(emitterProj.id, {
    eventType: 'TASK_COMPLETED',
    payload: { taskId: 'bounty-5-test-ap' },
  });

  const emitterState = ((await flowsService.findOne(emitterProj.id)).config as any).projectionState;
  const completedTask = emitterState.emitterTasks.find((t: any) => t.taskId === 'bounty-5-test-ap');
  assert.equal(completedTask.status, 'COMPLETED');
  assert.equal(completedTask.issuer, 'genesis-emitter');
  assert.equal(completedTask.retainedByEmitter, true);
  assert.equal(emitterState.balances.ancient_point, 10000, 'Main Emitter mint balance does not self-inflate');
  console.log('✓ 4. Completed task remains attributed to Main Emitter (retainedByEmitter: true)');

  // 5. Fire Tower receives Ansy multi-currency reward (300 AP + 100 FP) & unlocks own lots
  await flowsService.appendEvent(fireVault.id, {
    eventType: 'TASK_ISSUED',
    payload: {
      taskId: 'bounty-4-fire-tower-cards-app',
      title: 'Выделить карточки в отдельное приложение',
      rewards: [
        { currency: 'ancient_point', amount: 300 },
        { currency: 'fire_point', amount: 100 },
      ],
    },
  });
  await flowsService.appendEvent(fireVault.id, {
    eventType: 'TASK_COMPLETED',
    payload: { taskId: 'bounty-4-fire-tower-cards-app' },
  });
  await flowsService.appendEvent(fireVault.id, {
    eventType: 'RESOURCE_PRODUCED',
    payload: { resource: 'EMBER', delta: 1 },
  });
  await flowsService.appendEvent(fireVault.id, {
    eventType: 'OWN_LOT_PUBLISHED',
    payload: {
      lotId: 'fire-lot-1',
      title: 'Конфеты и уютный дашборд для Башни Огня',
      reward: 50,
      currency: 'fire_point',
      kind: 'ORDER',
    },
  });

  const fireState = ((await flowsService.findOne(fireVault.id)).config as any).projectionState;
  assert.equal(fireState.balances.ancient_point, 300);
  assert.equal(fireState.balances.fire_point, 100);
  assert.equal(fireState.resources.EMBER.current, 1);
  assert.equal(fireState.canPublishOwnLots, true);
  assert.equal(fireState.ownLots.length, 1);
  console.log('✓ 5. Fire Tower credits 300 AP + 100 FP, produces EMBER (+1), and unlocks own lots');

  // 6. Unified Task Pool filtering (actorId, status, tower) & task steps progression
  const easyPool = await flowsService.queryTaskPool(emitterProj.id, {
    actorId: 'actor-easy',
    status: 'IN_PROGRESS',
  });
  assert.ok(easyPool.items.some((t: any) => t.taskId === 'bounty-3-tower-cards-constructor'));
  const cardAuditTask = easyPool.items.find((t: any) => t.taskId === 'bounty-3-tower-cards-constructor')!;
  assert.equal(cardAuditTask.stepsTotal, 3);
  assert.equal(cardAuditTask.stepsDone, 2);

  await flowsService.appendEvent(emitterProj.id, {
    eventType: 'TASK_STEP_UPDATED',
    payload: {
      taskId: 'bounty-3-tower-cards-constructor',
      stepId: 'step-3',
      status: 'DONE',
      assigneeActorId: 'actor-easy',
    },
  });
  const easyAfter = await flowsService.queryTaskPool(emitterProj.id, {
    actorId: 'actor-easy',
    tower: 'AIR',
  });
  const cardAuditAfter = easyAfter.items.find((t: any) => t.taskId === 'bounty-3-tower-cards-constructor')!;
  assert.equal(cardAuditAfter.stepsDone, 3);
  const completedEasyTasks = easyAfter.items.filter((t: any) => t.status === 'COMPLETED');
  assert.ok(completedEasyTasks.some((t: any) => t.taskId === 'bounty-2-lemon-actions-bus' && t.reward === 500));
  assert.ok(completedEasyTasks.some((t: any) => t.taskId === 'bounty-6-bus-lightweight-heartbeats' && t.reward === 100));

  const firePool = await flowsService.queryTaskPool(emitterProj.id, {
    actorId: 'actor-hades',
    tower: 'FIRE',
  });
  const mcpTask = firePool.items.find((t: any) => t.taskId === 'bounty-5-timelines-mcp');
  assert.ok(mcpTask, 'Expected bounty-5-timelines-mcp assigned to actor-hades in FIRE Tower');
  assert.equal(mcpTask.status, 'IN_PROGRESS');
  assert.equal(mcpTask.reward, 500);
  assert.equal(mcpTask.currency, 'ancient_point');
  assert.equal(mcpTask.stepsTotal, 3);
  console.log('✓ 6. Unified Task Pool filters by actorId/status/tower & updates task steps cleanly');

  console.log('\n=== All Space Towers & Emitter Tests Passed! ===');
}

runSpaceTowersTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
