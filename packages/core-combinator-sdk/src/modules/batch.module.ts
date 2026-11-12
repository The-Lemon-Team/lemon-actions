import { BatchFlushPacket } from '../types';

export class BatchModule {
  constructor(
    private readonly http: {
      post: <T>(path: string, body?: any) => Promise<T>;
      get: <T>(path: string) => Promise<T>;
    },
    private readonly stream: {
      subscribe: (filter: any, callback: (packet: any) => void) => () => void;
    },
  ) {}

  async push(flowId: string, payload: Record<string, any>, dedupKey?: string): Promise<any> {
    return this.http.post(`/flows/${flowId}/batch/push`, {
      items: [{ payload, dedupKey }],
    });
  }

  async pushMany(
    flowId: string,
    items: Array<{ payload: Record<string, any>; dedupKey?: string }>,
  ): Promise<any> {
    return this.http.post(`/flows/${flowId}/batch/push`, { items });
  }

  async flush(flowId: string): Promise<BatchFlushPacket> {
    return this.http.post(`/flows/${flowId}/batch/flush`);
  }

  async listItems(flowId: string): Promise<any[]> {
    return this.http.get(`/flows/${flowId}/batch/items`);
  }

  onFlush<T = any>(flowId: string, callback: (batch: BatchFlushPacket<T>) => void): () => void {
    return this.stream.subscribe({ flowId, impulseType: 'BATCH_FLUSH' }, (packet) => {
      callback(packet.payload as BatchFlushPacket<T>);
    });
  }
}
