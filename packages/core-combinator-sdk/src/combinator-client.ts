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

export class CoreCombinatorClient {
  public readonly baseUrl: string;
  public readonly neurons: NeuronsModule;
  public readonly batch: BatchModule;
  public readonly chronicle: ChronicleModule;
  public readonly stream: StreamModule;

  constructor(private readonly options: CoreCombinatorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');

    const http = {
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
    this.neurons = new NeuronsModule(http);
    this.batch = new BatchModule(http, this.stream);
    this.chronicle = new ChronicleModule(http);
  }

  /**
   * Захватывает эксклюзивный лиз мьютекса с автоматическим фоновым heart-beat пульсом.
   */
  async acquireLease(flowId: string, options: LeaseGuardOptions = {}): Promise<LeaseGuard> {
    // 1. Активируем поток MUTEX в Core Combinator
    await this.updateFlowStatus(flowId, 'ACTIVE');

    // 2. Возвращаем страж лиза
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
