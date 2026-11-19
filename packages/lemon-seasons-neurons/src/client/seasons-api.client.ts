import {
  IngestSeasonNoteInput,
  NoteMediaAttachmentInput,
  NotesPageQuery,
  NoteTodoItem,
  NoteTodoStats,
  PaginatedNotesWindow,
  SeasonsTopologySnapshot,
  ShareFeedInput,
  ShareNoteInput,
  TopologyAuthorFacet,
  TopologyDateBucket,
  TopologyFacetItem,
  TopologyFeedNode,
  TopologyStreamNode,
} from '../types/seasons.types';

export interface SeasonsApiClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

const TODO_SECTION_START = '<!-- lemon-todolist:start -->';
const TODO_SECTION_END = '<!-- lemon-todolist:end -->';

export function computeTodoStats(todoList: NoteTodoItem[]): NoteTodoStats {
  const total = todoList.length;
  const completed = todoList.filter((t) => Boolean(t.completed)).length;
  return { total, completed, pending: total - completed };
}

export function renderTodoListMarkdown(todoList: NoteTodoItem[]): string {
  if (!todoList.length) {
    return `${TODO_SECTION_START}\n_Список задач пуст_\n${TODO_SECTION_END}`;
  }
  const lines = todoList.map((t) => {
    const check = t.completed ? 'x' : ' ';
    const scopeTag = t.targetAppName ? ` [${t.targetAppName}]` : '';
    const prio = t.priority && t.priority !== 'MEDIUM' ? ` (${t.priority})` : '';
    return `- [${check}] ${t.title}${scopeTag}${prio}`;
  });
  return `${TODO_SECTION_START}\n### Todo List\n${lines.join('\n')}\n${TODO_SECTION_END}`;
}

export function mergeTodoMarkdownIntoContent(baseContent: string, todoList: NoteTodoItem[]): string {
  const block = renderTodoListMarkdown(todoList);
  const startIdx = baseContent.indexOf(TODO_SECTION_START);
  const endIdx = baseContent.indexOf(TODO_SECTION_END);

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = baseContent.slice(0, startIdx).trimEnd();
    const after = baseContent.slice(endIdx + TODO_SECTION_END.length).trimStart();
    return [before, block, after].filter(Boolean).join('\n\n');
  }

  const trimmed = baseContent.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

export function extractTodoListFromNote(note: any): NoteTodoItem[] {
  const list = note?.metadata?.todoList ?? note?.todoList;
  if (!Array.isArray(list)) return [];
  return list.map((item: any, idx: number) => ({
    id: String(item?.id || `todo-${idx + 1}`),
    title: String(item?.title || '').trim(),
    completed: Boolean(item?.completed),
    priority: item?.priority || 'MEDIUM',
    scope: item?.scope || 'PROJECT',
    targetAppName: item?.targetAppName,
    author: item?.author,
    createdAt: item?.createdAt,
    completedAt: item?.completedAt ?? null,
  }));
}

export function extractNoteMedia(note: any): NoteMediaAttachmentInput[] {
  const result: NoteMediaAttachmentInput[] = [];
  const seen = new Set<string>();

  const pushUnique = (raw: any) => {
    if (!raw || typeof raw !== 'object') return;
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    const mediaAssetId =
      typeof raw.mediaAssetId === 'string'
        ? raw.mediaAssetId.trim()
        : typeof raw.assetId === 'string'
          ? raw.assetId.trim()
          : undefined;
    const key = mediaAssetId ? `asset:${mediaAssetId}` : `url:${url}`;
    if ((!url && !mediaAssetId) || seen.has(key)) return;
    seen.add(key);

    result.push({
      url: url || (mediaAssetId ? `/api/assets/${mediaAssetId}/file` : ''),
      thumbnailUrl: raw.thumbnailUrl || url,
      filename: raw.filename,
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes,
      width: raw.width ?? null,
      height: raw.height ?? null,
      caption: raw.caption,
      alt: raw.alt || raw.caption,
      isMain: Boolean(raw.isMain),
      mediaAssetId,
    });
  };

  if (Array.isArray(note?.images)) {
    for (const img of note.images) {
      pushUnique(typeof img === 'string' ? { url: img } : img);
    }
  }
  if (Array.isArray(note?.metadata?.mediaAssets)) {
    for (const asset of note.metadata.mediaAssets) {
      pushUnique(asset);
    }
  }
  if (Array.isArray(note?.metadata?.images)) {
    for (const img of note.metadata.images) {
      pushUnique(img);
    }
  }

  return result;
}

export class SeasonsApiClient {
  public readonly baseUrl: string;
  private token?: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: SeasonsApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.fetchFn = options.fetchImpl || globalThis.fetch;
  }

  setToken(token?: string): void {
    this.token = token;
  }

  getToken(): string | undefined {
    return this.token;
  }

  async getTopology(params?: {
    streamSlug?: string;
    privacy?: 'public' | 'private' | 'all';
    days?: number;
  }): Promise<SeasonsTopologySnapshot> {
    const qs = this.buildQuery(params || {});
    return this.request<SeasonsTopologySnapshot>(`/api/v1/topology${qs}`);
  }

  async getStreamTopology(
    streamIdOrSlug: string,
    params?: { days?: number },
  ): Promise<{
    revision: number;
    stream: TopologyStreamNode;
    dateBuckets: TopologyDateBucket[];
    authors: TopologyAuthorFacet[];
    hashtags: TopologyFacetItem[];
  }> {
    const qs = this.buildQuery(params || {});
    return this.request(`/api/v1/topology/streams/${encodeURIComponent(streamIdOrSlug)}${qs}`);
  }

  async getFeedTopology(
    feedIdOrSlug: string,
    params?: { days?: number },
  ): Promise<{
    revision: number;
    feed: TopologyFeedNode;
    dateBuckets: TopologyDateBucket[];
    authors: TopologyAuthorFacet[];
    hashtags: TopologyFacetItem[];
  }> {
    const qs = this.buildQuery(params || {});
    return this.request(`/api/v1/topology/feeds/${encodeURIComponent(feedIdOrSlug)}${qs}`);
  }

  async getNotesPage<T = any>(query: NotesPageQuery = {}): Promise<PaginatedNotesWindow<T>> {
    const safeLimit = Math.min(200, Math.max(1, query.limit ?? 30));
    const safeOffset = Math.max(0, query.offset ?? 0);
    const qs = this.buildQuery({ ...query, limit: safeLimit, offset: safeOffset });
    const res = await this.request<{ total: number; limit: number; offset: number; items: T[] }>(
      `/api/v1/notes${qs}`,
    );
    return {
      total: res.total,
      limit: res.limit,
      offset: res.offset,
      hasMore: res.offset + res.items.length < res.total,
      items: res.items,
    };
  }

  async getFeedNotesPage<T = any>(
    feedIdOrSlug: string,
    query: Omit<NotesPageQuery, 'feedId' | 'feedSlug'> = {},
  ): Promise<PaginatedNotesWindow<T>> {
    const safeLimit = Math.min(200, Math.max(1, query.limit ?? 30));
    const safeOffset = Math.max(0, query.offset ?? 0);
    const qs = this.buildQuery({ ...query, limit: safeLimit, offset: safeOffset });
    const res = await this.request<{ total: number; limit: number; offset: number; items: T[] }>(
      `/api/v1/feeds/${encodeURIComponent(feedIdOrSlug)}/notes${qs}`,
    );
    return {
      total: res.total,
      limit: res.limit,
      offset: res.offset,
      hasMore: res.offset + res.items.length < res.total,
      items: res.items,
    };
  }

  async getStreamNotesPage<T = any>(
    streamIdOrSlug: string,
    query: Omit<NotesPageQuery, 'streamSource'> = {},
  ): Promise<PaginatedNotesWindow<T>> {
    const safeLimit = Math.min(200, Math.max(1, query.limit ?? 30));
    const safeOffset = Math.max(0, query.offset ?? 0);
    const qs = this.buildQuery({ ...query, limit: safeLimit, offset: safeOffset });
    const res = await this.request<{ total: number; limit: number; offset: number; items: T[] }>(
      `/api/v1/streams/${encodeURIComponent(streamIdOrSlug)}/notes${qs}`,
    );
    return {
      total: res.total,
      limit: res.limit,
      offset: res.offset,
      hasMore: res.offset + res.items.length < res.total,
      items: res.items,
    };
  }

  async getNote<T = any>(noteId: string): Promise<T> {
    return this.request<T>(`/api/v1/notes/${encodeURIComponent(noteId)}`);
  }

  async ensureStream(input: {
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    privacy?: 'public' | 'private';
    feedIds?: string[];
    tags?: string[];
  }): Promise<any> {
    try {
      return await this.request(`/api/v1/streams/${encodeURIComponent(input.slug)}`);
    } catch {
      return this.request(`/api/v1/streams`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    }
  }

  async ensureFeed(input: {
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    privacy?: 'public' | 'private';
    folderPaths?: string[];
    hashtags?: string[];
  }): Promise<any> {
    try {
      return await this.request(`/api/v1/feeds/${encodeURIComponent(input.slug)}?includeNotes=false`);
    } catch {
      return this.request(`/api/v1/feeds`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    }
  }

  async attachFeedToStream(streamIdOrSlug: string, feedId: string): Promise<any> {
    return this.request(
      `/api/v1/streams/${encodeURIComponent(streamIdOrSlug)}/feeds/${encodeURIComponent(feedId)}`,
      { method: 'POST' },
    );
  }

  async ingestNote(input: IngestSeasonNoteInput): Promise<{
    success: boolean;
    action: 'CREATED' | 'UPDATED';
    isNew: boolean;
    noteId: string;
    note: any;
  }> {
    const payload = this.prepareIngestPayload(input);
    return this.request(`/api/v1/notes/ingest`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createNote(input: Record<string, any>): Promise<any> {
    return this.request(`/api/v1/notes`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateNote(noteId: string, patch: Record<string, any>): Promise<any> {
    return this.request(`/api/v1/notes/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async updateNoteTodoList(noteId: string, todoList: NoteTodoItem[]): Promise<any> {
    const current = await this.getNote<any>(noteId);
    const stats = computeTodoStats(todoList);
    const baseText = String(current?.rawContent ?? current?.description ?? '');
    const updatedContent = mergeTodoMarkdownIntoContent(baseText, todoList);

    return this.updateNote(noteId, {
      description: updatedContent,
      rawContent: updatedContent,
      metadata: {
        ...(current?.metadata || {}),
        todoList,
        todoStats: stats,
      },
    });
  }

  /**
   * Attaches Media Hub assets / external image descriptors to a Note in Lemon Seasons.
   * Uses `POST /api/v1/notes/:id/media-assets` and falls back to `PATCH /api/v1/notes/:id` metadata
   * if the server does not yet expose the media-assets endpoint.
   */
  async attachMediaAssets(
    noteId: string,
    items: NoteMediaAttachmentInput[],
  ): Promise<any> {
    if (!items.length) return [];
    try {
      return await this.request(`/api/v1/notes/${encodeURIComponent(noteId)}/media-assets`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    } catch {
      const current = await this.getNote<any>(noteId);
      const existingAssets = extractNoteMedia(current);
      const merged = [...existingAssets];
      for (const item of items) {
        const exists = merged.some(
          (m) =>
            (item.mediaAssetId && m.mediaAssetId === item.mediaAssetId) ||
            (item.url && m.url === item.url),
        );
        if (!exists) merged.push(item);
      }
      const mediaAssetIds = Array.from(
        new Set(merged.map((m) => m.mediaAssetId).filter((id): id is string => Boolean(id))),
      );
      return this.updateNote(noteId, {
        metadata: {
          ...(current?.metadata || {}),
          mediaAssets: merged,
          mediaAssetIds,
        },
      });
    }
  }

  async deleteNote(noteId: string): Promise<any> {
    return this.request(`/api/v1/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    });
  }

  async getWhoAmI(): Promise<{ id: string; role: string; isAdmin: boolean; name?: string }> {
    return this.request(`/api/v1/auth/me`);
  }

  async shareNote(noteId: string, input: ShareNoteInput): Promise<any[]> {
    return this.request(`/api/v1/notes/${encodeURIComponent(noteId)}/shares`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async revokeNoteShare(
    noteId: string,
    opts: { granteeUserId?: string; scopeRef?: string },
  ): Promise<{ revoked: number }> {
    const qs = this.buildQuery(opts);
    return this.request(`/api/v1/notes/${encodeURIComponent(noteId)}/shares${qs}`, {
      method: 'DELETE',
    });
  }

  async shareFeed(feedIdOrSlug: string, input: ShareFeedInput): Promise<any> {
    return this.request(`/api/v1/feeds/${encodeURIComponent(feedIdOrSlug)}/shares`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async revokeFeedShare(feedIdOrSlug: string, granteeUserId: string): Promise<{ revoked: number }> {
    return this.request(
      `/api/v1/feeds/${encodeURIComponent(feedIdOrSlug)}/shares/${encodeURIComponent(granteeUserId)}`,
      { method: 'DELETE' },
    );
  }

  private prepareIngestPayload(input: IngestSeasonNoteInput): IngestSeasonNoteInput {
    let result: IngestSeasonNoteInput = { ...input };
    let metadata: Record<string, any> = { ...(input.metadata || {}) };

    if (input.todoList) {
      const todoList = input.todoList;
      const todoStats = computeTodoStats(todoList);
      const content = mergeTodoMarkdownIntoContent(result.content || '', todoList);
      const { todoList: _omit, ...rest } = result;
      metadata = {
        ...metadata,
        todoList,
        todoStats,
      };
      result = {
        ...rest,
        content,
        summary: result.summary || `Todo list: ${todoStats.completed}/${todoStats.total} done`,
      };
    }

    const mediaList: NoteMediaAttachmentInput[] = [...(input.images || [])];
    if (input.imageUrl && !mediaList.some((m) => m.url === input.imageUrl)) {
      mediaList.unshift({
        url: input.imageUrl,
        thumbnailUrl: input.imageUrl,
        caption: input.imageCaption,
        isMain: true,
      });
    }
    const assetIds = Array.from(
      new Set([
        ...(input.mediaAssetIds || []),
        ...mediaList.map((m) => m.mediaAssetId).filter((id): id is string => Boolean(id)),
      ]),
    );

    if (mediaList.length > 0) {
      metadata.mediaAssets = mediaList;
    }
    if (assetIds.length > 0) {
      metadata.mediaAssetIds = assetIds;
    }

    if (Object.keys(metadata).length > 0) {
      result.metadata = metadata;
    }
    if (mediaList.length > 0) {
      result.images = mediaList;
    }
    if (assetIds.length > 0) {
      result.mediaAssetIds = assetIds;
    }

    return result;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (this.token) {
      if (!headers['Authorization']) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (!headers['x-api-key']) {
        headers['x-api-key'] = this.token;
      }
    }

    const res = await this.fetchFn(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[SeasonsAPI HTTP ${res.status}] ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  private buildQuery(params: Record<string, any>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (!entries.length) return '';
    return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }
}
