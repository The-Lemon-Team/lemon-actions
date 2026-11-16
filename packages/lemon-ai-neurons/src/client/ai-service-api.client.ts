import {
  AiClientApp,
  AiHealthResponse,
  AiHistoryPage,
  AiHistoryQuery,
  AiRequestLog,
  AiStatusResponse,
  AiUsageStats,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  CreatedAiClientResponse,
  CreateAiClientInput,
  GeneratedNoteResult,
  GenerateImagesRequest,
  GenerateImagesResponse,
  GenerateNoteRequest,
  GenerateTextRequest,
  GenerateTextResponse,
  ParseQuickAddRequest,
  QuickAddParsedResult,
  RemixImageRequest,
  RemixImageResponse,
} from '../types/ai.types';

export interface AiServiceApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Typed HTTP client for Lemon AI Service (Umniy Lemon).
 * Supports text/note generation, quick-add parsing, image generation, remixing,
 * vision analysis, PostgreSQL request history, usage stats, and AI client management.
 */
export class AiServiceApiClient {
  public readonly baseUrl: string;
  private apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: AiServiceApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:3006').replace(/\/+$/, '');
    this.apiKey = options.apiKey?.trim() || undefined;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchFn = options.fetchImpl || globalThis.fetch;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey?.trim() || undefined;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  getAuthHeaders(): Record<string, string> {
    return this.apiKey ? { 'X-Ai-Api-Key': this.apiKey } : {};
  }

  async health(): Promise<AiHealthResponse> {
    return this.request<AiHealthResponse>('GET', '/api/health', undefined, 5_000);
  }

  async status(): Promise<AiStatusResponse> {
    return this.request<AiStatusResponse>('GET', '/api/ai/status', undefined, 5_000);
  }

  async generateText(input: GenerateTextRequest): Promise<GenerateTextResponse> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<GenerateTextResponse>('POST', '/api/ai/generate-text', body);
  }

  async generateNote(input: GenerateNoteRequest): Promise<GeneratedNoteResult> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<GeneratedNoteResult>('POST', '/api/ai/generate-note', body);
  }

  async parseQuickAdd(input: ParseQuickAddRequest): Promise<QuickAddParsedResult> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<QuickAddParsedResult>('POST', '/api/ai/parse-quick-add', body);
  }

  async generateImages(input: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<GenerateImagesResponse>('POST', '/api/ai/generate-images', body, 90_000);
  }

  async remixImage(input: RemixImageRequest): Promise<RemixImageResponse> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<RemixImageResponse>('POST', '/api/ai/remix-image', body, 90_000);
  }

  async analyzeImage(input: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
    const { combinatorFlowId: _omit, ...body } = input;
    return this.request<AnalyzeImageResponse>('POST', '/api/ai/analyze-image', body);
  }

  async getHistory(query: AiHistoryQuery = {}): Promise<AiHistoryPage> {
    const params = new URLSearchParams();
    if (query.clientSlug) params.set('clientSlug', query.clientSlug);
    if (query.taskType) params.set('taskType', query.taskType);
    if (query.status) params.set('status', query.status);
    if (query.correlationId) params.set('correlationId', query.correlationId);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    const qs = params.toString();
    return this.request<AiHistoryPage>('GET', `/api/ai/history${qs ? `?${qs}` : ''}`);
  }

  async getHistoryStats(): Promise<AiUsageStats> {
    return this.request<AiUsageStats>('GET', '/api/ai/history/stats');
  }

  async getHistoryById(id: string): Promise<AiRequestLog> {
    return this.request<AiRequestLog>('GET', `/api/ai/history/${encodeURIComponent(id)}`);
  }

  async listClients(): Promise<AiClientApp[]> {
    return this.request<AiClientApp[]>('GET', '/api/ai/clients');
  }

  async createClient(input: CreateAiClientInput): Promise<CreatedAiClientResponse> {
    return this.request<CreatedAiClientResponse>('POST', '/api/ai/clients', input);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutOverrideMs?: number,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.getAuthHeaders(),
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutOverrideMs ?? this.timeoutMs);

    try {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`[UmniyLemon ${method} ${path} HTTP ${res.status}] ${text || res.statusText}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }
}
