import { PrismaClient } from '@prisma/client';
import { SpaceTowersProjectionReducer } from '../flows/reducers/space-towers.projection-reducer';

const AIR_VAULT_FLOW_ID = '25cdb293-f88c-4d83-b8ea-7a38059a4e8f';

const ACTOR_NAMES: Record<string, string> = {
  'actor-starleader': 'ТимЛид Старлидер',
  'actor-professor': 'Профессор Разум',
  'actor-alisa': 'Алиса',
  'actor-akin': 'Акин',
  'actor-alexey': 'Алексей',
  'actor-easy': 'Easy (Изи)',
  'actor-hades': 'Аид',
  'actor-ansy': 'Анси (Ansy)',
  'actor-yuka': 'Юка',
  'actor-neurobi': 'Нейроби',
  'actor-antigravity-agent': 'Antigravity Agent',
  'actor-master-ai': 'Мастер-АИ',
};

const BOUNTY_19_CLEAN_REASON =
  'Начисление 2000 AP за Баунти #19: space-shard (:4328, lemon_space_shard DB), авто-деривация projectSlug по ltree и клиентские заголовки для lemon-universe, lemon-code и home, восстановление lemon-media-hub (:3005) и lemon-ai-service (:3006) с NATS JetStream, очистка дублей _2 и backfill всех 5 БД (0 NULL)';

function normalizeWorkstation(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s) return 'ПК-1';
  const u = s.toUpperCase();
  if (u === 'PC-1' || u === 'PC1' || u === 'ПК1') return 'ПК-1';
  if (u === 'PC-2' || u === 'PC2' || u === 'ПК2') return 'ПК-2';
  if (u === 'PC-3' || u === 'PC3' || u === 'ПК3') return 'ПК-3';
  return s;
}

function buildStructuredParticipants(
  payload: Record<string, any>,
  defaultUser = 'ПК-1',
): Array<{ user: string; actorId: string; actorName?: string }> {
  const seen = new Set<string>();
  const out: Array<{ user: string; actorId: string; actorName?: string }> = [];

  const add = (userRaw: unknown, actorRaw: unknown, actorName?: string) => {
    const actorId = String(actorRaw || '').trim();
    if (!actorId) return;
    const user = normalizeWorkstation(userRaw ?? defaultUser);
    const key = `${user}::${actorId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const resolvedName = actorName?.trim() || ACTOR_NAMES[actorId];
    out.push({
      user,
      actorId,
      ...(resolvedName ? { actorName: resolvedName } : {}),
    });
  };

  if (Array.isArray(payload.participants)) {
    for (const item of payload.participants) {
      if (typeof item === 'string') {
        add(defaultUser, item);
      } else if (item && typeof item === 'object') {
        add((item as any).user ?? (item as any).workstation ?? defaultUser, (item as any).actorId ?? (item as any).id, (item as any).actorName);
      }
    }
  }

  if (Array.isArray(payload.recipients)) {
    for (const item of payload.recipients) {
      if (typeof item === 'string') {
        add(defaultUser, item);
      } else if (item && typeof item === 'object') {
        add((item as any).user ?? (item as any).workstation ?? defaultUser, (item as any).actorId ?? (item as any).id, (item as any).actorName);
      }
    }
  }

  if (out.length === 0) {
    const fallback = payload.recipientActorId ?? payload.actorId ?? payload.assigneeActorId;
    if (fallback) add(defaultUser, fallback);
  }

  return out;
}

const MISSING_AIR_TXS = [
  {
    taskId: 'bounty-2-lemon-actions-bus',
    createdAt: new Date('2026-11-24T10:00:00.000Z'),
    payload: {
      txId: 'backfill-bounty-2-air-500-gap',
      taskId: 'bounty-2-lemon-actions-bus',
      tower: 'AIR',
      issuer: 'genesis-emitter',
      currency: 'golden_ancient_point',
      amount: 500,
      balanceAlreadyApplied: true,
      workstation: 'ПК-1',
      participants: [
        { user: 'ПК-1', actorId: 'actor-easy', actorName: 'Easy (Изи)' },
        { user: 'ПК-1', actorId: 'actor-antigravity-agent', actorName: 'Antigravity Agent' },
      ],
      recipients: ['actor-easy', 'actor-antigravity-agent'],
      reason: 'Исторический backfill из TimeLine/seed: Баунти #2 (Lemon Stack Bus, +500 GAP -> Башня Воздуха)',
    },
  },
  {
    taskId: 'bounty-6-bus-lightweight-heartbeats',
    createdAt: new Date('2026-11-24T10:00:01.000Z'),
    payload: {
      txId: 'backfill-bounty-6-air-100-gap',
      taskId: 'bounty-6-bus-lightweight-heartbeats',
      tower: 'AIR',
      issuer: 'genesis-emitter',
      currency: 'golden_ancient_point',
      amount: 100,
      balanceAlreadyApplied: true,
      workstation: 'ПК-1',
      participants: [
        { user: 'ПК-1', actorId: 'actor-easy', actorName: 'Easy (Изи)' },
        { user: 'ПК-1', actorId: 'actor-antigravity-agent', actorName: 'Antigravity Agent' },
      ],
      recipients: ['actor-easy', 'actor-antigravity-agent'],
      reason: 'Исторический backfill из TimeLine/seed: Баунти #6 (Lightweight Heartbeats via Stack Bus, +100 GAP -> Башня Воздуха)',
    },
  },
];

async function migrateDatabase(label: string, databaseUrl: string) {
  console.log(`\n=== Migrating transactions on ${label} ===`);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const reducer = new SpaceTowersProjectionReducer();

  try {
    // 1. Ensure missing historical AIR reward events exist (without re-crediting balance)
    const airVault = await prisma.flow.findUnique({ where: { id: AIR_VAULT_FLOW_ID } });
    if (airVault) {
      const existingAirEvents = await prisma.flowEvent.findMany({
        where: { flowId: AIR_VAULT_FLOW_ID, eventType: 'REWARD_MINTED' },
      });
      for (const m of MISSING_AIR_TXS) {
        const exists = existingAirEvents.some((e) => ((e.payload as any)?.taskId ?? '') === m.taskId);
        if (!exists) {
          await prisma.flowEvent.create({
            data: {
              flowId: AIR_VAULT_FLOW_ID,
              source: 'migration-backfill',
              eventType: 'REWARD_MINTED',
              payload: m.payload as any,
              createdAt: m.createdAt,
            },
          });
          console.log(`  + Inserted missing historical REWARD_MINTED for ${m.taskId}`);
        }
      }
    }

    // 2. Normalize all existing vault REWARD_MINTED / DEPOSIT / LEDGER / WITHDRAW events & rebuild projectionState.transactions
    const vaultFlows = await prisma.$queryRaw<Array<{ id: string; name: string; config: any }>>`
      SELECT fl.id, fl.name, fl.config
      FROM flows fl
      JOIN folders fo ON fl.folder_id = fo.id
      WHERE (fo.path::text ~ '^space\.towers(\.|$)' OR fo.path::text = 'space.emitter') AND fl.type = 'PROJECTION'
      ORDER BY fo.path::text
    `;

    for (const vault of vaultFlows) {
      const events = await prisma.flowEvent.findMany({
        where: {
          flowId: vault.id,
          eventType: { in: ['DEPOSIT', 'REWARD_MINTED', 'LEDGER_CREDIT', 'WITHDRAW', 'LEDGER_DEBIT'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      const cfg = (vault.config ?? {}) as Record<string, any>;
      const prevState = (cfg.projectionState ?? {}) as Record<string, any>;
      const preservedBalances = { ...(prevState.balances ?? {}) };

      // Normalize any legacy pre-existing projectionState.transactions entries (e.g. on Main Emitter)
      const legacyTxs = Array.isArray(prevState.transactions) ? prevState.transactions : [];
      const normalizedLegacyTxs = legacyTxs.map((tx: any) => {
        const participants = buildStructuredParticipants(
          {
            ...tx,
            recipients: tx.recipients ?? (tx.toActorId ? [tx.toActorId] : undefined),
          },
          'ПК-1',
        );
        return {
          ...tx,
          direction: tx.direction || 'CREDIT',
          tower: tx.tower || tx.toTower || null,
          issuer: tx.issuer || tx.from || 'genesis-emitter',
          timestamp: tx.timestamp || tx.createdAt || new Date().toISOString(),
          participants,
          recipients: participants.map((p) => p.actorId),
        };
      });

      let rebuiltState: Record<string, any> = {
        ...prevState,
        transactions: cfg.cardRole === 'EMITTER_MINT_AND_REGISTRY' ? normalizedLegacyTxs : [],
        workstationStats: {},
      };

      for (const ev of events) {
        const rawPayload = ((ev.payload ?? {}) as Record<string, any>);
        const participants = buildStructuredParticipants(rawPayload, 'ПК-1');
        const nextPayload: Record<string, any> = {
          ...rawPayload,
          txId: rawPayload.txId || ev.id,
          workstation: normalizeWorkstation(rawPayload.workstation ?? rawPayload.user ?? 'ПК-1'),
          participants,
          recipients: participants.map((p) => p.actorId),
        };
        if (
          nextPayload.taskId === 'bounty-19-other-projects-sharding-migration' &&
          typeof nextPayload.reason === 'string' &&
          nextPayload.reason.includes('????')
        ) {
          nextPayload.reason = BOUNTY_19_CLEAN_REASON;
        }

        await prisma.flowEvent.update({
          where: { id: ev.id },
          data: { payload: nextPayload as any },
        });

        // Apply only transaction/attribution reduction while keeping authoritative vault balances exact
        rebuiltState = reducer.reduce(
          rebuiltState,
          ev.eventType,
          { ...nextPayload, balanceAlreadyApplied: true },
          cfg,
          ev.createdAt,
        );
      }

      if (events.length === 0 && cfg.cardRole === 'EMITTER_MINT_AND_REGISTRY') {
        // Trigger stats calculation on normalized legacy emitter transactions
        const tmp = reducer.reduce(rebuiltState, 'NOOP', {}, cfg, new Date());
        rebuiltState.workstationStats = tmp.workstationStats;
      }

      rebuiltState.balances = preservedBalances;
      rebuiltState.eventsCount = prevState.eventsCount ?? events.length;
      if (prevState.lastEventType) rebuiltState.lastEventType = prevState.lastEventType;
      if (prevState.lastUpdatedAt) rebuiltState.lastUpdatedAt = prevState.lastUpdatedAt;

      await prisma.flow.update({
        where: { id: vault.id },
        data: {
          config: {
            ...cfg,
            projectionState: rebuiltState,
          } as any,
        },
      });

      const txCount = Array.isArray(rebuiltState.transactions) ? rebuiltState.transactions.length : 0;
      const wsKeys = Object.keys(rebuiltState.workstationStats ?? {});
      console.log(
        `  ✓ ${vault.name}: ${txCount} transactions migrated | workstations=[${wsKeys.join(', ')}] | balances=${JSON.stringify(preservedBalances)}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const targets = [
    { label: 'lemon_projectarium_db (:5436)', url: process.env.PROJECTARIUM_DATABASE_URL },
    { label: 'lemon_space_shard (:5432)', url: process.env.SPACE_SHARD_DATABASE_URL },
  ].filter((t): t is { label: string; url: string } => Boolean(t.url));

  if (targets.length === 0) {
    throw new Error('Set PROJECTARIUM_DATABASE_URL and/or SPACE_SHARD_DATABASE_URL');
  }

  for (const t of targets) {
    await migrateDatabase(t.label, t.url);
  }
  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
