import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FolderDto } from './folder.types';

type Db = PrismaService | Prisma.TransactionClient;

const COLUMNS = Prisma.sql`id, name, parent_id AS "parentId", path::text AS path,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Direct ltree SQL access (Prisma cannot query the ltree column natively). */
@Injectable()
export class FoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findAll(db: Db = this.prisma): Promise<FolderDto[]> {
    return db.$queryRaw<FolderDto[]>`SELECT ${COLUMNS} FROM folders ORDER BY path`;
  }

  async findById(id: string, db: Db = this.prisma): Promise<FolderDto | null> {
    const rows = await db.$queryRaw<FolderDto[]>`SELECT ${COLUMNS} FROM folders WHERE id = ${id}::uuid`;
    return rows[0] ?? null;
  }

  /** Folder itself + all descendants: path <@ (target path). */
  async findSubtree(id: string, db: Db = this.prisma): Promise<FolderDto[]> {
    return db.$queryRaw<FolderDto[]>`
      SELECT ${COLUMNS} FROM folders
      WHERE path <@ (SELECT path FROM folders WHERE id = ${id}::uuid)
      ORDER BY path`;
  }

  async pathExists(path: string, db: Db = this.prisma): Promise<boolean> {
    const rows = await db.$queryRaw<{ c: number }[]>`
      SELECT 1 AS c FROM folders WHERE path = ${path}::ltree LIMIT 1`;
    return rows.length > 0;
  }

  async insert(
    name: string,
    parentId: string | null,
    path: string,
    db: Db = this.prisma,
  ): Promise<FolderDto> {
    const id = randomUUID();
    const rows = await db.$queryRaw<FolderDto[]>`
      INSERT INTO folders (id, name, parent_id, path, updated_at)
      VALUES (${id}::uuid, ${name}, ${parentId}::uuid, ${path}::ltree, now())
      RETURNING ${COLUMNS}`;
    return rows[0];
  }

  async updateName(id: string, name: string, db: Db = this.prisma): Promise<void> {
    await db.$executeRaw`UPDATE folders SET name = ${name}, updated_at = now() WHERE id = ${id}::uuid`;
  }

  /** Re-parents folder and rewrites paths of the entire subtree. */
  async moveSubtree(
    id: string,
    oldPath: string,
    newPath: string,
    newParentId: string | null,
    db: Db = this.prisma,
  ): Promise<void> {
    await db.$executeRaw`
      UPDATE folders
      SET path = ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree)),
          updated_at = now()
      WHERE path <@ ${oldPath}::ltree`;
    await db.$executeRaw`UPDATE folders SET parent_id = ${newParentId}::uuid WHERE id = ${id}::uuid`;
  }

  async countChildren(id: string, db: Db = this.prisma): Promise<number> {
    return db.folder.count({ where: { parentId: id } });
  }

  async delete(id: string, db: Db = this.prisma): Promise<void> {
    await db.$executeRaw`DELETE FROM folders WHERE id = ${id}::uuid`;
  }
}
