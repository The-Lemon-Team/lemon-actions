import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Flow, FlowStatus, FlowType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { Observable, Subject } from 'rxjs';
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
import { FlowRuntimeContext } from './handlers/flow-type.handler';
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

const TOUCH_THROTTLE_MS = 5000;

@Injectable()
export class FlowsService {
  private readonly observerChangedSubject = new Subject<void>();
  private readonly lastTouchAt = new Map<string, number>();

  constructor(
    private readonly repo: FlowsRepository,
    private readonly registry: FlowTypeRegistry,
    @Optional() private readonly eventBus?: FlowsEventBusService,
  ) {}

  get observerChanged$(): Observable<void> {
    return this.observerChangedSubject.asObservable();
  }

  get typeRegistry(): FlowTypeRegistry {
    return this.registry;
  }

  private notifyObserverChanged(): void {
    this.observerChangedSubject.next();
  }

  private invalidatesObservers(type: FlowType): boolean {
    return Boolean(this.registry.get(type).invalidatesObserverCache);
  }

  async list(q: ListFlowsQueryDto): Promise<FlowView[]> {
    const profileId = q.profileId ? await this.resolveProfileId(q.profileId) : undefined;
    return (await this.repo.findMany({ ...q, profileId: profileId ?? undefined })).map(toFlowView);
  }

  async metrics(profileId?: string) {
    const resolved = profileId ? await this.resolveProfileId(profileId) : undefined;
    const c = await this.repo.countByStatus(resolved ?? undefined);
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
    const rawProfileId = dto.profileId ?? folderMeta?.profileId ?? null;
    const resolvedProfileId = await this.resolveProfileId(rawProfileId);

    const resolvedProjectSlug = this.normalizeProjectSlug(
      dto.projectSlug ??
        (dto.config as any)?.projectSlug ??
        this.inferProjectSlugFromFolderPath(folderMeta?.path) ??
        null,
    );

    const flow = await this.repo.create(
      {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isExclusive: dto.isExclusive ?? false,
        ...(resolvedProjectSlug !== undefined ? { projectSlug: resolvedProjectSlug } : {}),
        folder: dto.folderId ? { connect: { id: dto.folderId } } : undefined,
        profile: resolvedProfileId ? { connect: { id: resolvedProfileId } } : undefined,
        config: this.json(dto.config),
        orchestratorRules: this.json(dto.orchestratorRules),
      },
      this.uniqueTags(dto.tags),
    );
    if (this.invalidatesObservers(flow.type)) {
      this.notifyObserverChanged();
    }
    return toFlowView(flow);
  }

  async update(id: string, dto: UpdateFlowDto): Promise<FlowView> {
    const current = await this.require(id);
    const type = dto.type ?? current.type;
    this.registry.get(type).validateConfig(dto.config !== undefined ? dto.config : current.config);
    if (dto.folderId !== undefined) await this.assertFolder(dto.folderId);

    const nextProjectSlug =
      dto.projectSlug !== undefined ? this.normalizeProjectSlug(dto.projectSlug) : undefined;

    const data: Prisma.FlowUpdateInput = {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      isExclusive: dto.isExclusive,
      ...(nextProjectSlug !== undefined ? { projectSlug: nextProjectSlug } : {}),
      folder: dto.folderId === undefined ? undefined : dto.folderId ? { connect: { id: dto.folderId } } : { disconnect: true },
      config: dto.config === undefined ? undefined : this.json(dto.config),
      orchestratorRules: dto.orchestratorRules === undefined ? undefined : this.json(dto.orchestratorRules),
    };
    const tags = dto.tags ? this.uniqueTags(dto.tags) : undefined;
    const updated = await this.repo.update(id, data, tags);

    if (this.invalidatesObservers(current.type) || this.invalidatesObservers(updated.type)) {
      this.notifyObserverChanged();
    }

    if (dto.config !== undefined) {
      this.emitImpulse(updated, 'CONTEXT_UPDATED', 'context_updated', { config: dto.config });
    }

    return toFlowView(updated);
  }

  async remove(id: string): Promise<void> {
    const current = await this.require(id);
    await this.repo.delete(id);
    this.lastTouchAt.delete(id);
    if (this.invalidatesObservers(current.type)) {
      this.notifyObserverChanged();
    }
  }

  async updateStatus(id: string, next: FlowStatus, closedBy = 'user'): Promise<FlowView> {
    const pendingImpulses: Array<() => FlowImpulsePacket> = [];
    let shouldInvalidateObservers = false;

    const result = await this.repo.transaction(async (tx) => {
      let flow = await this.repo.findById(id, tx);
      if (!flow) throw new NotFoundException(`Flow ${id} not found`);
      if (flow.status === next) return toFlowView(flow);

      // Serialize exclusive transitions and queue promotions within the folder scope
      if (
        (flow.isExclusive || (!isRunning(next) && flow.folderId !== null)) &&
        typeof (this.repo as any).acquireExclusiveScopeLock === 'function'
      ) {
        await (this.repo as any).acquireExclusiveScopeLock(flow.folderId, tx);
        flow = await this.repo.findById(id, tx);
        if (!flow) throw new NotFoundException(`Flow ${id} not found`);
        if (flow.status === next) return toFlowView(flow);
      }

      if (this.invalidatesObservers(flow.type)) {
        shouldInvalidateObservers = true;
      }

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
              const pausedOther = await this.repo.setStatus(other.id, FlowStatus.PAUSED, tx);
              await this.repo.closeSessions(other.id, `flow:${flow.id}`, tx);
              pendingImpulses.push(() =>
                this.emitImpulse(pausedOther, 'MUTEX_STATUS', 'status_changed', {
                  previousStatus: other.status,
                  currentStatus: FlowStatus.PAUSED,
                  closedBy: `flow:${flow.id}`,
                }),
              );
            }
          } else if (rules.onConflict === 'queue') {
            // Queue policy: do not throw, enqueue pending intent
            const pendingQueue = Array.isArray(rules.pendingQueue) ? [...rules.pendingQueue] : [];
            const maxSize = rules.queue?.maxSize ?? 20;
            if (pendingQueue.length >= maxSize && rules.queue?.dropStrategy === 'reject') {
              throw new ConflictException(`Queue is full for flow "${flow.name}" (max ${maxSize})`);
            }
            if (pendingQueue.length >= maxSize && rules.queue?.dropStrategy === 'drop_oldest') {
              pendingQueue.shift();
            }
            pendingQueue.push({ requestedAt: new Date().toISOString(), closedBy });
            await this.updateFlowLite(
              flow.id,
              { orchestratorRules: this.json({ ...rules, pendingQueue }) },
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
            await this.updateFlowLite(
              queued.id,
              { orchestratorRules: this.json({ ...qRules, pendingQueue: queueItems }) },
              tx,
            );
            const promoted = await this.repo.setStatus(queued.id, FlowStatus.ACTIVE, tx);
            await this.repo.openSession(queued.id, tx);
            pendingImpulses.push(() =>
              this.emitImpulse(promoted, 'MUTEX_STATUS', 'status_changed', {
                previousStatus: FlowStatus.INACTIVE,
                currentStatus: FlowStatus.ACTIVE,
                closedBy: 'queue:promoted',
              }),
            );
          }
        }
      }

      // 3. Defer impulse emission until transaction commits
      pendingImpulses.push(() =>
        this.emitImpulse(updated, 'MUTEX_STATUS', 'status_changed', {
          previousStatus: flow.status,
          currentStatus: next,
          closedBy,
        }),
      );

      return toFlowView(updated);
    });

    this.lastTouchAt.delete(id);
    for (const emit of pendingImpulses) {
      emit();
    }
    if (shouldInvalidateObservers) {
      this.notifyObserverChanged();
    }
    return result;
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
    const pendingImpulses: Array<() => FlowImpulsePacket> = [];

    const event = await this.repo.transaction(async (tx) => {
      const flow = await this.findFlowLite(id, tx);
      if (!flow) throw new NotFoundException(`Flow ${id} not found`);

      const openSessions = await this.repo.findOpenSessionsInFolder(flow.folderId, flow.id, tx);
      if (this.shouldTouchFlow(flow)) {
        await this.repo.touchFlow(flow.id, tx);
      }

      const createdEvent = await this.repo.createFlowEvent(
        {
          flowId: flow.id,
          source: dto.source ?? 'external',
          eventType: dto.eventType,
          payload: (dto.payload ?? {}) as Prisma.InputJsonObject,
          activeFlowSessionIds: openSessions.map((s) => s.id),
        },
        tx,
      );

      const handler = this.registry.get(flow.type);
      if (handler.onEvent) {
        const openSessionIds = openSessions.map((s) => s.id);
        const runtimeCtx: FlowRuntimeContext = {
          flow,
          openSessionIds,
          updateConfig: async (nextConfig: unknown) => {
            await this.updateFlowLite(flow.id, { config: this.json(nextConfig) }, tx);
            (flow as any).config = nextConfig;
          },
          appendInternalEvent: async (eventType, source, payload) => {
            const internalEv = await this.repo.createFlowEvent(
              {
                flowId: flow.id,
                source,
                eventType,
                payload: payload as Prisma.InputJsonObject,
                activeFlowSessionIds: openSessionIds,
              },
              tx,
            );
            pendingImpulses.push(() =>
              this.emitImpulse(flow, 'CHRONICLE_EVENT', eventType.toLowerCase(), payload, {
                id: internalEv.id,
                timestamp: internalEv.createdAt.toISOString(),
                activeSessionIds: openSessionIds,
              }),
            );
          },
          queueImpulse: (type, eventSlug, payload, extra) => {
            pendingImpulses.push(() => this.emitImpulse(flow, type, eventSlug, payload, extra));
          },
        };

        await handler.onEvent(runtimeCtx, {
          eventType: dto.eventType,
          source: dto.source ?? 'external',
          payload: (dto.payload ?? {}) as Record<string, unknown>,
          createdAt: createdEvent.createdAt,
        });
      }

      pendingImpulses.push(() =>
        this.emitImpulse(
          flow,
          'CHRONICLE_EVENT',
          dto.eventType.toLowerCase(),
          (dto.payload ?? {}) as Record<string, unknown>,
          {
            id: createdEvent.id,
            timestamp: createdEvent.createdAt.toISOString(),
            activeSessionIds: openSessions.map((s) => s.id),
          },
        ),
      );

      return createdEvent;
    });

    for (const emit of pendingImpulses) {
      emit();
    }
    return event;
  }

  // --- Manual Trigger & Impulses ---
  async trigger(id: string, dto?: TriggerFlowDto) {
    const flow = await this.requireLite(id);
    const handler = this.registry.get(flow.type);

    if (handler.onTrigger) {
      const handled = await handler.onTrigger(
        flow.id,
        dto?.action,
        (dto?.payload ?? {}) as Record<string, unknown>,
        {
          flushBatch: (targetId, reason) => this.flushBatch(targetId, reason),
        },
      );
      if (handled !== undefined) {
        return handled;
      }
    }

    if (this.shouldTouchFlow(flow, dto?.action !== 'heartbeat')) {
      await this.repo.touchFlow(flow.id);
    }

    return this.emitImpulse(
      flow,
      'FLOW_TRIGGER',
      dto?.action ? `trigger_${dto.action}` : 'triggered',
      (dto?.payload ?? {}) as Record<string, unknown>,
    );
  }

  // --- Timer Operations ---
  async emitTimerTick(flowId: string, now = new Date()) {
    const flow = await this.requireLite(flowId);
    const cfg = (flow.config ?? {}) as Record<string, any>;

    await this.updateFlowLite(
      flow.id,
      { config: this.json({ ...cfg, lastTickAt: now.toISOString() }) },
    );

    const event = await this.appendEvent(flow.id, {
      eventType: 'TIMER_TICK',
      source: 'scheduler',
      payload: { intervalSeconds: cfg.intervalSeconds || 60, tickedAt: now.toISOString() },
    });

    this.emitImpulse(flow, 'TIMER_TICK', 'timer_tick', { lastTickAt: now.toISOString() }, {
      timestamp: now.toISOString(),
    });
    return event;
  }

  // --- Circuit Breaker Operations ---
  async updateCircuitBreaker(flowId: string, state: 'OPEN' | 'CLOSED' | 'HALF_OPEN', reason?: string) {
    const pendingImpulses: Array<() => FlowImpulsePacket> = [];
    await this.repo.transaction(async (tx) => {
      const flow = await this.findFlowLite(flowId, tx);
      if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);
      await this.applyCircuitBreakerTransitionInTx(flow, state, reason, tx, pendingImpulses);
    });

    let lastPacket: FlowImpulsePacket | undefined;
    for (const emit of pendingImpulses) {
      lastPacket = emit();
    }
    return lastPacket!;
  }

  // --- Batch Operations ---
  async pushBatch(flowId: string, dto: PushBatchItemsDto) {
    const batchOutcome = await this.repo.transaction(async (tx) => {
      const flow = await this.findFlowLite(flowId, tx);
      if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);

      const cfg = (flow.config ?? {}) as Record<string, any>;
      const now = new Date();
      const windowStart = cfg.windowStartedAt ? cfg.windowStartedAt : now.toISOString();

      let pendingTotal = cfg.pendingCount || 0;
      if (typeof (this.repo as any).pushBufferItemsBatch === 'function') {
        const res = await (this.repo as any).pushBufferItemsBatch(
          flow.id,
          dto.items.map((item) => ({
            payload: item.payload as Prisma.InputJsonObject,
            dedupKey: item.dedupKey,
          })),
          tx,
        );
        pendingTotal = res.pendingTotal;
      } else {
        for (const item of dto.items) {
          await this.repo.pushBufferItem(flow.id, item.payload as Prisma.InputJsonObject, item.dedupKey, tx);
          pendingTotal++;
        }
      }

      const updatedConfig = {
        ...cfg,
        pendingCount: pendingTotal,
        windowStartedAt: windowStart,
        lastItemAt: now.toISOString(),
      };

      await this.updateFlowLite(flow.id, { config: this.json(updatedConfig) }, tx);

      const maxBatchSize = cfg.maxBatchSize || 10;
      return {
        shouldFlush: pendingTotal >= maxBatchSize,
        pendingTotal,
      };
    });

    if (batchOutcome.shouldFlush) {
      return this.flushBatch(flowId, 'SIZE_THRESHOLD');
    }

    return { enqueued: dto.items.length, pendingTotal: batchOutcome.pendingTotal };
  }

  async flushBatch(flowId: string, reason = 'MANUAL_TRIGGER') {
    const pendingImpulses: Array<() => FlowImpulsePacket> = [];

    const payload = await this.repo.transaction(async (tx) => {
      const flow = await this.findFlowLite(flowId, tx);
      if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);

      const items = await this.repo.flushBufferItems(flow.id, tx);
      const cfg = (flow.config ?? {}) as Record<string, any>;
      const now = new Date();

      const batchId = crypto.randomUUID();
      const updatedConfig = {
        ...cfg,
        pendingCount: 0,
        windowStartedAt: null,
        lastFlushedAt: now.toISOString(),
      };

      await this.updateFlowLite(flow.id, { config: this.json(updatedConfig) }, tx);

      const batchPayload = {
        batchId,
        flushReason: reason,
        itemsCount: items.length,
        items: items.map((i: any) => ({
          id: i.id,
          enqueuedAt: i.enqueuedAt ? i.enqueuedAt.toISOString() : now.toISOString(),
          payload: i.payload,
        })),
      };

      const openSessions = await this.repo.findOpenSessionsInFolder(flow.folderId, flow.id, tx);
      const createdEvent = await this.repo.createFlowEvent(
        {
          flowId: flow.id,
          source: 'batch_flow',
          eventType: 'BATCH_FLUSH',
          payload: batchPayload as Prisma.InputJsonObject,
          activeFlowSessionIds: openSessions.map((s) => s.id),
        },
        tx,
      );

      pendingImpulses.push(() =>
        this.emitImpulse(flow, 'CHRONICLE_EVENT', 'batch_flush', batchPayload, {
          id: createdEvent.id,
          timestamp: createdEvent.createdAt.toISOString(),
          activeSessionIds: openSessions.map((s) => s.id),
        }),
      );
      pendingImpulses.push(() =>
        this.emitImpulse(flow, 'BATCH_FLUSH', 'batch_flushed', batchPayload, {
          timestamp: now.toISOString(),
        }),
      );

      return batchPayload;
    });

    for (const emit of pendingImpulses) {
      emit();
    }

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

      const targetHandler = this.registry.get(target.type);
      if (targetHandler.evaluateGateCondition) {
        const failureReason = targetHandler.evaluateGateCondition(target, cond);
        if (failureReason) {
          results.push({
            condition: cond,
            satisfied: false,
            reason: failureReason,
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

  async queryTaskPool(
    flowId: string,
    filter: { actorId?: string; status?: string; tower?: string } = {},
  ) {
    const flow = await this.require(flowId);
    const state = ((flow.config as Record<string, any>)?.projectionState ?? {}) as Record<string, any>;
    const emitterTasks = Array.isArray(state.emitterTasks) ? state.emitterTasks : [];
    const ownLots = Array.isArray(state.ownLots) ? state.ownLots : [];
    const allTasks: Array<Record<string, any>> = [...emitterTasks, ...ownLots];

    const items = allTasks.filter((t) => {
      if (filter.status && t.status !== filter.status) return false;
      if (filter.tower && t.claimedByTower !== filter.tower) return false;
      if (filter.actorId) {
        const isPrimary = t.assigneeActorId === filter.actorId;
        const isParticipant = Array.isArray(t.assignedParticipants) && t.assignedParticipants.includes(filter.actorId);
        if (!isPrimary && !isParticipant) return false;
      }
      return true;
    });

    const byStatus: Record<string, number> = {};
    for (const t of allTasks) {
      const s = String(t.status || 'OPEN');
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    return {
      flowId: flow.id,
      total: allTasks.length,
      filteredCount: items.length,
      byStatus,
      items: items.map((t): Record<string, any> => {
        const steps = Array.isArray(t.steps) ? t.steps : [];
        return {
          ...t,
          stepsTotal: steps.length,
          stepsDone: steps.filter((s: any) => s.status === 'DONE').length,
        };
      }),
    };
  }

  private async resolveProfileId(profileId?: string | null): Promise<string | null> {
    if (!profileId) return null;
    if (typeof (this.repo as any).resolveProfileId === 'function') {
      return (this.repo as any).resolveProfileId(profileId);
    }
    return profileId;
  }

  private async require(id: string) {
    const f = await this.repo.findById(id);
    if (!f) throw new NotFoundException(`Flow ${id} not found`);
    return f;
  }

  private async findFlowLite(id: string, tx?: Prisma.TransactionClient) {
    if (typeof (this.repo as any).findByIdLite === 'function') {
      return (this.repo as any).findByIdLite(id, tx);
    }
    return this.repo.findById(id, tx);
  }

  private async requireLite(id: string, tx?: Prisma.TransactionClient) {
    const f = await this.findFlowLite(id, tx);
    if (!f) throw new NotFoundException(`Flow ${id} not found`);
    return f;
  }

  private updateFlowLite(id: string, data: Prisma.FlowUpdateInput, tx?: Prisma.TransactionClient) {
    if (typeof (this.repo as any).updateLite === 'function') {
      return (this.repo as any).updateLite(id, data, tx);
    }
    return this.repo.update(id, data, undefined, tx);
  }

  private shouldTouchFlow(flow: { id: string; orchestratorRules?: unknown }, force = false): boolean {
    if (force) {
      this.lastTouchAt.set(flow.id, Date.now());
      return true;
    }
    const rules = (flow.orchestratorRules ?? {}) as FlowOrchestratorRules;
    const leaseSec = rules.leaseTimeoutSeconds;
    const throttleMs = leaseSec && leaseSec > 0 ? Math.min(TOUCH_THROTTLE_MS, Math.max(500, (leaseSec * 1000) / 3)) : TOUCH_THROTTLE_MS;
    const now = Date.now();
    const prev = this.lastTouchAt.get(flow.id) ?? 0;
    if (now - prev >= throttleMs) {
      this.lastTouchAt.set(flow.id, now);
      return true;
    }
    return false;
  }

  private async applyCircuitBreakerTransitionInTx(
    flow: { id: string; name: string; type: FlowType; folderId: string | null; projectSlug?: string | null; config?: unknown },
    state: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
    reason: string | undefined,
    tx: Prisma.TransactionClient,
    pendingImpulses: Array<() => FlowImpulsePacket>,
  ): Promise<void> {
    const cfg = (flow.config ?? {}) as Record<string, any>;
    const nowIso = new Date().toISOString();
    const updatedConfig = {
      ...cfg,
      state,
      failureCount: state === 'CLOSED' ? 0 : cfg.failureCount,
      successCount: state === 'CLOSED' ? 0 : cfg.successCount,
      openedAt: state === 'OPEN' ? nowIso : cfg.openedAt,
    };

    await this.updateFlowLite(flow.id, { config: this.json(updatedConfig) }, tx);

    const openSessions = await this.repo.findOpenSessionsInFolder(flow.folderId, flow.id, tx);
    const createdEvent = await this.repo.createFlowEvent(
      {
        flowId: flow.id,
        source: 'supervisor',
        eventType: 'CIRCUIT_BREAKER_STATE',
        payload: { state, reason, timestamp: nowIso } as Prisma.InputJsonObject,
        activeFlowSessionIds: openSessions.map((s) => s.id),
      },
      tx,
    );

    pendingImpulses.push(() =>
      this.emitImpulse(
        flow,
        'CHRONICLE_EVENT',
        'circuit_breaker_state',
        { state, reason, timestamp: nowIso },
        {
          id: createdEvent.id,
          timestamp: createdEvent.createdAt.toISOString(),
          activeSessionIds: openSessions.map((s) => s.id),
        },
      ),
    );
    pendingImpulses.push(() =>
      this.emitImpulse(flow, 'CIRCUIT_BREAKER_STATE', 'circuit_breaker', { state, reason }),
    );
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

  private inferProjectSlugFromFolderPath(folderPath?: string | null): string | null {
    if (!folderPath) return null;
    const root = folderPath.trim().toLowerCase().split('.')[0];
    switch (root) {
      case 'space':
        return 'lemon-space';
      case 'arena':
        return 'lemon-universe';
      case 'code':
        return 'lemon-code';
      case 'home':
        return 'home';
      case 'seasons':
        return 'lemon-seasons';
      case 'watchers':
        return 'lemon-watchers';
      case 'media_hub':
        return 'lemon-media-hub';
      case 'ai_neurons':
        return 'lemon-ai';
      case 'workspace':
      case 'focus_modes':
      case 'event_hooks':
      case 'infrastructure':
      case 'archival':
        return 'lemon-core';
      default:
        return null;
    }
  }

  private normalizeProjectSlug(raw?: string | null): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || null;
  }

  private resolveFlowProjectSlug(flow: { projectSlug?: string | null; config?: unknown }): string {
    if (flow.projectSlug) return flow.projectSlug;
    const cfg = (flow.config ?? {}) as Record<string, any>;
    if (typeof cfg.projectSlug === 'string' && cfg.projectSlug.trim()) {
      return this.normalizeProjectSlug(cfg.projectSlug) ?? 'lemon-core';
    }
    return 'lemon-core';
  }

  private emitImpulse(
    flow: { id: string; name: string; type: FlowType; folderId: string | null; projectSlug?: string | null; config?: unknown },
    type: FlowImpulsePacket['type'],
    eventSlug: string,
    payload: Record<string, unknown>,
    extra: Partial<Pick<FlowImpulsePacket, 'id' | 'timestamp' | 'activeSessionIds'>> = {},
  ): FlowImpulsePacket {
    const projectSlug = this.resolveFlowProjectSlug(flow);
    const safeEvent = eventSlug.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_') || 'event';
    const packet: FlowImpulsePacket = {
      id: extra.id ?? crypto.randomUUID(),
      type,
      folderId: flow.folderId,
      projectSlug,
      topic: `lemon.${projectSlug}.flow.${safeEvent}`,
      flowId: flow.id,
      flowName: flow.name,
      flowType: flow.type,
      timestamp: extra.timestamp ?? new Date().toISOString(),
      payload,
      ...(extra.activeSessionIds ? { activeSessionIds: extra.activeSessionIds } : {}),
    };
    this.eventBus?.emit(packet);
    return packet;
  }

  private json(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
