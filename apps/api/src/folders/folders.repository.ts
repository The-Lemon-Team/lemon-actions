import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ListFoldersQueryDto } from './folder.dto';
import { FolderDto } from './folder.types';

type Db = PrismaService | Prisma.TransactionClient;

const COLUMNS = Prisma.sql`id, name, parent_id AS "parentId", profile_id AS "profileId", path::text AS path,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Direct ltree SQL access (Prisma cannot query the ltree column natively). */
@Injectable()
export class FoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findAll(q: ListFoldersQueryDto = {}, db: Db = this.prisma): Promise<FolderDto[]> {
    if (q.profileId && q.scope) {
      return db.$queryRaw<FolderDto[]>`
        SELECT ${COLUMNS} FROM folders
        WHERE profile_id = ${q.profileId}::uuid AND path <@ ${q.scope}::ltree
        ORDER BY path`;
    }
    if (q.profileId) {
      return db.$queryRaw<FolderDto[]>`
        SELECT ${COLUMNS} FROM folders
        WHERE profile_id = ${q.profileId}::uuid
        ORDER BY path`;
    }
    if (q.scope) {
      return db.$queryRaw<FolderDto[]>`
        SELECT ${COLUMNS} FROM folders
        WHERE path <@ ${q.scope}::ltree
        ORDER BY path`;
    }
    return db.$queryRaw<FolderDto[]>`SELECT ${COLUMNS} FROM folders ORDER BY path`;
  }

  async findById(id: string, db: Db = this.prisma): Promise<FolderDto | null> {
    const rows = await db.$queryRaw<FolderDto[]>`SELECT ${COLUMNS} FROM folders WHERE id = ${id}::uuid`;
    return rows[0] ?? null;
  }

  /** Folder itself + all descendants within the same profile: path <@ (target path). */
  async findSubtree(id: string, db: Db = this.prisma): Promise<FolderDto[]> {
    return db.$queryRaw<FolderDto[]>`
      SELECT ${COLUMNS} FROM folders
      WHERE path <@ (SELECT path FROM folders WHERE id = ${id}::uuid)
        AND profile_id IS NOT DISTINCT FROM (SELECT profile_id FROM folders WHERE id = ${id}::uuid)
      ORDER BY path`;
  }

  async pathExists(path: string, profileId: string | null = null, db: Db = this.prisma): Promise<boolean> {
    const rows = profileId
      ? await db.$queryRaw<{ c: number }[]>`
          SELECT 1 AS c FROM folders
          WHERE path = ${path}::ltree AND profile_id = ${profileId}::uuid
          LIMIT 1`
      : await db.$queryRaw<{ c: number }[]>`
          SELECT 1 AS c FROM folders
          WHERE path = ${path}::ltree AND profile_id IS NULL
          LIMIT 1`;
    return rows.length > 0;
  }

  async insert(
    name: string,
    parentId: string | null,
    path: string,
    profileId: string | null = null,
    db: Db = this.prisma,
  ): Promise<FolderDto> {
    const id = randomUUID();
    const rows = await db.$queryRaw<FolderDto[]>`
      INSERT INTO folders (id, name, parent_id, profile_id, path, updated_at)
      VALUES (${id}::uuid, ${name}, ${parentId}::uuid, ${profileId}::uuid, ${path}::ltree, now())
      RETURNING ${COLUMNS}`;
    return rows[0];
  }

  async updateName(id: string, name: string, db: Db = this.prisma): Promise<void> {
    await db.$executeRaw`UPDATE folders SET name = ${name}, updated_at = now() WHERE id = ${id}::uuid`;
  }

  /** Re-parents folder and rewrites paths of the entire subtree within the same profile. */
  async moveSubtree(
    id: string,
    oldPath: string,
    newPath: string,
    newParentId: string | null,
    profileId: string | null = null,
    db: Db = this.prisma,
  ): Promise<void> {
    if (profileId) {
      await db.$executeRaw`
        UPDATE folders
        SET path = ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree)),
            updated_at = now()
        WHERE path <@ ${oldPath}::ltree AND profile_id = ${profileId}::uuid`;
    } else {
      await db.$executeRaw`
        UPDATE folders
        SET path = ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree)),
            updated_at = now()
        WHERE path <@ ${oldPath}::ltree AND profile_id IS NULL`;
    }
    await db.$executeRaw`UPDATE folders SET parent_id = ${newParentId}::uuid WHERE id = ${id}::uuid`;
  }

  async countChildren(id: string, db: Db = this.prisma): Promise<number> {
    return db.folder.count({ where: { parentId: id } });
  }

  async delete(id: string, db: Db = this.prisma): Promise<void> {
    await db.$executeRaw`DELETE FROM folders WHERE id = ${id}::uuid`;
  }

  async findFolderContextData(folderId: string) {
    const flows = await this.prisma.flow.findMany({
      where: { folderId },
      orderBy: { createdAt: 'asc' },
    });
    const flowIds = flows.map((f) => f.id);
    const activeSessions = flowIds.length
      ? await this.prisma.flowSession.findMany({
          where: { flowId: { in: flowIds }, endedAt: null },
          orderBy: { startedAt: 'desc' },
        })
      : [];
    const recentEvents = flowIds.length
      ? await this.prisma.flowEvent.findMany({
          where: { flowId: { in: flowIds } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];

    return { flows, activeSessions, recentEvents };
  }
}
