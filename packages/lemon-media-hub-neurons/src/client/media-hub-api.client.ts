import {
  AssetLineage,
  MediaAsset,
  MediaFolder,
  MediaServiceClient,
  MediaSignedUrlResult,
  MediaVisibility,
  QueryAssetsOptions,
  UploadMediaInput,
} from '../types/media.types';

export interface MediaHubApiClientOptions {
  baseUrl?: string;
  token?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class MediaHubApiClient {
  public readonly baseUrl: string;
  private token?: string;
  private apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: MediaHubApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:3005').replace(/\/+$/, '');
    this.token = options.token;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 20000;
  }

  setToken(token?: string): void {
    this.token = token;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.apiKey) headers['X-Media-Api-Key'] = this.apiKey;
    return headers;
  }

  getAuthQueryParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (this.token) params.set('token', this.token);
    else if (this.apiKey) params.set('apiKey', this.apiKey);
    return params;
  }

  resolveUrl(relativeOrAbsolute: string): string {
    if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
    const clean = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
    return `${this.baseUrl}${clean}`;
  }

  async loginAdmin(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; admin: { username: string; role: string } }> {
    const res = await this.request<{ accessToken: string; admin: { username: string; role: string } }>(
      'POST',
      '/api/auth/login',
      { username, password },
    );
    this.token = res.accessToken;
    return res;
  }

  async health(): Promise<Record<string, any>> {
    return this.request('GET', '/api/health');
  }

  async listFolders(): Promise<MediaFolder[]> {
    return this.request<MediaFolder[]>('GET', '/api/folders');
  }

  async createFolder(input: {
    name: string;
    path?: string;
    parentId?: string;
    icon?: string;
    color?: string;
    defaultVisibility?: MediaVisibility;
  }): Promise<MediaFolder> {
    return this.request<MediaFolder>('POST', '/api/folders', input);
  }

  async deleteFolder(folderId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/api/folders/${folderId}`);
  }

  async listAssets(query?: QueryAssetsOptions): Promise<{ items: MediaAsset[]; total: number }> {
    const params = new URLSearchParams();
    if (query) {
      if (query.kind) params.set('kind', query.kind);
      if (query.visibility) params.set('visibility', query.visibility);
      if (query.processingStatus) params.set('processingStatus', query.processingStatus);
      if (query.folderId) params.set('folderId', query.folderId);
      if (query.folderPath) params.set('folderPath', query.folderPath);
      if (query.search) params.set('search', query.search);
      if (query.style) params.set('style', query.style);
      if (query.tag) params.set('tag', query.tag);
      if (query.isFavorite !== undefined) params.set('isFavorite', String(query.isFavorite));
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      if (query.offset !== undefined) params.set('offset', String(query.offset));
    }
    const qs = params.toString();
    return this.request<{ items: MediaAsset[]; total: number }>(
      'GET',
      `/api/assets${qs ? `?${qs}` : ''}`,
    );
  }

  async getAsset(id: string): Promise<MediaAsset> {
    return this.request<MediaAsset>('GET', `/api/assets/${id}`);
  }

  async getAssetLineage(id: string): Promise<AssetLineage> {
    return this.request<AssetLineage>('GET', `/api/assets/${id}/lineage`);
  }

  async upload(input: UploadMediaInput): Promise<MediaAsset> {
    const form = new FormData();
    const blob = this.toBlob(input.file, input.mimeType);
    form.append('file', blob, input.filename);

    const optionalFields: Array<[string, string | undefined]> = [
      ['folderPath', input.folderPath],
      ['tags', input.tags?.join(',')],
      ['title', input.title],
      ['description', input.description],
      ['visibility', input.visibility],
      ['allowedClients', input.allowedClients?.join(',')],
      ['aiRequestId', input.aiRequestId],
      ['sourceAssetId', input.sourceAssetId],
      ['prompt', input.prompt],
      ['userPrompt', input.userPrompt],
      ['style', input.style],
      ['aspectRatio', input.aspectRatio],
      ['model', input.model],
    ];
    for (const [key, val] of optionalFields) {
      if (val !== undefined && val !== '') {
        form.append(key, val);
      }
    }

    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/assets/upload`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: form,
    });
    if (!res.ok) {
      throw new Error(`[MediaHub upload HTTP ${res.status}] ${await res.text()}`);
    }
    return res.json() as Promise<MediaAsset>;
  }

  async updateMetadata(
    id: string,
    patch: { title?: string; description?: string; folderPath?: string; tags?: string[] },
  ): Promise<MediaAsset> {
    return this.request<MediaAsset>('PATCH', `/api/assets/${id}`, patch);
  }

  async updateAccess(
    id: string,
    patch: {
      visibility: MediaVisibility;
      clients?: Array<{ clientSlug: string; permission?: 'READ' | 'WRITE'; expiresAt?: string }>;
    },
  ): Promise<MediaAsset> {
    return this.request<MediaAsset>('PATCH', `/api/assets/${id}/access`, patch);
  }

  async createSignedUrl(
    id: string,
    options?: { variant?: string; ttlSeconds?: number },
  ): Promise<MediaSignedUrlResult> {
    return this.request<MediaSignedUrlResult>('POST', `/api/assets/${id}/signed-url`, options || {});
  }

  async reprocess(id: string): Promise<MediaAsset> {
    return this.request<MediaAsset>('POST', `/api/assets/${id}/reprocess`);
  }

  async toggleFavorite(id: string): Promise<MediaAsset> {
    return this.request<MediaAsset>('PATCH', `/api/assets/${id}/favorite`);
  }

  async incrementUsage(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', `/api/assets/${id}/usage`);
  }

  async deleteAsset(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/api/assets/${id}`);
  }

  async listClients(): Promise<MediaServiceClient[]> {
    return this.request<MediaServiceClient[]>('GET', '/api/clients');
  }

  async createClient(input: {
    slug: string;
    name: string;
    scopes?: string[];
  }): Promise<MediaServiceClient> {
    return this.request<MediaServiceClient>('POST', '/api/clients', input);
  }

  async rotateClientKey(id: string): Promise<MediaServiceClient> {
    return this.request<MediaServiceClient>('POST', `/api/clients/${id}/rotate-key`);
  }

  async fetchAssetStream(
    id: string,
    variant?: string,
    rangeHeader?: string,
  ): Promise<Response> {
    const cleanVariant = variant ? `/${encodeURIComponent(variant)}` : '';
    const url = `${this.baseUrl}/api/media/${encodeURIComponent(id)}/file${cleanVariant}`;
    const headers: Record<string, string> = { ...this.getAuthHeaders() };
    if (rangeHeader) {
      headers.Range = rangeHeader;
    }
    return this.fetchWithTimeout(url, { method: 'GET', headers });
  }

  private toBlob(data: Blob | Uint8Array | ArrayBuffer, mimeType?: string): Blob {
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return data;
    }
    if (data instanceof Uint8Array) {
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      return new Blob([copy.buffer], { type: mimeType || 'application/octet-stream' });
    }
    return new Blob([data], { type: mimeType || 'application/octet-stream' });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...this.getAuthHeaders() };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`[MediaHub ${method} ${path} HTTP ${res.status}] ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }
}
