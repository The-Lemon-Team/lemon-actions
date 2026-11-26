import assert from 'node:assert/strict';
import { FlowStatus, FlowType } from '@prisma/client';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import {
  BaseFlowTypeHandler,
  createDefaultFlowTypeHandlers,
  FlowRuntimeContext,
  FlowSchedulerContext,
  GateConditionShape,
} from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { ProjectionReducer, ProjectionReducerRegistry } from './handlers/projection-reducer.registry';
import { SpaceTowersProjectionReducer } from './reducers/space-towers.projection-reducer';

function createInMemoryRepo() {
  const flows = new Map<string, any>();
  const events: any[] = [];
  const sessions: any[] = [];
  let seq = 0;

  const repo: any = {
    transaction: async (fn: any) => fn(repo),
    findById: async (id: string) => flows.get(id) ?? null,
    findByIdLite: async (id: string) => flows.get(id) ?? null,
    findMany: async () => Array.from(flows.values()),
    findSchedulableFlows: async () => Array.from(flows.values()),
    findFlowsByFolder: async (folderId: string) =>
      Array.from(flows.values()).filter((f) => f.folderId === folderId),
    findRunningExclusive: async () => [],
    getFolderMeta: async (id: string) => ({ id, profileId: null }),
    create: async (data: any, tagNames: string[]) => {
      const id = `flow-${++seq}`;
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
      const cur = flows.get(id);
      const next = { ...cur, ...(data.config !== undefined ? { config: data.config } : {}), updatedAt: new Date() };
      flows.set(id, next);
      return next;
    },
    updateLite: async (id: string, data: any) => {
      const cur = flows.get(id);
      const next = { ...cur, ...(data.config !== undefined ? { config: data.config } : {}), updatedAt: new Date() };
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
      const s = { id: `sess-${sessions.length + 1}`, flowId, startedAt: new Date(), endedAt: null };
      sessions.push(s);
      return s;
    },
    closeSessions: async () => {},
    findOpenSessionsInFolder: async () => [],
    touchFlow: async () => {},
    createFlowEvent: async (data: any) => {
      const ev = { id: `ev-${events.length + 1}`, createdAt: new Date(), ...data };
      events.push(ev);
      return ev;
    },
    events,
  };
  return repo;
}

async function runExtensibilityTests() {
  console.log('=== Running Stage 1: Handler & Projection Reducer Extensibility Tests ===\n');

  // 1. Register a custom project-specific ProjectionReducer alongside SpaceTowersProjectionReducer
  const quotaReducer: ProjectionReducer = {
    key: 'ai-shard/token-quota',
    reduce(prevState, eventType, payload, config, at) {
      const limit = Number(config.monthlyLimit ?? 1000);
      const used = Number(prevState.usedTokens ?? 0) + (eventType === 'TOKENS_SPENT' ? Number(payload.tokens ?? 0) : 0);
      return {
        ...prevState,
        usedTokens: used,
        remainingTokens: Math.max(0, limit - used),
        exhausted: used >= limit,
        updatedAt: at.toISOString(),
      };
    },
  };

  const reducerRegistry = new ProjectionReducerRegistry([new SpaceTowersProjectionReducer(), quotaReducer]);
  const handlers = createDefaultFlowTypeHandlers(reducerRegistry);
  const typeRegistry = new FlowTypeRegistry(handlers);

  // 2. Override/extend a FlowTypeHandler cleanly via FlowTypeRegistry without modifying FlowsService
  let customTriggerCalls = 0;
  let customTickCalls = 0;
  class CustomContextHandler extends BaseFlowTypeHandler {
    readonly type = FlowType.CONTEXT;

    async onEvent(ctx: FlowRuntimeContext, event: { eventType: string; payload: Record<string, unknown> }) {
      if (event.eventType === 'PIN_NOTE') {
        const cfg = (ctx.flow.config ?? {}) as Record<string, any>;
        await ctx.updateConfig({ ...cfg, pinnedNote: event.payload.note });
      }
    }

    async onTrigger(flowId: string, action: string | undefined) {
      if (action === 'ping-custom') {
        customTriggerCalls++;
        return { pong: true, flowId };
      }
      return undefined;
    }

    evaluateGateCondition(target: any, condition: GateConditionShape): string | null {
      if (condition.expectedState && (target.config as any)?.pinnedNote !== condition.expectedState) {
        return `CustomContext "${target.name}" missing pinnedNote "${condition.expectedState}"`;
      }
      return null;
    }

    async onSchedulerTick(ctx: FlowSchedulerContext) {
      if (ctx.flow.status === FlowStatus.ACTIVE && (ctx.flow.config as any)?.enableCustomTick) {
        customTickCalls++;
      }
      return null;
    }
  }
  typeRegistry.register(new CustomContextHandler());

  const repo = createInMemoryRepo();
  const eventBus = new FlowsEventBusService();
  const flowsService = new FlowsService(repo, typeRegistry, eventBus);
  const scheduler = new FlowSchedulerService(repo, flowsService, typeRegistry);

  const impulses: any[] = [];
  const sub = eventBus.stream$().subscribe((p) => impulses.push(p));

  // Test A: Custom ProjectionReducer executes for project-specific projection flow
  const quotaFlow = await flowsService.create({
    name: 'AI Shard Quota',
    type: FlowType.PROJECTION,
    projectSlug: 'lemon-ai',
    config: {
      reducerKey: 'ai-shard/token-quota',
      monthlyLimit: 500,
    },
  });
  await flowsService.appendEvent(quotaFlow.id, {
    eventType: 'TOKENS_SPENT',
    payload: { tokens: 350 },
  });
  await flowsService.appendEvent(quotaFlow.id, {
    eventType: 'TOKENS_SPENT',
    payload: { tokens: 200 },
  });
  const updatedQuota = ((await flowsService.findOne(quotaFlow.id)).config as any).projectionState;
  assert.equal(updatedQuota.usedTokens, 550);
  assert.equal(updatedQuota.remainingTokens, 0);
  assert.equal(updatedQuota.exhausted, true);
  console.log('✓ 1. Custom ProjectionReducer ("ai-shard/token-quota") ran cleanly without touching FlowsService');

  // Test B: Generic fallback ProjectionReducer works out-of-the-box for unknown/unconfigured projections
  const genericProj = await flowsService.create({
    name: 'Generic Counters',
    type: FlowType.PROJECTION,
    config: { reducerKey: 'generic' },
  });
  await flowsService.appendEvent(genericProj.id, {
    eventType: 'COUNTER_INCREMENT',
    payload: { counter: 'jobs', delta: 3 },
  });
  const genericState = ((await flowsService.findOne(genericProj.id)).config as any).projectionState;
  assert.equal(genericState.counters.jobs, 3);
  console.log('✓ 2. Built-in GenericProjectionReducer handles generic counter/kv projections');

  // Test C: Runtime FSM transitions via FsmFlowHandler
  const fsmFlow = await flowsService.create({
    name: 'Deep Work FSM',
    type: FlowType.FSM,
    config: {
      initial: 'idle',
      states: {
        idle: {
          label: 'Idle',
          badgeColor: '#999',
          transitions: [
            { event: 'START', target: 'focusing', ui: { buttonLabel: 'Start', intent: 'primary' } },
          ],
        },
        focusing: {
          label: 'Focusing',
          badgeColor: '#0a0',
          transitions: [
            { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', intent: 'danger' } },
          ],
        },
      },
    },
  });
  await flowsService.appendEvent(fsmFlow.id, { eventType: 'UNKNOWN_EVT', payload: {} });
  assert.equal(((await flowsService.findOne(fsmFlow.id)).config as any).currentState, undefined);
  await flowsService.appendEvent(fsmFlow.id, { eventType: 'START', payload: {} });
  eventBus.engine.flush();
  const fsmCfg = (await flowsService.findOne(fsmFlow.id)).config as any;
  assert.equal(fsmCfg.currentState, 'focusing');
  assert.equal(fsmCfg.lastTransition.from, 'idle');
  assert.equal(fsmCfg.lastTransition.to, 'focusing');
  assert.ok(impulses.some((p) => p.flowId === fsmFlow.id && p.topic.endsWith('.fsm_transition')));
  console.log('✓ 3. FsmFlowHandler executes runtime state transitions and emits fsm_transition impulse');

  // Test D: Custom FlowTypeHandler hooks (onEvent, onTrigger, evaluateGateCondition, onSchedulerTick)
  const customCtxFlow = await flowsService.create({
    name: 'Shard Custom Context',
    type: FlowType.CONTEXT,
    folderId: 'folder-ext',
    config: { enableCustomTick: true },
  });
  await flowsService.updateStatus(customCtxFlow.id, FlowStatus.ACTIVE);
  await flowsService.appendEvent(customCtxFlow.id, {
    eventType: 'PIN_NOTE',
    payload: { note: 'ready' },
  });
  assert.equal(((await flowsService.findOne(customCtxFlow.id)).config as any).pinnedNote, 'ready');

  const trigRes = await flowsService.trigger(customCtxFlow.id, { action: 'ping-custom' });
  assert.deepEqual(trigRes, { pong: true, flowId: customCtxFlow.id });
  assert.equal(customTriggerCalls, 1);

  await scheduler.tick(new Date());
  assert.equal(customTickCalls, 1);

  const gatedMutex = await flowsService.create({
    name: 'Gated by Custom Context',
    type: FlowType.MUTEX,
    folderId: 'folder-ext',
    orchestratorRules: {
      gate: {
        enabled: true,
        strategy: 'ALL',
        conditions: [{ flowId: customCtxFlow.id, expectedState: 'other' }],
      },
    },
  });
  await assert.rejects(() => flowsService.updateStatus(gatedMutex.id, FlowStatus.ACTIVE), /missing pinnedNote "other"/);
  console.log('✓ 4. Custom FlowTypeHandler hooks (onEvent, onTrigger, onSchedulerTick, evaluateGateCondition) work seamlessly');

  sub.unsubscribe();
  console.log('\n=== All Stage 1 Extensibility Tests Passed! ===');
}

runExtensibilityTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
