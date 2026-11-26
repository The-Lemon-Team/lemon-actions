import { BadRequestException } from '@nestjs/common';
import { Flow, FlowStatus, FlowType } from '@prisma/client';
import { FlowImpulseType } from '@lemon/core-combinator';
import { SpaceTowersProjectionReducer } from '../reducers/space-towers.projection-reducer';
import { ProjectionReducerRegistry } from './projection-reducer.registry';

export interface GateConditionShape {
  flowId?: string;
  flowName?: string;
  type?: FlowType;
  expectedStatus?: FlowStatus;
  expectedState?: string;
  requirePendingItems?: boolean;
}

export interface FlowRuntimeContext {
  flow: {
    id: string;
    name: string;
    type: FlowType;
    status: FlowStatus;
    isExclusive: boolean;
    folderId: string | null;
    projectSlug?: string | null;
    config?: unknown;
    orchestratorRules?: unknown;
    updatedAt: Date;
  };
  openSessionIds: string[];
  updateConfig(nextConfig: unknown): Promise<void>;
  appendInternalEvent(eventType: string, source: string, payload: Record<string, unknown>): Promise<void>;
  queueImpulse(
    type: FlowImpulseType,
    eventSlug: string,
    payload: Record<string, unknown>,
    extra?: { id?: string; timestamp?: string; activeSessionIds?: string[] },
  ): void;
}

export interface FlowSchedulerContext {
  flow: Flow;
  now: Date;
  emitTimerTick(flowId: string, now: Date): Promise<unknown>;
  updateCircuitBreaker(flowId: string, state: 'OPEN' | 'CLOSED' | 'HALF_OPEN', reason?: string): Promise<unknown>;
  flushBatch(flowId: string, reason: string): Promise<unknown>;
}

export type SchedulerMetricKey = 'timerTicks' | 'circuitBreakersRecovered' | 'batchesFlushed';

/**
 * Strategy interface: one handler per FlowType. Register a new handler in
 * FlowsModule (FLOW_TYPE_HANDLERS) to support a new FlowType; the service/orchestrator
 * never branches on type (Open/Closed).
 */
export interface FlowTypeHandler {
  readonly type: FlowType;
  /** Marks flows whose lifecycle mutations invalidate the Bus Relay observer cache. */
  readonly invalidatesObserverCache?: boolean;
  /** Throws BadRequestException when the config is invalid for this type. */
  validateConfig(config: unknown): void;
  /** Runs inside appendEvent transaction to mutate flow state / emit side impulses. */
  onEvent?(
    ctx: FlowRuntimeContext,
    event: { eventType: string; source: string; payload: Record<string, unknown>; createdAt: Date },
  ): Promise<void>;
  /** Handles custom actions on POST /flows/:id/trigger. */
  onTrigger?(
    flowId: string,
    action: string | undefined,
    payload: Record<string, unknown>,
    actions: { flushBatch: (flowId: string, reason: string) => Promise<unknown> },
  ): Promise<unknown | undefined>;
  /** Evaluates type-specific Activation Gate checks against this flow. Returns failure reason or null. */
  evaluateGateCondition?(target: Flow, condition: GateConditionShape): string | null;
  /** Runs during FlowSchedulerService.tick() for eligible flows. */
  onSchedulerTick?(ctx: FlowSchedulerContext): Promise<SchedulerMetricKey | null>;
}

export const FLOW_TYPE_HANDLERS = Symbol('FLOW_TYPE_HANDLERS');

/** Config is optional and free-form unless a handler says otherwise. */
export abstract class BaseFlowTypeHandler implements FlowTypeHandler {
  abstract readonly type: FlowType;
  readonly invalidatesObserverCache?: boolean = false;
  validateConfig(_config: unknown): void {}
}

export class ContextFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.CONTEXT;
}

export class MutexFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.MUTEX;
}

export class ObserverFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.OBSERVER;
  readonly invalidatesObserverCache = true;
}

export class TimerFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.TIMER;

  validateConfig(config: unknown): void {
    if (config == null) return;
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('TIMER config must be an object');
    }
  }

  async onSchedulerTick(ctx: FlowSchedulerContext): Promise<SchedulerMetricKey | null> {
    if (ctx.flow.status !== FlowStatus.ACTIVE) return null;
    const cfg = (ctx.flow.config ?? {}) as { intervalSeconds?: number; lastTickAt?: string };
    const intervalSec = cfg.intervalSeconds && cfg.intervalSeconds > 0 ? cfg.intervalSeconds : 60;
    const lastTick = cfg.lastTickAt ? new Date(cfg.lastTickAt).getTime() : 0;
    const elapsed = (ctx.now.getTime() - lastTick) / 1000;

    if (elapsed >= intervalSec) {
      await ctx.emitTimerTick(ctx.flow.id, ctx.now);
      return 'timerTicks';
    }
    return null;
  }
}

export class FsmFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.FSM;

  validateConfig(config: unknown): void {
    if (config == null) return;
    const bad = (m: string) => new BadRequestException(`Invalid FSM config: ${m}`);
    const c = config as any;
    if (typeof c !== 'object' || typeof c.initial !== 'string') throw bad('"initial" must be a string');
    if (!c.states || typeof c.states !== 'object') throw bad('"states" must be an object');
    if (!(c.initial in c.states)) throw bad(`initial state "${c.initial}" is not defined in states`);
    for (const [key, s] of Object.entries<any>(c.states)) {
      if (typeof s?.label !== 'string' || typeof s?.badgeColor !== 'string') {
        throw bad(`state "${key}" requires label and badgeColor`);
      }
      if (!Array.isArray(s.transitions)) throw bad(`state "${key}".transitions must be an array`);
      for (const t of s.transitions) {
        if (typeof t?.event !== 'string' || typeof t?.target !== 'string') {
          throw bad(`state "${key}" has a transition without event/target`);
        }
        if (!(t.target in c.states)) throw bad(`transition target "${t.target}" is not a defined state`);
        if (typeof t.ui?.buttonLabel !== 'string' || typeof t.ui?.intent !== 'string') {
          throw bad(`transition "${t.event}" requires ui.buttonLabel and ui.intent`);
        }
      }
    }
  }

  async onEvent(
    ctx: FlowRuntimeContext,
    event: { eventType: string; source: string; payload: Record<string, unknown>; createdAt: Date },
  ): Promise<void> {
    const cfg = (ctx.flow.config ?? {}) as Record<string, any>;
    if (!cfg.states || typeof cfg.states !== 'object' || typeof cfg.initial !== 'string') {
      return;
    }

    const currentState = typeof cfg.currentState === 'string' ? cfg.currentState : cfg.initial;
    const stateDef = cfg.states[currentState];
    const transitions = Array.isArray(stateDef?.transitions) ? stateDef.transitions : [];
    const matched = transitions.find((t: any) => t?.event === event.eventType);
    if (!matched || !(matched.target in cfg.states)) {
      return;
    }

    const nextConfig = {
      ...cfg,
      currentState: matched.target,
      lastTransition: {
        from: currentState,
        to: matched.target,
        event: event.eventType,
        at: event.createdAt.toISOString(),
      },
    };

    await ctx.updateConfig(nextConfig);
    ctx.queueImpulse(
      'CONTEXT_UPDATED',
      'fsm_transition',
      {
        previousState: currentState,
        currentState: matched.target,
        event: event.eventType,
        config: nextConfig,
      },
      { timestamp: event.createdAt.toISOString() },
    );
  }
}

export class CircuitBreakerFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.CIRCUIT_BREAKER;

  validateConfig(config: unknown): void {
    if (config == null) return;
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('CIRCUIT_BREAKER config must be an object');
    }
    const c = config as any;
    if (c.failureThreshold !== undefined && (typeof c.failureThreshold !== 'number' || c.failureThreshold <= 0)) {
      throw new BadRequestException('failureThreshold must be a positive number');
    }
    if (c.cooldownSeconds !== undefined && (typeof c.cooldownSeconds !== 'number' || c.cooldownSeconds <= 0)) {
      throw new BadRequestException('cooldownSeconds must be a positive number');
    }
  }

  async onEvent(
    ctx: FlowRuntimeContext,
    event: { eventType: string; source: string; payload: Record<string, unknown>; createdAt: Date },
  ): Promise<void> {
    if (event.eventType === 'CIRCUIT_BREAKER_STATE') return;

    const cfg = (ctx.flow.config ?? {}) as Record<string, any>;
    const currentState = cfg.state || 'CLOSED';
    const isError =
      event.eventType.includes('FAIL') ||
      event.eventType.includes('ERROR') ||
      event.payload?.error !== undefined ||
      (typeof event.payload?.statusCode === 'number' && event.payload.statusCode >= 400);

    if (isError) {
      const failCount = (cfg.failureCount || 0) + 1;
      const threshold = cfg.failureThreshold || 3;
      if (failCount >= threshold && currentState !== 'OPEN') {
        await this.transitionState(ctx, cfg, 'OPEN', `Trip threshold reached (${failCount}/${threshold})`);
      } else {
        await ctx.updateConfig({ ...cfg, failureCount: failCount });
      }
      return;
    }

    if (currentState === 'HALF_OPEN') {
      const successCount = (cfg.successCount || 0) + 1;
      const successThreshold = cfg.successThreshold || 1;
      if (successCount >= successThreshold) {
        await this.transitionState(ctx, cfg, 'CLOSED', 'Recovery confirmed');
      } else {
        await ctx.updateConfig({ ...cfg, successCount });
      }
    }
  }

  evaluateGateCondition(target: Flow, condition: GateConditionShape): string | null {
    const cbState = (target.config as any)?.state || 'CLOSED';
    const expected = condition.expectedState || 'CLOSED';
    if (cbState !== expected) {
      return `Circuit Breaker "${target.name}" is ${cbState}, expected ${expected}`;
    }
    return null;
  }

  async onSchedulerTick(ctx: FlowSchedulerContext): Promise<SchedulerMetricKey | null> {
    const cfg = (ctx.flow.config ?? {}) as { state?: string; openedAt?: string; cooldownSeconds?: number };
    if (cfg.state !== 'OPEN') return null;

    const openedAt = cfg.openedAt ? new Date(cfg.openedAt).getTime() : new Date(ctx.flow.updatedAt).getTime();
    const cooldownSec = cfg.cooldownSeconds && cfg.cooldownSeconds > 0 ? cfg.cooldownSeconds : 60;
    const elapsed = (ctx.now.getTime() - openedAt) / 1000;

    if (elapsed >= cooldownSec) {
      await ctx.updateCircuitBreaker(ctx.flow.id, 'HALF_OPEN', 'cooldown_expired');
      return 'circuitBreakersRecovered';
    }
    return null;
  }

  private async transitionState(
    ctx: FlowRuntimeContext,
    cfg: Record<string, any>,
    state: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
    reason: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    await ctx.updateConfig({
      ...cfg,
      state,
      failureCount: state === 'CLOSED' ? 0 : cfg.failureCount,
      successCount: state === 'CLOSED' ? 0 : cfg.successCount,
      openedAt: state === 'OPEN' ? nowIso : cfg.openedAt,
    });
    await ctx.appendInternalEvent('CIRCUIT_BREAKER_STATE', 'supervisor', {
      state,
      reason,
      timestamp: nowIso,
    });
    ctx.queueImpulse('CIRCUIT_BREAKER_STATE', 'circuit_breaker', { state, reason });
  }
}

export class BatchFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.BATCH;

  validateConfig(config: unknown): void {
    if (config == null) return;
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('BATCH config must be an object');
    }
    const c = config as any;
    if (c.maxBatchSize !== undefined && (typeof c.maxBatchSize !== 'number' || c.maxBatchSize <= 0)) {
      throw new BadRequestException('maxBatchSize must be a positive number');
    }
    if (c.maxWaitSeconds !== undefined && (typeof c.maxWaitSeconds !== 'number' || c.maxWaitSeconds <= 0)) {
      throw new BadRequestException('maxWaitSeconds must be a positive number');
    }
    if (c.idleTimeoutSeconds !== undefined && (typeof c.idleTimeoutSeconds !== 'number' || c.idleTimeoutSeconds <= 0)) {
      throw new BadRequestException('idleTimeoutSeconds must be a positive number');
    }
  }

  async onTrigger(
    flowId: string,
    action: string | undefined,
    _payload: Record<string, unknown>,
    actions: { flushBatch: (flowId: string, reason: string) => Promise<unknown> },
  ): Promise<unknown | undefined> {
    if (action === 'flush') {
      return actions.flushBatch(flowId, 'MANUAL_TRIGGER');
    }
    return undefined;
  }

  evaluateGateCondition(target: Flow, condition: GateConditionShape): string | null {
    if (!condition.requirePendingItems) return null;
    const pendingCount = (target.config as any)?.pendingCount ?? 0;
    if (pendingCount <= 0) {
      return `Batch "${target.name}" has 0 pending items`;
    }
    return null;
  }

  async onSchedulerTick(ctx: FlowSchedulerContext): Promise<SchedulerMetricKey | null> {
    if (ctx.flow.status !== FlowStatus.ACTIVE) return null;
    const cfg = (ctx.flow.config ?? {}) as {
      pendingCount?: number;
      maxWaitSeconds?: number;
      idleTimeoutSeconds?: number;
      windowStartedAt?: string;
      lastItemAt?: string;
    };
    const pending = cfg.pendingCount ?? 0;
    if (pending <= 0) return null;

    const maxWait = cfg.maxWaitSeconds && cfg.maxWaitSeconds > 0 ? cfg.maxWaitSeconds : 60;
    const idleTimeout = cfg.idleTimeoutSeconds && cfg.idleTimeoutSeconds > 0 ? cfg.idleTimeoutSeconds : 10;
    const windowStart = cfg.windowStartedAt
      ? new Date(cfg.windowStartedAt).getTime()
      : new Date(ctx.flow.updatedAt).getTime();
    const lastItem = cfg.lastItemAt ? new Date(cfg.lastItemAt).getTime() : windowStart;

    const waitElapsed = (ctx.now.getTime() - windowStart) / 1000;
    const idleElapsed = (ctx.now.getTime() - lastItem) / 1000;

    if (waitElapsed >= maxWait || idleElapsed >= idleTimeout) {
      await ctx.flushBatch(
        ctx.flow.id,
        waitElapsed >= maxWait ? 'MAX_WAIT_TIMEOUT' : 'IDLE_TIMEOUT',
      );
      return 'batchesFlushed';
    }
    return null;
  }
}

export class ProjectionFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.PROJECTION;

  constructor(private readonly reducerRegistry: ProjectionReducerRegistry = createDefaultProjectionReducerRegistry()) {
    super();
  }

  validateConfig(config: unknown): void {
    if (config == null) return;
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('PROJECTION config must be an object');
    }
  }

  async onEvent(
    ctx: FlowRuntimeContext,
    event: { eventType: string; source: string; payload: Record<string, unknown>; createdAt: Date },
  ): Promise<void> {
    const cfg = (ctx.flow.config ?? {}) as Record<string, any>;
    const prevState = (cfg.projectionState ?? {}) as Record<string, any>;
    const reducer = this.reducerRegistry.resolve(cfg, event.eventType);
    const updatedProjection = reducer.reduce(prevState, event.eventType, event.payload, cfg, event.createdAt);

    await ctx.updateConfig({ ...cfg, projectionState: updatedProjection });
    ctx.queueImpulse('PROJECTION_UPDATED', 'projection_updated', updatedProjection, {
      timestamp: event.createdAt.toISOString(),
    });
  }
}

export function createDefaultProjectionReducerRegistry(): ProjectionReducerRegistry {
  return new ProjectionReducerRegistry([new SpaceTowersProjectionReducer()]);
}

export function createDefaultFlowTypeHandlers(
  reducerRegistry: ProjectionReducerRegistry = createDefaultProjectionReducerRegistry(),
): FlowTypeHandler[] {
  return [
    new ContextFlowHandler(),
    new MutexFlowHandler(),
    new ObserverFlowHandler(),
    new FsmFlowHandler(),
    new TimerFlowHandler(),
    new CircuitBreakerFlowHandler(),
    new BatchFlowHandler(),
    new ProjectionFlowHandler(reducerRegistry),
  ];
}

export const DEFAULT_FLOW_TYPE_HANDLERS: FlowTypeHandler[] = createDefaultFlowTypeHandlers();
