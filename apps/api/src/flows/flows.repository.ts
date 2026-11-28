import { BadRequestException, Injectable } from '@nestjs/common';
import { Flow, FlowStatus, Prisma, Tag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListFlowsQueryDto } from './flow.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Db = PrismaService | Prisma.TransactionClient;
const include = { tags: { include: { tag: true } } } satisfies Prisma.FlowInclude;
export type FlowWithTags = Prisma.FlowGetPayload<{ include: typeof include }>;

/** API shape (camelCase, tags flattened) expected by the Angular frontend. */
export interface FlowView {
  id: string;
  name: string;
  description?: string;
  type: Flow['type'];
  status: Flow['status'];
  isExclusive: boolean;
  folderId: string | null;
  profileId: string | null;
  projectSlug: string | null;
  tags: { id: string; name: string; colorHex?: string }[];
  config?: unknown;
  orchestratorRules?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export function toFlowView(f: FlowWithTags): FlowView {
  return {
    id: f.id,
    name: f.name,
    description: f.description ?? undefined,
    type: f.type,
    status: f.status,
    isExclusive: f.isExclusive,
    folderId: f.folderId,
    profileId: f.profileId ?? null,
    projectSlug: (f as any).projectSlug ?? null,
    tags: f.tags.map((t: { tag: Tag }) => ({
      id: t.tag.id,
      name: t.tag.name,
      colorHex: t.tag.colorHex ?? undefined,
    })),
    config: f.config ?? undefined,
    orchestratorRules: f.orchestratorRules ?? undefined,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

@Injectable()
export class FlowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async resolveProfileId(raw: string, db: Db = this.prisma): Promise<string> {
    const trimmed = raw.trim();
    if (UUID_RE.test(trimmed)) return trimmed;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM profiles WHERE LOWER(handle) = LOWER(${trimmed}) LIMIT 1`;
    if (rows[0]?.id) return rows[0].id;
    throw new BadRequestException(`Unknown profile identifier "${trimmed}" (expected UUID or handle)`);
  }

  async findMany(q: ListFlowsQueryDto): Promise<FlowWithTags[]> {
    let folderFilter: Prisma.StringNullableFilter | string | undefined = q.folderId;

    if (q.scope) {
      const scopedRows = q.profileId
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM folders
            WHERE path <@ ${q.scope}::ltree AND profile_id = ${q.profileId}::uuid`
        : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM folders
            WHERE path <@ ${q.scope}::ltree`;
      const scopedIds = scopedRows.map((r) => r.id);
      if (q.folderId) {
        folderFilter = scopedIds.includes(q.folderId) ? q.folderId : { in: [] };
      } else {
        folderFilter = { in: scopedIds };
      }
    }

    const where: Prisma.FlowWhereInput = {
      folderId: folderFilter,
      profileId: q.profileId,
      ...(q.projectSlug ? { projectSlug: q.projectSlug } : {}),
      type: q.type,
      status: q.status,
      tags: q.tag ? { some: { tag: { name: q.tag } } } : undefined,
      OR: q.q
        ? [
            { name: { contains: q.q, mode: 'insensitive' } },
            { description: { contains: q.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    return this.prisma.flow.findMany({ where, include, orderBy: { createdAt: 'asc' } });
  }

  findById(id: string, db: Db = this.prisma): Promise<FlowWithTags | null> {
    return db.flow.findUnique({ where: { id }, include });
  }

  /** Lightweight flow lookup without tag joins for hot paths (events, heartbeats, batch). */
  findByIdLite(id: string, db: Db = this.prisma): Promise<Flow | null> {
    return db.flow.findUnique({ where: { id } });
  }

  /**
   * Acquires a transaction-scoped advisory lock for exclusive flow operations within a folder
   * (or global scope when folderId is null) to prevent READ COMMITTED race conditions.
   */
  async acquireExclusiveScopeLock(folderId: string | null, db: Db = this.prisma): Promise<void> {
    const lockKey = `flows:exclusive:${folderId ?? '__global__'}`;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  /**
   * Selects only flows that have active scheduler responsibilities (active timers, lease timeouts,
   * active non-empty batches, OPEN circuit breakers, or scheduled windows) without joining tags.
   */
  findSchedulableFlows(db: Db = this.prisma): Promise<Flow[]> {
    return db.$queryRaw<Flow[]>`
      SELECT
        id,
        name,
        description,
        type,
        status,
        is_exclusive AS "isExclusive",
        folder_id AS "folderId",
        profile_id AS "profileId",
        project_slug AS "projectSlug",
        config,
        orchestrator_rules AS "orchestratorRules",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM flows
      WHERE
        (status = 'ACTIVE' AND type = 'TIMER')
        OR (status = 'ACTIVE' AND type = 'BATCH' AND COALESCE((config->>'pendingCount')::int, 0) > 0)
        OR (status = 'ACTIVE' AND (orchestrator_rules->>'leaseTimeoutSeconds') IS NOT NULL)
        OR (type = 'CIRCUIT_BREAKER' AND config->>'state' = 'OPEN')
        OR (
          orchestrator_rules->'schedule'->'windows' IS NOT NULL
          AND jsonb_typeof(orchestrator_rules->'schedule'->'windows') = 'array'
          AND jsonb_array_length(orchestrator_rules->'schedule'->'windows') > 0
          AND COALESCE((orchestrator_rules->'schedule'->>'enabled')::boolean, true) = true
        )
      ORDER BY created_at ASC
    `;
  }

  create(data: Prisma.FlowCreateInput, tagNames: string[], db: Db = this.prisma): Promise<FlowWithTags> {
    return db.flow.create({
      data: { ...data, tags: { create: tagNames.map((name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })) } },
      include,
    });
  }

  async update(
    id: string,
    data: Prisma.FlowUpdateInput,
    tagNames: string[] | undefined,
    db: Db = this.prisma,
  ): Promise<FlowWithTags> {
    return db.flow.update({
      where: { id },
      data: {
        ...data,
        tags: tagNames
          ? {
              deleteMany: {},
              create: tagNames.map((name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })),
            }
          : undefined,
      },
      include,
    });
  }

  /** Lightweight flow update without tag joins for internal state updates (config, rules). */
  updateLite(id: string, data: Prisma.FlowUpdateInput, db: Db = this.prisma): Promise<Flow> {
    return db.flow.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.flow.delete({ where: { id } });
  }

  /** Other exclusive flows in the same folder that are currently running. */
  findRunningExclusive(folderId: string | null, excludeId: string, db: Db): Promise<Flow[]> {
    return db.flow.findMany({
      where: {
        isExclusive: true,
        folderId,
        id: { not: excludeId },
        status: { in: [FlowStatus.ACTIVE, FlowStatus.PROCESSING] },
      },
    });
  }

  setStatus(id: string, status: FlowStatus, db: Db): Promise<FlowWithTags> {
    return db.flow.update({ where: { id }, data: { status }, include });
  }

  openSession(flowId: string, db: Db) {
    return db.flowSession.create({ data: { flowId } });
  }

  async hasOpenSession(flowId: string, db: Db): Promise<boolean> {
    return (await db.flowSession.count({ where: { flowId, endedAt: null } })) > 0;
  }

  closeSessions(flowId: string, closedBy: string, db: Db) {
    return db.flowSession.updateMany({
      where: { flowId, endedAt: null },
      data: { endedAt: new Date(), closedBy },
    });
  }

  async countByStatus(profileId?: string): Promise<Record<FlowStatus, number>> {
    const rows = await this.prisma.flow.groupBy({
      by: ['status'],
      where: profileId ? { profileId } : undefined,
      _count: { _all: true },
    });
    const out = { INACTIVE: 0, ACTIVE: 0, PAUSED: 0, PROCESSING: 0 } as Record<FlowStatus, number>;
    rows.forEach((r) => (out[r.status] = r._count._all));
    return out;
  }

  async getFolderMeta(id: string): Promise<{ id: string; profileId: string | null } | null> {
    return this.prisma.folder.findUnique({
      where: { id },
      select: { id: true, profileId: true },
    });
  }

  listSessions(flowId: string) {
    return this.prisma.flowSession.findMany({
      where: { flowId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  listEvents(flowId: string, sessionId?: string) {
    return this.prisma.flowEvent.findMany({
      where: {
        flowId,
        ...(sessionId ? { activeFlowSessionIds: { has: sessionId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Находит все открытые сессии потоков в том же контейнере-папке (Neuron),
   * чтобы каждое событие автоматически получало слепок активных мьютексов и расписаний.
   */
  findOpenSessionsInFolder(folderId: string | null, includeFlowId: string, db: Db = this.prisma) {
    return db.flowSession.findMany({
      where: {
        endedAt: null,
        flow: folderId
          ? { OR: [{ folderId }, { id: includeFlowId }] }
          : { id: includeFlowId },
      },
      select: { id: true, flowId: true },
    });
  }

  createFlowEvent(
    data: {
      flowId: string;
      source: string;
      eventType: string;
      payload: Prisma.InputJsonObject;
      activeFlowSessionIds: string[];
    },
    db: Db = this.prisma,
  ) {
    return db.flowEvent.create({ data });
  }

  touchFlow(id: string, db: Db = this.prisma) {
    return db.flow.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  findFlowsByFolder(folderId: string, db: Db = this.prisma): Promise<FlowWithTags[]> {
    return db.flow.findMany({
      where: { folderId },
      include,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bulk-enqueues batch buffer items in at most 1 lookup + 1 createMany + updates for matched dedupKeys,
   * avoiding N+1 roundtrips and returning the accurate pending item count.
   */
  async pushBufferItemsBatch(
    flowId: string,
    items: Array<{ payload: Prisma.InputJsonObject; dedupKey?: string }>,
    db: Db = this.prisma,
  ): Promise<{ inserted: number; updated: number; pendingTotal: number }> {
    const now = new Date();
    const dedupMap = new Map<string, Prisma.InputJsonObject>();
    const nonDedupPayloads: Prisma.InputJsonObject[] = [];

    for (const item of items) {
      if (item.dedupKey) {
        dedupMap.set(item.dedupKey, item.payload);
      } else {
        nonDedupPayloads.push(item.payload);
      }
    }

    let updated = 0;
    const toInsert: Array<{ flowId: string; dedupKey?: string; payload: Prisma.InputJsonObject; enqueuedAt: Date }> =
      nonDedupPayloads.map((payload) => ({ flowId, payload, enqueuedAt: now }));

    if (dedupMap.size > 0) {
      const keys = Array.from(dedupMap.keys());
      const existingRows = await db.flowBufferItem.findMany({
        where: { flowId, flushedAt: null, dedupKey: { in: keys } },
        select: { id: true, dedupKey: true },
      });
      const existingByKey = new Map<string, string>();
      for (const row of existingRows) {
        if (row.dedupKey && !existingByKey.has(row.dedupKey)) {
          existingByKey.set(row.dedupKey, row.id);
        }
      }

      for (const [dedupKey, payload] of dedupMap.entries()) {
        const existingId = existingByKey.get(dedupKey);
        if (existingId) {
          await db.flowBufferItem.update({
            where: { id: existingId },
            data: { payload, enqueuedAt: now },
          });
          updated++;
        } else {
          toInsert.push({ flowId, dedupKey, payload, enqueuedAt: now });
        }
      }
    }

    if (toInsert.length > 0) {
      await db.flowBufferItem.createMany({ data: toInsert });
    }

    const pendingTotal = await db.flowBufferItem.count({
      where: { flowId, flushedAt: null },
    });

    return { inserted: toInsert.length, updated, pendingTotal };
  }

  async pushBufferItem(
    flowId: string,
    payload: Prisma.InputJsonObject,
    dedupKey?: string,
    db: Db = this.prisma,
  ) {
    if (dedupKey) {
      const existing = await (db as any).flowBufferItem?.findFirst({
        where: { flowId, dedupKey, flushedAt: null },
      });
      if (existing) {
        return (db as any).flowBufferItem?.update({
          where: { id: existing.id },
          data: { payload, enqueuedAt: new Date() },
        });
      }
    }
    return (db as any).flowBufferItem?.create({
      data: {
        flowId,
        dedupKey,
        payload,
      },
    });
  }

  findPendingBufferItems(flowId: string, db: Db = this.prisma) {
    return (db as any).flowBufferItem?.findMany({
      where: { flowId, flushedAt: null },
      orderBy: { enqueuedAt: 'asc' },
    }) ?? Promise.resolve([]);
  }

  async flushBufferItems(flowId: string, db: Db = this.prisma) {
    const items = await this.findPendingBufferItems(flowId, db);
    if (items.length > 0) {
      await (db as any).flowBufferItem?.updateMany({
        where: { flowId, flushedAt: null },
        data: { flushedAt: new Date() },
      });
    }
    return items;
  }

  /**
   * Purges historical flow_events and flushed flow_buffer_items older than `cutoffDate`
   * according to the shard's `eventRetentionDays` policy.
   */
  async purgeExpiredEvents(
    cutoffDate: Date,
    projectSlug?: string,
    db: Db = this.prisma,
  ): Promise<{ deletedEvents: number; deletedBufferItems: number }> {
    const scopeFilter = projectSlug ? { flow: { projectSlug } } : {};

    const deletedEventsRes = await db.flowEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        ...scopeFilter,
      },
    });

    const deletedBufferRes = await db.flowBufferItem.deleteMany({
      where: {
        flushedAt: { not: null, lt: cutoffDate },
        ...scopeFilter,
      },
    });

    return {
      deletedEvents: deletedEventsRes.count,
      deletedBufferItems: deletedBufferRes.count,
    };
  }
}
