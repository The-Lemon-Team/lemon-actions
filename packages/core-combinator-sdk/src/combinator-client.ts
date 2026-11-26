import { BatchModule } from './modules/batch.module';
import { ChronicleModule } from './modules/chronicle.module';
import { LeaseGuard, LeaseGuardOptions } from './modules/lease.guard';
import { NeuronsModule } from './modules/neurons.module';
import { StreamModule } from './modules/stream.module';

export interface CoreCombinatorClientOptions {
  baseUrl: string;
  token?: string;
  profileId?: string;
  projectSlug?: string;
}

export interface ProjectShardResolutionOptions {
  projectSlug: string;
  projectariumUrl: string;
  fallbackBaseUrl?: string;
  token?: string;
  profileId?: string;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
}

export interface ResolvedProjectShard {
  projectSlug: string;
  mode: 'dedicated-shard' | 'shared-logical';
  apiBaseUrl: string;
  shard: Record<string, any> | null;
  resolvedAt: string;
}

const shardResolutionCache = new Map<
  string,
  { resolution: ResolvedProjectShard; expiresAt: number }
>();

export interface HttpClient {
  get: <T>(path: string, params?: Record<string, any>) => Promise<T>;
  post: <T>(path: string, body?: any) => Promise<T>;
  patch: <T>(path: string, body?: any) => Promise<T>;
}

export class CoreCombinatorClient {
  private _baseUrl: string;
  private _projectSlug?: string;
  private _shardResolution?: ResolvedProjectShard;
  public readonly neurons: NeuronsModule;
  public readonly batch: BatchModule;
  public readonly chronicle: ChronicleModule;
  public readonly stream: StreamModule;
  private readonly http: HttpClient;

  constructor(
    private readonly options: CoreCombinatorClientOptions,
    shardResolution?: ResolvedProjectShard,
  ) {
    this._baseUrl = options.baseUrl.replace(/\/+$/, '');
    this._projectSlug = options.projectSlug;
    this._shardResolution = shardResolution;

    this.http = {
      get: async <T>(path: string, params?: Record<string, any>): Promise<T> => {
        const url = new URL(`${this._baseUrl}${path.startsWith('/') ? path : '/' + path}`);
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
          }
        }
        const res = await fetch(url.toString(), {
          headers: this.buildHeaders(),
        });
        if (!res.ok) {
          throw new Error(`[CoreCombinator HTTP ${res.status}] ${await res.text()}`);
        }
        return res.json() as Promise<T>;
      },
      post: async <T>(path: string, body?: any): Promise<T> => {
        const url = `${this._baseUrl}${path.startsWith('/') ? path : '/' + path}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          throw new Error(`[CoreCombinator HTTP ${res.status}] ${await res.text()}`);
        }
        return res.json() as Promise<T>;
      },
      patch: async <T>(path: string, body?: any): Promise<T> => {
        const url = `${this._baseUrl}${path.startsWith('/') ? path : '/' + path}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: this.buildHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          throw new Error(`[CoreCombinator HTTP ${res.status}] ${await res.text()}`);
        }
        return res.json() as Promise<T>;
      },
    };

    this.stream = new StreamModule(() => this._baseUrl);
    this.neurons = new NeuronsModule(this.http);
    this.batch = new BatchModule(this.http, this.stream);
    this.chronicle = new ChronicleModule(this.http);
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  get shardResolution(): ResolvedProjectShard | undefined {
    return this._shardResolution;
  }

  /**
   * Resolves the target shard for `projectSlug` and retargets this client instance in-place.
   */
  async resolveAndAttachShard(
    options: ProjectShardResolutionOptions,
  ): Promise<ResolvedProjectShard> {
    const resolution = await CoreCombinatorClient.resolveShard({
      ...options,
      fallbackBaseUrl: options.fallbackBaseUrl ?? this._baseUrl,
    });
    this._baseUrl = resolution.apiBaseUrl.replace(/\/+$/, '');
    this._projectSlug = resolution.projectSlug;
    this._shardResolution = resolution;
    return resolution;
  }

  /**
   * Захватывает эксклюзивный лиз мьютекса с автоматическим фоновым heart-beat пульсом.
   */
  async acquireLease(flowId: string, options: LeaseGuardOptions = {}): Promise<LeaseGuard> {
    await this.updateFlowStatus(flowId, 'ACTIVE');

    return new LeaseGuard(
      flowId,
      {
        updateFlowStatus: (id, status) => this.updateFlowStatus(id, status),
        touchFlow: (id) => this.touchFlow(id),
      },
      options,
    );
  }

  async updateFlowStatus(flowId: string, status: string): Promise<any> {
    const url = `${this._baseUrl}/flows/${flowId}/status`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.buildHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`[CoreCombinator updateFlowStatus ${res.status}] ${await res.text()}`);
    }
    return res.json();
  }

  async touchFlow(flowId: string): Promise<void> {
    const url = `${this._baseUrl}/flows/${flowId}/trigger`;
    await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ action: 'heartbeat' }),
    });
  }

  /**
   * Получение метрик оптимизации нагрузки на потоки от Core Combinator Engine.
   */
  async getOptimizationMetrics(): Promise<any> {
    return this.http.get('/flows/stream/metrics');
  }

  /**
   * Логирование начала сессии / открытия клиента кодинг-агента.
   */
  async startAgentSession(input: {
    clientId: string;
    clientVersion?: string;
    agentRole?: string;
    workspaceRoot?: string;
    repoName?: string;
    environment?: string;
  }): Promise<any> {
    return this.http.post('/flows/agent/session/start', input);
  }

  /**
   * Легковесный heart-beat агента (коалесцируется StreamOptimizer без лишней нагрузки на БД).
   */
  async sendAgentHeartbeat(sessionId: string): Promise<any> {
    return this.http.post('/flows/agent/session/heartbeat', { sessionId });
  }

  /**
   * Запись архитектурного решения / мысли агента в память.
   */
  async recordAgentDecision(input: {
    sessionId: string;
    title: string;
    rationaleMarkdown: string;
    tags?: string[];
    repoName?: string;
    flowId?: string;
  }): Promise<any> {
    return this.http.post('/flows/agent/decision', input);
  }

  /**
   * Выполнение коммита в конце дня и отправка сформированной выжимки (Daily Digest Snapshot).
   */
  async commitDailyDigest(input: {
    repoPath?: string;
    commitMessage?: string;
    date?: string;
  }): Promise<any> {
    return this.http.post('/flows/agent/digest/eod-commit', input);
  }

  /**
   * Получение выжимки за день.
   */
  async getDailyDigest(date?: string): Promise<any> {
    return this.http.get('/flows/agent/digest/today', { date });
  }

  /**
   * Получение структурированной истории сессий и решений.
   */
  async getAgentHistory(repoName?: string): Promise<any> {
    return this.http.get('/flows/agent/history', { repoName });
  }

  /**
   * Resolves the target Core Shard base URL for a given projectSlug via Projectarium,
   * falling back to Main Shard (shared-logical) when no dedicated shard is active.
   */
  static async resolveShard(
    options: ProjectShardResolutionOptions,
  ): Promise<ResolvedProjectShard> {
    const slug = options.projectSlug.trim().toLowerCase();
    const projectariumBase = options.projectariumUrl.replace(/\/+$/, '');
    const fallbackUrl = (options.fallbackBaseUrl || projectariumBase).replace(/\/+$/, '');
    const cacheKey = `${projectariumBase}::${slug}`;
    const ttlMs = options.cacheTtlMs ?? 30_000;

    if (!options.forceRefresh) {
      const cached = shardResolutionCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.resolution;
      }
    }

    try {
      const url = `${projectariumBase}/projectarium/shards/resolve?projectSlug=${encodeURIComponent(slug)}`;
      const headers: Record<string, string> = {};
      if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = (await res.json()) as ResolvedProjectShard;
        const resolution: ResolvedProjectShard = {
          projectSlug: data.projectSlug || slug,
          mode: data.mode || 'shared-logical',
          apiBaseUrl: (data.apiBaseUrl || fallbackUrl).replace(/\/+$/, ''),
          shard: data.shard ?? null,
          resolvedAt: data.resolvedAt || new Date().toISOString(),
        };
        shardResolutionCache.set(cacheKey, {
          resolution,
          expiresAt: Date.now() + ttlMs,
        });
        return resolution;
      }
    } catch {
      // Fallback to shared-logical Main Shard when Projectarium discovery is unreachable
    }

    return {
      projectSlug: slug,
      mode: 'shared-logical',
      apiBaseUrl: fallbackUrl,
      shard: null,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Creates a shard-aware CoreCombinatorClient bound to a specific projectSlug.
   */
  static async forProject(
    options: ProjectShardResolutionOptions,
  ): Promise<CoreCombinatorClient> {
    const resolution = await CoreCombinatorClient.resolveShard(options);
    return new CoreCombinatorClient(
      {
        baseUrl: resolution.apiBaseUrl,
        token: options.token,
        profileId: options.profileId,
        projectSlug: resolution.projectSlug,
      },
      resolution,
    );
  }

  static clearShardCache(): void {
    shardResolutionCache.clear();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.options.token) {
      headers['Authorization'] = `Bearer ${this.options.token}`;
    }
    if (this.options.profileId) {
      headers['x-profile-id'] = this.options.profileId;
    }
    if (this._projectSlug) {
      headers['x-project-slug'] = this._projectSlug;
    }
    return headers;
  }
}
