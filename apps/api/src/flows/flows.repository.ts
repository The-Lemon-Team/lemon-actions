import { Injectable } from '@nestjs/common';
import { Flow, FlowStatus, Prisma, Tag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListFlowsQueryDto } from './flow.dto';

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
}
