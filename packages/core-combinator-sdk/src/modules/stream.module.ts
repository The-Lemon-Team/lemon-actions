import { FlowImpulsePacket } from '../types';

export interface StreamSubscriptionOptions {
  folderId?: string;
  flowId?: string;
  flowType?: string;
  impulseType?: string;
}

export class StreamModule {
  private readonly getBaseUrl: () => string;

  constructor(baseUrlOrProvider: string | (() => string)) {
    this.getBaseUrl =
      typeof baseUrlOrProvider === 'function' ? baseUrlOrProvider : () => baseUrlOrProvider;
  }

  subscribe(
    options: StreamSubscriptionOptions,
    callback: (packet: FlowImpulsePacket) => void,
  ): () => void {
    const params = new URLSearchParams();
    if (options.folderId) params.set('folderId', options.folderId);
    if (options.flowId) params.set('flowId', options.flowId);
    if (options.flowType) params.set('flowType', options.flowType);
    if (options.impulseType) params.set('impulseType', options.impulseType);

    const qs = params.toString();
    const url = `${this.getBaseUrl().replace(/\/+$/, '')}/flows/stream${qs ? '?' + qs : ''}`;

    const esFactory = (globalThis as any).EventSource;
    if (typeof esFactory !== 'undefined') {
      const es = new esFactory(url);
      es.onmessage = (event: any) => {
        try {
          const packet = JSON.parse(event.data);
          callback(packet);
        } catch {
          // Ignored unparsable packet
        }
      };

      return () => {
        es.close();
      };
    }

    // Node.js fallback using native fetch ReadableStream
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'text/event-stream' },
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const data = JSON.parse(trimmed.slice(5).trim());
                callback(data);
              } catch {
                // Ignore partial/comment
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Stream disconnected or error
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }
}
