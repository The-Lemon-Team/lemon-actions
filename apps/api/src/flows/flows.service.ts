import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Flow, FlowStatus, FlowType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  CreateFlowDto,
  CreateFlowEventDto,
  ListFlowsQueryDto,
  PushBatchItemsDto,
  TriggerFlowDto,
  UpdateFlowDto,
} from './flow.dto';
import { FlowsEventBusService, FlowImpulsePacket } from './flows-event-bus.service';
import { FlowView, FlowsRepository, toFlowView } from './flows.repository';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

const RUNNING: FlowStatus[] = [FlowStatus.ACTIVE, FlowStatus.PROCESSING];
const isRunning = (s: FlowStatus) => RUNNING.includes(s);

export interface ActivationGateCondition {
  flowId?: string;
  flowName?: string;
  type?: FlowType;
  expectedStatus?: FlowStatus;
  expectedState?: string;
  requirePendingItems?: boolean;
}

export interface ActivationGateRules {
  enabled?: boolean;
  strategy?: 'ALL' | 'ANY' | 'QUORUM';
  quorumCount?: number;
  conditions: ActivationGateCondition[];
}

export interface ScheduleWindowRule {
  days?: number[];
  start: string;
  end: string;
}

export interface FlowOrchestratorRules {
  onConflict?: 'reject' | 'pause' | 'queue';
  queue?: {
    maxSize?: number;
    dropStrategy?: 'drop_oldest' | 'reject';
  };
  leaseTimeoutSeconds?: number;
  schedule?: {
    enabled?: boolean;
    windows: ScheduleWindowRule[];
  };
  gate?: ActivationGateRules;
  pendingQueue?: Array<{ requestedAt: string; closedBy?: string }>;
}

@Injectable()
export class FlowsService {
  constructor(
    private readonly repo: FlowsRepository,
    private readonly registry: FlowTypeRegistry,
    @Optional() private readonly eventBus?: FlowsEventBusService,
  ) {}

  async list(q: ListFlowsQueryDto): Promise<FlowView[]> {
    return (await this.repo.findMany(q)).map(toFlowView);
  }

  async metrics(profileId?: string) {
    const c = await this.repo.countByStatus(profileId);
    return {
      registered: c.INACTIVE + c.ACTIVE + c.PAUSED + c.PROCESSING,
      executing: c.ACTIVE + c.PROCESSING,
      paused: c.PAUSED,
      standby: c.INACTIVE,
    };
  }

  async findOne(id: string): Promise<FlowView> {
    return toFlowView(await this.require(id));
  }

  async create(dto: CreateFlowDto): Promise<FlowView> {
    this.registry.get(dto.type).validateConfig(dto.config);
    const folderMeta = await this.assertFolder(dto.folderId);
    const resolvedProfileId = dto.profileId ?? folderMeta?.profileId ?? null;

    const flow = await this.repo.create(
      {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isExclusive: dto.isExclusive ?? false,
        folder: dto.folderId ? { connect: { id: dto.folderId } } : undefined,
        profile: resolvedProfileId ? { connect: { id: resolvedProfileId } } : undefined,
        config: this.json(dto.config),
        orchestratorRules: this.json(dto.orchestratorRules),
      },
      this.uniqueTags(dto.tags),
    );
    return toFlowView(flow);
  }

  async update(id: string, dto: UpdateFlowDto): Promise<FlowView> {
    const current = await this.require(id);
    const type = dto.type ?? current.type;
    this.registry.get(type).validateConfig(dto.config !== undefined ? dto.config : current.config);
    if (dto.folderId !== undefined) await this.assertFolder(dto.folderId);

    const data: Prisma.FlowUpdateInput = {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      isExclusive: dto.isExclusive,
      folder: dto.folderId === undefined ? undefined : dto.folderId ? { connect: { id: dto.folderId } } : { disconnect: true },
      config: dto.config === undefined ? undefined : this.json(dto.config),
      orchestratorRules: dto.orchestratorRules === undefined ? undefined : this.json(dto.orchestratorRules),
    };
    const tags = dto.tags ? this.uniqueTags(dto.tags) : undefined;
    const updated = await this.repo.update(id, data, tags);

    if (this.eventBus && dto.config !== undefined) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'CONTEXT_UPDATED',
        folderId: updated.folderId,
        flowId: updated.id,
        flowName: updated.name,
        flowType: updated.type,
        timestamp: new Date().toISOString(),
        payload: { config: dto.config },
      });
    }

    return toFlowView(updated);
  }

  async remove(id: string): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
  }

  async updateStatus(id: string, next: FlowStatus, closedBy = 'user'): Promise<FlowView> {
    return this.repo.transaction(async (tx) => {
      const flow = await this.repo.findById(id, tx);
      if (!flow) throw new NotFoundException(`Flow ${id} not found`);
      if (flow.status === next) return toFlowView(flow);

      // 1. Activation Gate (BARRIER): check conditions when starting to run
      if (isRunning(next) && !isRunning(flow.status)) {
        const siblingFlows = flow.folderId
          ? typeof (this.repo as any).findFlowsByFolder === 'function'
            ? await this.repo.findFlowsByFolder(flow.folderId, tx)
            : await this.repo.findMany({ folderId: flow.folderId })
          : [];
        const gateCheck = this.evaluateGateForFlow(flow, siblingFlows);
        if (!gateCheck.allowed) {
          throw new ConflictException(
            `Activation Gate blocked flow "${flow.name}": ${gateCheck.reasons.join('; ')}`,
          );
        }
      }

      // 2. Exclusivity & Queue Policy
      if (flow.isExclusive && isRunning(next) && !isRunning(flow.status)) {
        const conflicts = await this.repo.findRunningExclusive(flow.folderId, flow.id, tx);
        if (conflicts.length) {
          const rules = (flow.orchestratorRules ?? {}) as FlowOrchestratorRules;
          if (rules.onConflict === 'pause') {
            for (const other of conflicts) {
              await this.repo.setStatus(other.id, FlowStatus.PAUSED, tx);
              await this.repo.closeSessions(other.id, `flow:${flow.id}`, tx);
            }
          } else if (rules.onConflict === 'queue') {
            // Queue policy: do not throw, enqueue pending intent
            const pendingQueue = rules.pendingQueue ?? [];
            const maxSize = rules.queue?.maxSize ?? 20;
            if (pendingQueue.length >= maxSize && rules.queue?.dropStrategy === 'reject') {
              throw new ConflictException(`Queue is full for flow "${flow.name}" (max ${maxSize})`);
            }
            pendingQueue.push({ requestedAt: new Date().toISOString(), closedBy });
            await this.repo.update(
              flow.id,
              { orchestratorRules: this.json({ ...rules, pendingQueue }) },
              undefined,
              tx,
            );
            return toFlowView(flow);
          } else {
            throw new ConflictException(
              `Exclusive flow(s) already running: ${conflicts.map((c) => c.name).join(', ')}`,
            );
          }
        }
      }

      const updated = await this.repo.setStatus(id, next, tx);
      if (isRunning(next)) {
        if (!(await this.repo.hasOpenSession(id, tx))) await this.repo.openSession(id, tx);
      } else {
        await this.repo.closeSessions(id, closedBy, tx);

        // Check if any exclusive flow in this folder was queued and waiting for this release
        if (flow.folderId) {
          const siblings = typeof (this.repo as any).findFlowsByFolder === 'function'
            ? await this.repo.findFlowsByFolder(flow.folderId, tx)
            : await this.repo.findMany({ folderId: flow.folderId });
          const queued = siblings.find((s: any) => {
            const r = (s.orchestratorRules ?? {}) as FlowOrchestratorRules;
            return s.isExclusive && s.status === FlowStatus.INACTIVE && (r.pendingQueue?.length ?? 0) > 0;
          });

          if (queued) {
            const qRules = (queued.orchestratorRules ?? {}) as FlowOrchestratorRules;
            const queueItems = qRules.pendingQueue ? [...qRules.pendingQueue] : [];
            queueItems.shift(); // pop first pending intent
            await this.repo.update(
              queued.id,
              { orchestratorRules: this.json({ ...qRules, pendingQueue: queueItems }) },
              undefined,
              tx,
            );
            await this.repo.setStatus(queued.id, FlowStatus.ACTIVE, tx);
            await this.repo.openSession(queued.id, tx);
          }
        }
      }

      // 3. Emit impulse packet to Event Bus
      if (this.eventBus) {
        this.eventBus.emit({
          id: crypto.randomUUID(),
          type: 'MUTEX_STATUS',
          folderId: updated.folderId,
          flowId: updated.id,
          flowName: updated.name,
          flowType: updated.type,
          timestamp: new Date().toISOString(),
          payload: { previousStatus: flow.status, currentStatus: next, closedBy },
        });
      }

      return toFlowView(updated);
    });
  }

  async listSessions(id: string) {
    await this.require(id);
    return this.repo.listSessions(id);
  }

  async listEvents(id: string, sessionId?: string) {
    await this.require(id);
    return this.repo.listEvents(id, sessionId);
  }

  async appendEvent(id: string, dto: CreateFlowEventDto) {
    const flow = await this.require(id);
    return this.repo.transaction(async (tx) => {
      const openSessions = await this.repo.findOpenSessionsInFolder(flow.folderId, flow.id, tx);
      await this.repo.touchFlow(flow.id, tx);

      const event = await this.repo.createFlowEvent(
        {
          flowId: flow.id,
          source: dto.source ?? 'external',
          eventType: dto.eventType,
          payload: (dto.payload ?? {}) as Prisma.InputJsonObject,
          activeFlowSessionIds: openSessions.map((s) => s.id),
        },
        tx,
      );

      // Auto-supervise Circuit Breaker on incoming events (excluding internal state events)
      if (flow.type === FlowType.CIRCUIT_BREAKER && dto.eventType !== 'CIRCUIT_BREAKER_STATE') {
        const cfg = (flow.config ?? {}) as Record<string, any>;
        const currentState = cfg.state || 'CLOSED';
        const isError =
          dto.eventType.includes('FAIL') ||
          dto.eventType.includes('ERROR') ||
          (dto.payload as any)?.error !== undefined ||
          ((dto.payload as any)?.statusCode && (dto.payload as any).statusCode >= 400);

        if (isError) {
          const failCount = (cfg.failureCount || 0) + 1;
          const threshold = cfg.failureThreshold || 3;
          if (failCount >= threshold && currentState !== 'OPEN') {
            await this.updateCircuitBreaker(flow.id, 'OPEN', `Trip threshold reached (${failCount}/${threshold})`);
          } else {
            await this.repo.update(flow.id, { config: this.json({ ...cfg, failureCount: failCount }) }, undefined, tx);
          }
        } else if (currentState === 'HALF_OPEN') {
          const successCount = (cfg.successCount || 0) + 1;
          const successThreshold = cfg.successThreshold || 1;
          if (successCount >= successThreshold) {
            await this.updateCircuitBreaker(flow.id, 'CLOSED', 'Recovery confirmed');
          } else {
            await this.repo.update(flow.id, { config: this.json({ ...cfg, successCount }) }, undefined, tx);
          }
        }
      }

      // Auto-update Projection on incoming events
      if (flow.type === FlowType.PROJECTION) {
        const cfg = (flow.config ?? {}) as Record<string, any>;
        const projectionState = cfg.projectionState || {};
        const updatedProjection = {
          ...projectionState,
          lastEventType: dto.eventType,
          lastUpdatedAt: event.createdAt.toISOString(),
          eventsCount: (projectionState.eventsCount || 0) + 1,
          lastPayload: dto.payload,
        };
        await this.repo.update(
          flow.id,
          { config: this.json({ ...cfg, projectionState: updatedProjection }) },
          undefined,
          tx,
        );

        this.eventBus?.emit({
          id: crypto.randomUUID(),
          type: 'PROJECTION_UPDATED',
          folderId: flow.folderId,
          flowId: flow.id,
          flowName: flow.name,
          flowType: flow.type,
          timestamp: event.createdAt.toISOString(),
          payload: updatedProjection,
        });
      }

      if (this.eventBus) {
        this.eventBus.emit({
          id: event.id,
          type: 'CHRONICLE_EVENT',
          folderId: flow.folderId,
          flowId: flow.id,
          flowName: flow.name,
          flowType: flow.type,
          timestamp: event.createdAt.toISOString(),
          payload: (dto.payload ?? {}) as Record<string, unknown>,
          activeSessionIds: openSessions.map((s) => s.id),
        });
      }

      return event;
    });
  }

  // --- Manual Trigger & Impulses ---
  async trigger(id: string, dto?: TriggerFlowDto) {
    const flow = await this.require(id);
    await this.repo.touchFlow(flow.id);

    // If flow is BATCH and action is flush -> execute flush
    if (flow.type === FlowType.BATCH && dto?.action === 'flush') {
      return this.flushBatch(flow.id, 'MANUAL_TRIGGER');
    }

    const packet: FlowImpulsePacket = {
      id: crypto.randomUUID(),
      type: 'FLOW_TRIGGER',
      folderId: flow.folderId,
      flowId: flow.id,
      flowName: flow.name,
      flowType: flow.type,
      timestamp: new Date().toISOString(),
      payload: (dto?.payload ?? {}) as Record<string, unknown>,
    };

    this.eventBus?.emit(packet);
    return packet;
  }

  // --- Timer Operations ---
  async emitTimerTick(flowId: string, now = new Date()) {
    const flow = await this.require(flowId);
    const cfg = (flow.config ?? {}) as Record<string, any>;

    await this.repo.update(
      flow.id,
      { config: this.json({ ...cfg, lastTickAt: now.toISOString() }) },
      undefined,
    );

    const event = await this.appendEvent(flow.id, {
      eventType: 'TIMER_TICK',
      source: 'scheduler',
      payload: { intervalSeconds: cfg.intervalSeconds || 60, tickedAt: now.toISOString() },
    });

    const packet: FlowImpulsePacket = {
      id: crypto.randomUUID(),
      type: 'TIMER_TICK',
      folderId: flow.folderId,
      flowId: flow.id,
      flowName: flow.name,
      flowType: flow.type,
      timestamp: now.toISOString(),
      payload: { lastTickAt: now.toISOString() },
    };
    this.eventBus?.emit(packet);
    return event;
  }

  // --- Circuit Breaker Operations ---
  async updateCircuitBreaker(flowId: string, state: 'OPEN' | 'CLOSED' | 'HALF_OPEN', reason?: string) {
    const flow = await this.require(flowId);
    const cfg = (flow.config ?? {}) as Record<string, any>;

    const updatedConfig = {
      ...cfg,
      state,
      failureCount: state === 'CLOSED' ? 0 : cfg.failureCount,
      successCount: state === 'CLOSED' ? 0 : cfg.successCount,
      openedAt: state === 'OPEN' ? new Date().toISOString() : cfg.openedAt,
    };

    await this.repo.update(flow.id, { config: this.json(updatedConfig) }, undefined);

    await this.appendEvent(flow.id, {
      eventType: 'CIRCUIT_BREAKER_STATE',
      source: 'supervisor',
      payload: { state, reason, timestamp: new Date().toISOString() },
    });

    const packet: FlowImpulsePacket = {
      id: crypto.randomUUID(),
      type: 'CIRCUIT_BREAKER_STATE',
      folderId: flow.folderId,
      flowId: flow.id,
      flowName: flow.name,
      flowType: flow.type,
      timestamp: new Date().toISOString(),
      payload: { state, reason },
    };
    this.eventBus?.emit(packet);
    return packet;
  }

  // --- Batch Operations ---
  async pushBatch(flowId: string, dto: PushBatchItemsDto) {
    const flow = await this.require(flowId);
    const cfg = (flow.config ?? {}) as Record<string, any>;
    const now = new Date();

    let count = cfg.pendingCount || 0;
    const windowStart = cfg.windowStartedAt ? cfg.windowStartedAt : now.toISOString();

    for (const item of dto.items) {
      await this.repo.pushBufferItem(flow.id, item.payload as Prisma.InputJsonObject, item.dedupKey);
      count++;
    }

    const updatedConfig = {
      ...cfg,
      pendingCount: count,
      windowStartedAt: windowStart,
      lastItemAt: now.toISOString(),
    };

    await this.repo.update(flow.id, { config: this.json(updatedConfig) }, undefined);

    // Auto-flush if maxBatchSize reached
    const maxBatchSize = cfg.maxBatchSize || 10;
    if (count >= maxBatchSize) {
      return this.flushBatch(flow.id, 'SIZE_THRESHOLD');
    }

    return { enqueued: dto.items.length, pendingTotal: count };
  }

  async flushBatch(flowId: string, reason = 'MANUAL_TRIGGER') {
    const flow = await this.require(flowId);
    const items = await this.repo.flushBufferItems(flow.id);
    const cfg = (flow.config ?? {}) as Record<string, any>;
    const now = new Date();

    const batchId = crypto.randomUUID();
    const updatedConfig = {
      ...cfg,
      pendingCount: 0,
      windowStartedAt: null,
      lastFlushedAt: now.toISOString(),
    };

    await this.repo.update(flow.id, { config: this.json(updatedConfig) }, undefined);

    const payload = {
      batchId,
      flushReason: reason,
      itemsCount: items.length,
      items: items.map((i: any) => ({
        id: i.id,
        enqueuedAt: i.enqueuedAt ? i.enqueuedAt.toISOString() : now.toISOString(),
        payload: i.payload,
      })),
    };

    await this.appendEvent(flow.id, {
      eventType: 'BATCH_FLUSH',
      source: 'batch_flow',
      payload,
    });

    const packet: FlowImpulsePacket = {
      id: crypto.randomUUID(),
      type: 'BATCH_FLUSH',
      folderId: flow.folderId,
      flowId: flow.id,
      flowName: flow.name,
      flowType: flow.type,
      timestamp: now.toISOString(),
      payload,
    };
    this.eventBus?.emit(packet);

    return payload;
  }

  async listBatchItems(flowId: string) {
    await this.require(flowId);
    return this.repo.findPendingBufferItems(flowId);
  }

  // --- Activation Gate Evaluator ---
  evaluateGateForFlow(flow: Flow, siblingFlows: Flow[]): { allowed: boolean; reasons: string[] } {
    const rules = (flow.orchestratorRules ?? {}) as FlowOrchestratorRules;
    if (!rules.gate || rules.gate.enabled === false || !Array.isArray(rules.gate.conditions) || rules.gate.conditions.length === 0) {
      return { allowed: true, reasons: [] };
    }

    const results: { condition: ActivationGateCondition; satisfied: boolean; reason?: string }[] = [];

    for (const cond of rules.gate.conditions) {
      const target = siblingFlows.find(
        (f) =>
          (cond.flowId && f.id === cond.flowId) ||
          (cond.flowName && f.name.toLowerCase() === cond.flowName.toLowerCase()) ||
          (cond.type && f.type === cond.type),
      );

      if (!target) {
        results.push({ condition: cond, satisfied: false, reason: `Target flow not found in container` });
        continue;
      }

      if (cond.expectedStatus && target.status !== cond.expectedStatus) {
        results.push({
          condition: cond,
          satisfied: false,
          reason: `Flow "${target.name}" has status ${target.status}, expected ${cond.expectedStatus}`,
        });
        continue;
      }

      if (target.type === FlowType.CIRCUIT_BREAKER) {
        const cbState = (target.config as any)?.state || 'CLOSED';
        const expected = cond.expectedState || 'CLOSED';
        if (cbState !== expected) {
          results.push({
            condition: cond,
            satisfied: false,
            reason: `Circuit Breaker "${target.name}" is ${cbState}, expected ${expected}`,
          });
          continue;
        }
      }

      if (cond.requirePendingItems && target.type === FlowType.BATCH) {
        const pendingCount = (target.config as any)?.pendingCount ?? 0;
        if (pendingCount <= 0) {
          results.push({
            condition: cond,
            satisfied: false,
            reason: `Batch "${target.name}" has 0 pending items`,
          });
          continue;
        }
      }

      results.push({ condition: cond, satisfied: true });
    }

    const strategy = rules.gate.strategy || 'ALL';
    const satisfiedCount = results.filter((r) => r.satisfied).length;
    let allowed = false;

    if (strategy === 'ALL') {
      allowed = satisfiedCount === results.length;
    } else if (strategy === 'ANY') {
      allowed = satisfiedCount > 0;
    } else if (strategy === 'QUORUM') {
      const quorum = rules.gate.quorumCount ?? Math.ceil(results.length / 2);
      allowed = satisfiedCount >= quorum;
    }

    const reasons = results.filter((r) => !r.satisfied).map((r) => r.reason || 'Unsatisfied condition');
    return { allowed, reasons };
  }

  private async require(id: string) {
    const f = await this.repo.findById(id);
    if (!f) throw new NotFoundException(`Flow ${id} not found`);
    return f;
  }

  private async assertFolder(folderId?: string | null) {
    if (!folderId) return null;
    const meta = await this.repo.getFolderMeta(folderId);
    if (!meta) {
      throw new BadRequestException(`Folder ${folderId} does not exist`);
    }
    return meta;
  }

  private uniqueTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
  }

  private json(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
