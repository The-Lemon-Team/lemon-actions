export interface CreateChronicleEventDto {
  eventType: string;
  payload?: Record<string, any>;
  source?: string;
}

export class ChronicleModule {
  constructor(
    private readonly http: {
      post: <T>(path: string, body?: any) => Promise<T>;
      get: <T>(path: string, params?: Record<string, any>) => Promise<T>;
    },
  ) {}

  async emit(flowId: string, event: CreateChronicleEventDto): Promise<any> {
    return this.http.post(`/flows/${flowId}/events`, event);
  }

  async recordSuccess(flowId: string, payload?: Record<string, any>): Promise<any> {
    return this.emit(flowId, { eventType: 'SUCCESS', payload, source: 'worker' });
  }

  async recordFailure(flowId: string, error: string, payload?: Record<string, any>): Promise<any> {
    return this.emit(flowId, { eventType: 'FAILURE', payload: { error, ...payload }, source: 'worker' });
  }

  async recordMetric(flowId: string, metricName: string, value: number, payload?: Record<string, any>): Promise<any> {
    return this.emit(flowId, { eventType: 'METRIC', payload: { metric: metricName, value, ...payload }, source: 'worker' });
  }

  async list(flowId: string, sessionId?: string): Promise<any[]> {
    return this.http.get(`/flows/${flowId}/events`, { sessionId });
  }

  async listSessions(flowId: string): Promise<any[]> {
    return this.http.get(`/flows/${flowId}/sessions`);
  }
}
