import {
  IngestSeasonNoteInput,
  NotesPageQuery,
  PaginatedNotesWindow,
  SeasonsTopologySnapshot,
} from '../types/seasons.types';

export interface SeasonsApiClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
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

  async getTopology(params?: {
    streamSlug?: string;
    privacy?: 'public' | 'private' | 'all';
  }): Promise<SeasonsTopologySnapshot> {
    const qs = this.buildQuery(params || {});
    return this.request<SeasonsTopologySnapshot>(`/api/v1/topology${qs}`);
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

  async ingestNote(input: IngestSeasonNoteInput): Promise<{
    success: boolean;
    action: 'CREATED' | 'UPDATED';
    isNew: boolean;
    noteId: string;
    note: any;
  }> {
    return this.request(`/api/v1/notes/ingest`, {
      method: 'POST',
      body: JSON.stringify(input),
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

  async deleteNote(noteId: string): Promise<any> {
    return this.request(`/api/v1/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
