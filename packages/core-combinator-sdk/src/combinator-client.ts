import { BatchModule } from './modules/batch.module';
import { ChronicleModule } from './modules/chronicle.module';
import { LeaseGuard, LeaseGuardOptions } from './modules/lease.guard';
import { NeuronsModule } from './modules/neurons.module';
import { StreamModule } from './modules/stream.module';

export interface CoreCombinatorClientOptions {
  baseUrl: string;
  token?: string;
  profileId?: string;
}

export interface HttpClient {
  get: <T>(path: string, params?: Record<string, any>) => Promise<T>;
  post: <T>(path: string, body?: any) => Promise<T>;
  patch: <T>(path: string, body?: any) => Promise<T>;
}

export class CoreCombinatorClient {
  public readonly baseUrl: string;
  public readonly neurons: NeuronsModule;
  public readonly batch: BatchModule;
  public readonly chronicle: ChronicleModule;
  public readonly stream: StreamModule;
  private readonly http: HttpClient;

  constructor(private readonly options: CoreCombinatorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');

    this.http = {
      get: async <T>(path: string, params?: Record<string, any>): Promise<T> => {
        const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`);
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
        const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
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
        const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
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

    this.stream = new StreamModule(this.baseUrl);
    this.neurons = new NeuronsModule(this.http);
    this.batch = new BatchModule(this.http, this.stream);
    this.chronicle = new ChronicleModule(this.http);
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
    const url = `${this.baseUrl}/flows/${flowId}/status`;
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
    const url = `${this.baseUrl}/flows/${flowId}/trigger`;
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
    return headers;
  }
}
