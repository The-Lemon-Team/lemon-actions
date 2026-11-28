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

const TX_EVENTS = new Set(['DEPOSIT', 'REWARD_MINTED', 'LEDGER_CREDIT', 'WITHDRAW', 'LEDGER_DEBIT']);
const MAX_TRANSACTIONS_HISTORY = 200;

export interface TransactionParticipantRecord {
  user: string;
  actorId: string;
  actorName?: string;
  role?: string;
}

export interface TransactionLedgerRecord {
  txId: string;
  eventType: string;
  direction: 'CREDIT' | 'DEBIT';
  taskId: string | null;
  tower: string | null;
  currency: string;
  amount: number;
  reason: string | null;
  issuer: string;
  balanceAlreadyApplied: boolean;
  participants: TransactionParticipantRecord[];
  recipients: string[];
  timestamp: string;
  txHash?: string;
}

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
    const transactions: TransactionLedgerRecord[] = Array.isArray(prev.transactions) ? [...prev.transactions] : [];

    switch (eventType) {
      case 'DEPOSIT':
      case 'REWARD_MINTED':
      case 'LEDGER_CREDIT':
        if (!payload.balanceAlreadyApplied) {
          this.applyBalanceDelta(balances, payload, 1, Boolean(cfg.allowNegative));
        }
        this.recordTransaction(transactions, eventType, 'CREDIT', payload, cfg, isoAt);
        break;
      case 'WITHDRAW':
      case 'LEDGER_DEBIT':
        if (!payload.balanceAlreadyApplied) {
          this.applyBalanceDelta(balances, payload, -1, Boolean(cfg.allowNegative));
        }
        this.recordTransaction(transactions, eventType, 'DEBIT', payload, cfg, isoAt);
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
    const workstationStats = this.computeWorkstationStats(transactions);

    return {
      ...prev,
      balances,
      resources,
      participants,
      emitterTasks,
      ownLots,
      transactions,
      workstationStats,
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

  private normalizeWorkstationUser(raw: unknown): string {
    const cleaned = String(raw || '').trim();
    if (!cleaned) return 'ПК-1';
    const upper = cleaned.toUpperCase();
    if (upper === 'PC-1' || upper === 'PC1' || upper === 'ПК1') return 'ПК-1';
    if (upper === 'PC-2' || upper === 'PC2' || upper === 'ПК2') return 'ПК-2';
    if (upper === 'PC-3' || upper === 'PC3' || upper === 'ПК3') return 'ПК-3';
    return cleaned;
  }

  private normalizeTxParticipants(payload: Record<string, any>): TransactionParticipantRecord[] {
    const defaultUser = this.normalizeWorkstationUser(payload.workstation ?? payload.user ?? payload.pc);
    const out: TransactionParticipantRecord[] = [];
    const seen = new Set<string>();

    const pushEntry = (userRaw: unknown, actorRaw: unknown, actorName?: unknown, role?: unknown) => {
      const actorId = String(actorRaw || '').trim();
      if (!actorId) return;
      const user = this.normalizeWorkstationUser(userRaw ?? defaultUser);
      const key = `${user}::${actorId}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        user,
        actorId,
        ...(typeof actorName === 'string' && actorName.trim() ? { actorName: actorName.trim() } : {}),
        ...(typeof role === 'string' && role.trim() ? { role: role.trim() } : {}),
      });
    };

    if (Array.isArray(payload.participants)) {
      for (const item of payload.participants) {
        if (typeof item === 'string') {
          pushEntry(defaultUser, item);
        } else if (item && typeof item === 'object') {
          pushEntry(
            (item as any).user ?? (item as any).workstation ?? (item as any).pc ?? defaultUser,
            (item as any).actorId ?? (item as any).characterId ?? (item as any).id,
            (item as any).actorName,
            (item as any).role,
          );
        }
      }
    }

    if (Array.isArray(payload.recipients)) {
      for (const item of payload.recipients) {
        if (typeof item === 'string') {
          pushEntry(defaultUser, item);
        } else if (item && typeof item === 'object') {
          pushEntry(
            (item as any).user ?? (item as any).workstation ?? (item as any).pc ?? defaultUser,
            (item as any).actorId ?? (item as any).characterId ?? (item as any).id,
            (item as any).actorName,
            (item as any).role,
          );
        }
      }
    }

    if (out.length === 0) {
      const fallbackActor = payload.recipientActorId ?? payload.actorId ?? payload.assigneeActorId;
      if (fallbackActor) {
        pushEntry(defaultUser, fallbackActor);
      }
    }

    return out;
  }

  private recordTransaction(
    transactions: TransactionLedgerRecord[],
    eventType: string,
    direction: 'CREDIT' | 'DEBIT',
    payload: Record<string, any>,
    cfg: Record<string, any>,
    isoAt: string,
  ): void {
    if (!TX_EVENTS.has(eventType)) return;
    const amount = Number(payload.amount ?? payload.delta ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const currency = String(payload.currency || 'ancient_point');
    const participants = this.normalizeTxParticipants(payload);
    const recipients = [...new Set(participants.map((p) => p.actorId))];
    const txId = String(
      payload.txId ||
        `${payload.taskId || eventType}:${currency}:${amount}:${isoAt}`,
    );

    const record: TransactionLedgerRecord = {
      txId,
      eventType,
      direction,
      taskId: typeof payload.taskId === 'string' && payload.taskId.trim() ? payload.taskId.trim() : null,
      tower:
        typeof payload.tower === 'string' && payload.tower.trim()
          ? payload.tower.trim()
          : typeof payload.claimedByTower === 'string' && payload.claimedByTower.trim()
            ? payload.claimedByTower.trim()
            : typeof cfg.towerElement === 'string'
              ? cfg.towerElement
              : null,
      currency,
      amount,
      reason: typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : null,
      issuer: String(payload.issuer || 'genesis-emitter'),
      balanceAlreadyApplied: Boolean(payload.balanceAlreadyApplied),
      participants,
      recipients,
      timestamp: typeof payload.timestamp === 'string' && payload.timestamp.trim() ? payload.timestamp : isoAt,
      ...(typeof payload.txHash === 'string' && payload.txHash.trim() ? { txHash: payload.txHash.trim() } : {}),
    };

    const existingIdx = payload.txId ? transactions.findIndex((t) => t.txId === record.txId) : -1;
    if (existingIdx >= 0) {
      transactions[existingIdx] = record;
    } else {
      transactions.push(record);
      if (transactions.length > MAX_TRANSACTIONS_HISTORY) {
        transactions.splice(0, transactions.length - MAX_TRANSACTIONS_HISTORY);
      }
    }
  }

  private computeWorkstationStats(
    transactions: TransactionLedgerRecord[],
  ): Record<string, { txCount: number; totalsByCurrency: Record<string, number>; actors: Record<string, Record<string, number>> }> {
    const stats: Record<
      string,
      { txCount: number; totalsByCurrency: Record<string, number>; actors: Record<string, Record<string, number>> }
    > = {};

    for (const tx of transactions) {
      if (!tx || typeof tx !== 'object') continue;
      const sign = tx.direction === 'DEBIT' ? -1 : 1;
      const currency = String((tx as any).currency || 'ancient_point');
      const amount = Number((tx as any).amount ?? 0);
      const rawParticipants = Array.isArray(tx.participants) ? tx.participants : [];
      const fallbackActor = String((tx as any).toActorId ?? (tx as any).recipientActorId ?? '').trim();
      const entries =
        rawParticipants.length > 0
          ? rawParticipants
          : [
              {
                user: this.normalizeWorkstationUser((tx as any).workstation ?? (tx as any).user),
                actorId: fallbackActor || 'unassigned',
              },
            ];
      const touchedUsers = new Set<string>();

      for (const p of entries) {
        const user = this.normalizeWorkstationUser(p?.user);
        const actorId = String(p?.actorId || '').trim() || 'unassigned';
        const userBucket = (stats[user] ??= {
          txCount: 0,
          totalsByCurrency: {},
          actors: {},
        });
        if (!touchedUsers.has(user)) {
          userBucket.txCount += 1;
          userBucket.totalsByCurrency[currency] =
            (userBucket.totalsByCurrency[currency] ?? 0) + sign * amount;
          touchedUsers.add(user);
        }
        const actorCurrencies = (userBucket.actors[actorId] ??= {});
        actorCurrencies[currency] = (actorCurrencies[currency] ?? 0) + sign * amount;
      }
    }

    return stats;
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
