import { ProjectionReducer } from '../handlers/projection-reducer.registry';

const SPACE_TOWER_EVENTS = new Set([
  'DEPOSIT',
  'REWARD_MINTED',
  'LEDGER_CREDIT',
  'WITHDRAW',
  'LEDGER_DEBIT',
  'RESOURCE_PRODUCED',
  'RESTOCKED',
  'COUNTER_INCREMENT',
  'PARTICIPANT_JOINED',
  'PARTICIPANT_LEFT',
  'TASK_ISSUED',
  'TASK_CLAIMED_BY_TOWER',
  'TASK_STEP_UPDATED',
  'TASK_COMPLETED',
  'OWN_LOT_PUBLISHED',
]);

/**
 * Domain projection reducer for Space Towers & Main Emitter (balances, resources, participants, tasks).
 * Extracted from FlowsService so project-specific projections remain pluggable per shard.
 */
export class SpaceTowersProjectionReducer implements ProjectionReducer {
  readonly key = 'space-towers';
  readonly aliases = ['WALLET_AND_TASKS', 'TOWER_VAULT_AND_PARTICIPANTS'];

  matchesConfig(config: Record<string, any>, eventType: string): boolean {
    if (
      config.cardRole === 'EMITTER_MINT_AND_REGISTRY' ||
      config.cardRole === 'TOWER_VAULT_AND_PARTICIPANTS' ||
      config.towerElement !== undefined ||
      config.issuerId === 'genesis-emitter'
    ) {
      return true;
    }
    return SPACE_TOWER_EVENTS.has(eventType);
  }

  reduce(
    prev: Record<string, any>,
    eventType: string,
    payload: Record<string, any>,
    cfg: Record<string, any>,
    at: Date,
  ): Record<string, any> {
    const isoAt = at.toISOString();
    const balances: Record<string, number> = { ...(prev.balances ?? {}) };
    const resources: Record<string, any> = { ...(prev.resources ?? {}) };
    const participants: Array<Record<string, any>> = Array.isArray(prev.participants) ? [...prev.participants] : [];
    const emitterTasks: Array<Record<string, any>> = Array.isArray(prev.emitterTasks) ? [...prev.emitterTasks] : [];
    const ownLots: Array<Record<string, any>> = Array.isArray(prev.ownLots) ? [...prev.ownLots] : [];

    switch (eventType) {
      case 'DEPOSIT':
      case 'REWARD_MINTED':
      case 'LEDGER_CREDIT':
        this.applyBalanceDelta(balances, payload, 1, Boolean(cfg.allowNegative));
        break;
      case 'WITHDRAW':
      case 'LEDGER_DEBIT':
        this.applyBalanceDelta(balances, payload, -1, Boolean(cfg.allowNegative));
        break;
      case 'RESOURCE_PRODUCED':
      case 'RESTOCKED':
      case 'COUNTER_INCREMENT':
        this.applyResourceDelta(resources, cfg, payload, isoAt);
        break;
      case 'PARTICIPANT_JOINED':
        this.upsertParticipant(participants, cfg, payload, isoAt);
        break;
      case 'PARTICIPANT_LEFT': {
        const actorId = String(payload.actorId || '').trim();
        const idx = actorId ? participants.findIndex((p) => p.actorId === actorId) : -1;
        if (idx >= 0) participants.splice(idx, 1);
        break;
      }
      case 'TASK_ISSUED':
      case 'TASK_CLAIMED_BY_TOWER':
      case 'TASK_STEP_UPDATED':
      case 'TASK_COMPLETED':
        this.reduceEmitterTask(emitterTasks, balances, cfg, eventType, payload, isoAt);
        break;
      case 'OWN_LOT_PUBLISHED': {
        const canPublish = this.hasStarterCapital(prev, balances);
        if (canPublish) {
          ownLots.push({
            lotId: String(payload.lotId || `lot-${Date.now()}`),
            title: payload.title || 'Tower Lot',
            reward: Number(payload.reward ?? 0),
            currency: String(payload.currency || 'ancient_point'),
            kind: payload.kind || 'ORDER',
            status: 'OPEN',
            publishedAt: isoAt,
          });
        }
        break;
      }
    }

    const canPublishOwnLots = this.hasStarterCapital(prev, balances);

    return {
      ...prev,
      balances,
      resources,
      participants,
      emitterTasks,
      ownLots,
      canPublishOwnLots,
      lastEventType: eventType,
      lastUpdatedAt: isoAt,
      eventsCount: (prev.eventsCount || 0) + 1,
      lastPayload: payload,
    };
  }

  private hasStarterCapital(prev: Record<string, any>, balances: Record<string, number>): boolean {
    return (
      Boolean(prev.canPublishOwnLots) ||
      (balances['ancient_point'] ?? 0) > 0 ||
      (balances['golden_ancient_point'] ?? 0) > 0 ||
      (balances['fire_point'] ?? 0) > 0
    );
  }

  private applyBalanceDelta(
    balances: Record<string, number>,
    payload: Record<string, any>,
    sign: 1 | -1,
    allowNegative: boolean,
  ): void {
    const currency = String(payload.currency || 'ancient_point');
    const amount = Number(payload.amount ?? payload.delta ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const nextVal = (balances[currency] ?? 0) + sign * amount;
    balances[currency] = sign < 0 && !allowNegative ? Math.max(0, nextVal) : nextVal;
  }

  private applyResourceDelta(
    resources: Record<string, any>,
    cfg: Record<string, any>,
    payload: Record<string, any>,
    isoAt: string,
  ): void {
    const key = String(payload.resource || cfg.defaultResource || 'default');
    const delta = Number(payload.delta ?? payload.amount ?? payload.currentQty ?? 1);
    if (!Number.isFinite(delta)) return;
    const existing = resources[key] ?? { code: key, current: 0, maxCapacity: cfg.maxCapacity ?? null };
    const unclamped = (existing.current ?? 0) + delta;
    const current =
      typeof existing.maxCapacity === 'number'
        ? Math.min(existing.maxCapacity, Math.max(0, unclamped))
        : Math.max(0, unclamped);
    resources[key] = { ...existing, current, updatedAt: isoAt };
  }

  private upsertParticipant(
    participants: Array<Record<string, any>>,
    cfg: Record<string, any>,
    payload: Record<string, any>,
    isoAt: string,
  ): void {
    const actorId = String(payload.actorId || '').trim();
    if (!actorId) return;
    const idx = participants.findIndex((p) => p.actorId === actorId);
    const entry = {
      actorId,
      actorName: payload.actorName || actorId,
      role: payload.role || 'MEMBER',
      element: payload.element || cfg.towerElement || null,
      source: payload.source || 'EMITTER_QUEST',
      joinedAt: idx >= 0 ? participants[idx].joinedAt : isoAt,
      updatedAt: isoAt,
    };
    if (idx >= 0) {
      participants[idx] = entry;
    } else {
      participants.push(entry);
    }
  }

  private normalizeTaskSteps(rawSteps: unknown): Array<Record<string, any>> {
    if (!Array.isArray(rawSteps)) return [];
    return rawSteps.map((s: any, idx: number) => ({
      stepId: String(s?.stepId || `step-${idx + 1}`),
      title: String(s?.title || `Step ${idx + 1}`),
      status: s?.status === 'DONE' || s?.status === 'IN_PROGRESS' ? s.status : 'PENDING',
      assigneeActorId: s?.assigneeActorId || null,
      completedAt: s?.completedAt || null,
    }));
  }

  private reduceEmitterTask(
    emitterTasks: Array<Record<string, any>>,
    balances: Record<string, number>,
    cfg: Record<string, any>,
    eventType: string,
    payload: Record<string, any>,
    isoAt: string,
  ): void {
    const taskId = String(payload.taskId || (eventType === 'TASK_ISSUED' ? `task-${Date.now()}` : ''));
    if (!taskId) return;
    const idx = emitterTasks.findIndex((t) => t.taskId === taskId);

    if (eventType === 'TASK_ISSUED') {
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      const record = {
        taskId,
        title: payload.title || taskId,
        issuer: 'genesis-emitter',
        retainedByEmitter: true,
        reward: Number(payload.reward ?? 0),
        currency: String(payload.currency || 'ancient_point'),
        rewards: Array.isArray(payload.rewards) ? payload.rewards : undefined,
        status: payload.status || 'OPEN',
        claimedByTower: payload.claimedByTower || null,
        assigneeActorId: String(payload.assigneeActorId || participants[0] || 'actor-master-ai'),
        assignedParticipants: participants,
        steps: this.normalizeTaskSteps(payload.steps),
        issuedAt: idx >= 0 ? emitterTasks[idx].issuedAt : isoAt,
        updatedAt: isoAt,
      };
      if (idx >= 0) {
        emitterTasks[idx] = { ...emitterTasks[idx], ...record };
      } else {
        emitterTasks.push(record);
      }
      return;
    }

    if (idx < 0) return;
    const current = emitterTasks[idx];

    if (eventType === 'TASK_CLAIMED_BY_TOWER') {
      const nextParticipants = Array.isArray(payload.participants)
        ? [...new Set([...(current.assignedParticipants ?? []), ...payload.participants])]
        : current.assignedParticipants;
      emitterTasks[idx] = {
        ...current,
        status: 'IN_PROGRESS',
        claimedByTower: payload.claimedByTower || current.claimedByTower,
        assigneeActorId: payload.assigneeActorId || payload.participants?.[0] || current.assigneeActorId,
        assignedParticipants: nextParticipants,
        steps: Array.isArray(payload.steps) ? this.normalizeTaskSteps(payload.steps) : current.steps,
        updatedAt: isoAt,
      };
      return;
    }

    if (eventType === 'TASK_STEP_UPDATED') {
      const stepId = String(payload.stepId || '');
      const steps = Array.isArray(current.steps) ? [...current.steps] : [];
      const sIdx = steps.findIndex((s: any) => s.stepId === stepId);
      if (sIdx >= 0) {
        const nextStepStatus = payload.status === 'DONE' || payload.status === 'IN_PROGRESS' ? payload.status : 'PENDING';
        steps[sIdx] = {
          ...steps[sIdx],
          status: nextStepStatus,
          assigneeActorId: payload.assigneeActorId || steps[sIdx].assigneeActorId,
          completedAt: nextStepStatus === 'DONE' ? isoAt : null,
        };
      }
      const nextStatus =
        current.status === 'OPEN' && steps.some((s: any) => s.status !== 'PENDING')
          ? 'IN_PROGRESS'
          : current.status;
      emitterTasks[idx] = {
        ...current,
        status: nextStatus,
        steps,
        updatedAt: isoAt,
      };
      return;
    }

    if (eventType === 'TASK_COMPLETED') {
      const steps = Array.isArray(current.steps)
        ? current.steps.map((s: any) =>
            payload.completeRemainingSteps !== false && s.status !== 'DONE'
              ? { ...s, status: 'DONE', completedAt: s.completedAt || isoAt }
              : s,
          )
        : [];
      emitterTasks[idx] = {
        ...current,
        status: 'COMPLETED',
        issuer: 'genesis-emitter',
        retainedByEmitter: true,
        steps,
        completedAt: isoAt,
        updatedAt: isoAt,
      };
      if (cfg.cardRole !== 'EMITTER_MINT_AND_REGISTRY') {
        if (Array.isArray(current.rewards)) {
          for (const r of current.rewards) {
            if (Number(r?.amount) > 0) {
              const cur = String(r.currency || 'ancient_point');
              balances[cur] = (balances[cur] ?? 0) + Number(r.amount);
            }
          }
        } else if (current.reward > 0) {
          const cur = String(current.currency || 'ancient_point');
          balances[cur] = (balances[cur] ?? 0) + Number(current.reward);
        }
      }
    }
  }
}
