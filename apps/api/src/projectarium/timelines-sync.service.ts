import crypto from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectariumService } from './projectarium.service';

export interface TimelineBoardLinkDto {
  boardId: string;
  boardTitle?: string;
  timelineUrl: string;
  apiBaseUrl: string;
  token: string;
}

export interface TimelineBoardLinkView {
  id: string;
  standSlug: string;
  boardId: string;
  boardTitle: string | null;
  timelineUrl: string;
  apiBaseUrl: string;
  tokenPrefix: string;
  cursor: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface TimelineBoardLinkRow extends TimelineBoardLinkView {
  token: string;
}

const SYNC_INTERVAL_MS = 60_000;

@Injectable()
export class TimelinesSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimelinesSyncService.name);
  private changesSub: Subscription | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private readonly skipPushEventIds = new Set<string>();
  private schemaReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectarium: ProjectariumService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    this.changesSub = this.projectarium.changes$().subscribe((change) => {
      if (change.kind === 'CHRONICLE_ADDED' && change.event) {
        if (this.skipPushEventIds.has(change.event.id)) {
          this.skipPushEventIds.delete(change.event.id);
          return;
        }
        void this.pushEventToTimelines(change.project.slug, change.event);
      }
    });
    this.syncTimer = setInterval(() => {
      void this.syncAll();
    }, SYNC_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    this.changesSub?.unsubscribe();
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS projectarium_timeline_links (
          id TEXT PRIMARY KEY,
          stand_slug TEXT NOT NULL,
          board_id TEXT NOT NULL,
          board_title TEXT,
          timeline_url TEXT NOT NULL,
          api_base_url TEXT NOT NULL,
          token TEXT NOT NULL,
          token_prefix TEXT NOT NULL,
          cursor TEXT,
          last_synced_at TIMESTAMPTZ,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (stand_slug, board_id)
        );
        CREATE TABLE IF NOT EXISTS projectarium_timeline_synced_refs (
          stand_slug TEXT NOT NULL,
          external_ref TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (stand_slug, external_ref)
        );
      `);
      this.schemaReady = true;
    } catch (err) {
      this.logger.warn(
        `Timeline sync schema init skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private resolveStandSlug(slugOrToken: string): string {
    const project = this.projectarium.getProject(slugOrToken);
    return project.slug;
  }

  async listLinks(slugOrToken: string): Promise<TimelineBoardLinkView[]> {
    await this.ensureSchema();
    const standSlug = this.resolveStandSlug(slugOrToken);
    const rows = await this.prisma.$queryRawUnsafe<TimelineBoardLinkView[]>(
      `
        SELECT
          id,
          stand_slug AS "standSlug",
          board_id AS "boardId",
          board_title AS "boardTitle",
          timeline_url AS "timelineUrl",
          api_base_url AS "apiBaseUrl",
          token_prefix AS "tokenPrefix",
          cursor,
          last_synced_at::text AS "lastSyncedAt",
          last_error AS "lastError",
          created_at::text AS "createdAt"
        FROM projectarium_timeline_links
        WHERE stand_slug = $1
        ORDER BY created_at DESC
      `,
      standSlug,
    );
    return rows;
  }

  async upsertLink(slugOrToken: string, dto: TimelineBoardLinkDto): Promise<TimelineBoardLinkView> {
    await this.ensureSchema();
    const standSlug = this.resolveStandSlug(slugOrToken);
    const boardId = (dto.boardId || '').trim();
    const timelineUrl = (dto.timelineUrl || '').trim().replace(/\/+$/, '');
    const apiBaseUrl = (dto.apiBaseUrl || '').trim().replace(/\/+$/, '');
    const token = (dto.token || '').trim();

    if (!boardId || !timelineUrl || !apiBaseUrl || !token) {
      throw new BadRequestException('boardId, timelineUrl, apiBaseUrl и token обязательны.');
    }

    const id = crypto.randomUUID();
    const tokenPrefix = token.slice(0, 8);
    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO projectarium_timeline_links (
          id, stand_slug, board_id, board_title, timeline_url, api_base_url, token, token_prefix
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (stand_slug, board_id) DO UPDATE SET
          board_title = COALESCE(EXCLUDED.board_title, projectarium_timeline_links.board_title),
          timeline_url = EXCLUDED.timeline_url,
          api_base_url = EXCLUDED.api_base_url,
          token = EXCLUDED.token,
          token_prefix = EXCLUDED.token_prefix,
          last_error = NULL
      `,
      id,
      standSlug,
      boardId,
      dto.boardTitle?.trim() || null,
      timelineUrl,
      apiBaseUrl,
      token,
      tokenPrefix,
    );

    const links = await this.listLinks(standSlug);
    const created = links.find((l) => l.boardId === boardId);
    if (!created) throw new NotFoundException('Не удалось сохранить привязку TimeLine.');
    return created;
  }

  async removeLink(slugOrToken: string, boardId: string): Promise<{ deleted: boolean; boardId: string }> {
    await this.ensureSchema();
    const standSlug = this.resolveStandSlug(slugOrToken);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM projectarium_timeline_links WHERE stand_slug = $1 AND board_id = $2`,
      standSlug,
      boardId,
    );
    return { deleted: true, boardId };
  }

  private async fetchRawLinks(standSlug?: string): Promise<TimelineBoardLinkRow[]> {
    await this.ensureSchema();
    if (standSlug) {
      return this.prisma.$queryRawUnsafe<TimelineBoardLinkRow[]>(
        `
          SELECT
            id, stand_slug AS "standSlug", board_id AS "boardId", board_title AS "boardTitle",
            timeline_url AS "timelineUrl", api_base_url AS "apiBaseUrl", token, token_prefix AS "tokenPrefix",
            cursor, last_synced_at::text AS "lastSyncedAt", last_error AS "lastError", created_at::text AS "createdAt"
          FROM projectarium_timeline_links WHERE stand_slug = $1
        `,
        standSlug,
      );
    }
    return this.prisma.$queryRawUnsafe<TimelineBoardLinkRow[]>(
      `
        SELECT
          id, stand_slug AS "standSlug", board_id AS "boardId", board_title AS "boardTitle",
          timeline_url AS "timelineUrl", api_base_url AS "apiBaseUrl", token, token_prefix AS "tokenPrefix",
          cursor, last_synced_at::text AS "lastSyncedAt", last_error AS "lastError", created_at::text AS "createdAt"
        FROM projectarium_timeline_links
      `,
    );
  }

  async syncStand(slugOrToken: string): Promise<{ syncedBoards: number; importedEvents: number }> {
    const standSlug = this.resolveStandSlug(slugOrToken);
    const links = await this.fetchRawLinks(standSlug);
    let importedEvents = 0;
    for (const link of links) {
      importedEvents += await this.pullLink(link);
    }
    return { syncedBoards: links.length, importedEvents };
  }

  async syncAll(): Promise<void> {
    if (!this.schemaReady) return;
    try {
      const links = await this.fetchRawLinks();
      for (const link of links) {
        await this.pullLink(link);
      }
    } catch (err) {
      this.logger.debug(`Periodic timeline sync skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async pullLink(link: TimelineBoardLinkRow): Promise<number> {
    const url = new URL(`${link.apiBaseUrl}/timelines/chronicle`);
    url.searchParams.set('boardId', link.boardId);
    url.searchParams.set('limit', '100');
    if (link.cursor) url.searchParams.set('since', link.cursor);

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${link.token}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        items?: Array<{
          externalRef: string;
          origin?: string;
          title?: string;
          description: string;
          scope?: 'PROJECT' | 'APP';
          targetAppName?: string;
          author?: string;
        }>;
        nextCursor?: string | null;
      };

      const items = data.items || [];
      let imported = 0;
      for (const item of items) {
        if (item.origin === 'PROJECTARIUM') continue;
        const already = await this.prisma.$queryRawUnsafe<Array<{ external_ref: string }>>(
          `SELECT external_ref FROM projectarium_timeline_synced_refs WHERE stand_slug = $1 AND external_ref = $2`,
          link.standSlug,
          item.externalRef,
        );
        if (already.length > 0) continue;

        const text = item.title ? `${item.title}: ${item.description}` : item.description;
        const created = await this.projectarium.addChronicleEvent(link.standSlug, {
          description: text,
          scope: item.scope === 'APP' ? 'APP' : 'PROJECT',
          targetAppName: item.targetAppName,
          author: item.author || 'TimeLine',
        });
        this.skipPushEventIds.add(created.id);

        await this.prisma.$executeRawUnsafe(
          `INSERT INTO projectarium_timeline_synced_refs (stand_slug, external_ref) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          link.standSlug,
          item.externalRef,
        );
        imported += 1;
      }

      await this.prisma.$executeRawUnsafe(
        `UPDATE projectarium_timeline_links SET cursor = COALESCE($2, cursor), last_synced_at = NOW(), last_error = NULL WHERE id = $1`,
        link.id,
        data.nextCursor ?? null,
      );
      return imported;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.$executeRawUnsafe(
        `UPDATE projectarium_timeline_links SET last_error = $2 WHERE id = $1`,
        link.id,
        message,
      );
      return 0;
    }
  }

  private async pushEventToTimelines(
    standSlug: string,
    event: {
      id: string;
      description: string;
      type?: string;
      scope?: string;
      targetAppName?: string;
      author?: string;
      timestamp?: string;
    },
  ): Promise<void> {
    const links = await this.fetchRawLinks(standSlug);
    if (links.length === 0) return;

    const externalRef = `projectarium:event:${event.id}`;
    for (const link of links) {
      try {
        const res = await fetch(`${link.apiBaseUrl}/timelines/chronicle/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${link.token}`,
          },
          body: JSON.stringify({
            boardId: link.boardId,
            externalRef,
            description: event.description,
            type: event.type === 'MILESTONE' || event.type === 'DEPLOY' ? event.type : 'NOTE',
            scope: event.scope === 'APP' ? 'APP' : 'PROJECT',
            targetAppName: event.targetAppName,
            author: event.author,
            timestamp: event.timestamp,
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.prisma.$executeRawUnsafe(
          `UPDATE projectarium_timeline_links SET last_error = $2 WHERE id = $1`,
          link.id,
          message,
        );
      }
    }
  }
}
