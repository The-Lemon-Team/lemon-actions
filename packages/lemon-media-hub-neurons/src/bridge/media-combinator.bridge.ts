import { CompositeNeuronInstance, CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';

export interface MediaCombinatorBridgeOptions {
  apiClient: MediaHubApiClient;
  sseBus?: MediaSseBus;
  combinator?: CoreCombinatorClient;
  profileId?: string;
  basePath?: string;
  /** If true (default), Core Combinator telemetry failures do not fail media operations */
  bestEffortTelemetry?: boolean;
}

export interface MediaCompositeNeurons {
  library?: CompositeNeuronInstance;
  ingest?: CompositeNeuronInstance;
  delete?: CompositeNeuronInstance;
  view?: CompositeNeuronInstance;
}

/**
 * Bridge connecting Lemon Media Hub (HTTP + SSE) with Core Combinator Composite Neurons.
 * Direct analogy of SeasonsCombinatorBridge:
 * - Registers Composite Neurons for `media-hub/library`, `media-hub/ingest`, `media-hub/delete`, and `media-hub/view`
 * - Emits Chronicle events (`MEDIA_ADDED`, `MEDIA_READY`, `MEDIA_DELETED`, `MEDIA_VIEWED`, `FAILURE`)
 * - Gracefully degrades to standalone RxJS + SSE when Core Combinator is not attached.
 */
export class MediaCombinatorBridge {
  public readonly apiClient: MediaHubApiClient;
  public readonly sseBus?: MediaSseBus;
  public readonly combinator?: CoreCombinatorClient;
  public readonly profileId?: string;
  public readonly basePath: string;
  private readonly bestEffortTelemetry: boolean;
  private neurons: MediaCompositeNeurons = {};

  constructor(options: MediaCombinatorBridgeOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
    this.combinator = options.combinator;
    this.profileId = options.profileId;
    this.basePath = (options.basePath || 'media_hub')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '.')
      .replace(/-/g, '_') || 'media_hub';
    this.bestEffortTelemetry = options.bestEffortTelemetry ?? true;
  }

  get registeredNeurons(): MediaCompositeNeurons {
    return this.neurons;
  }

  /**
   * Idempotently ensures Composite Neurons for Media Hub operations in Core Combinator.
   */
  async ensureMediaTopology(): Promise<MediaCompositeNeurons> {
    if (!this.combinator) {
      return this.neurons;
    }

    const [library, ingest, del, view] = await Promise.all([
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Media Library',
        path: `${this.basePath}.library`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              baseUrl: this.apiClient.baseUrl,
              capabilities: ['image', 'video', 'audio', 'access-control'],
            },
          },
          observer: {},
        },
      }),
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Media Ingest Flow',
        path: `${this.basePath}.ingest`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'upload -> sharp/pg-boss -> ready',
            },
          },
          batch: {
            maxBatchSize: 10,
            maxWaitSeconds: 30,
            idleTimeoutSeconds: 5,
            deduplicationKey: 'dedupKey',
          },
          mutex: {
            isExclusive: false,
            onConflict: 'queue',
            leaseTimeoutSeconds: 120,
          },
          circuitBreaker: {
            failureThreshold: 5,
            cooldownSeconds: 30,
            successThreshold: 2,
          },
          observer: {},
        },
      }),
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Media Delete Flow',
        path: `${this.basePath}.delete`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'mutex -> db+disk-cleanup -> sse-evict',
            },
          },
          mutex: {
            isExclusive: true,
            onConflict: 'queue',
            leaseTimeoutSeconds: 60,
          },
          observer: {},
        },
      }),
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Media View Flow',
        path: `${this.basePath}.view`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'acl-url-resolve -> debounced-usage-flush -> telemetry',
            },
          },
          batch: {
            maxBatchSize: 25,
            maxWaitSeconds: 10,
            idleTimeoutSeconds: 3,
            deduplicationKey: 'viewKey',
          },
          timer: {
            intervalSeconds: 30,
          },
          observer: {},
        },
      }),
    ]);

    this.neurons = { library, ingest, delete: del, view };
    return this.neurons;
  }

  async emitChronicle(
    channel: keyof MediaCompositeNeurons,
    eventType: string,
    payload: Record<string, any>,
    explicitFlowId?: string,
  ): Promise<void> {
    if (!this.combinator) return;

    const neuron = this.neurons[channel];
    const flowId =
      explicitFlowId ||
      neuron?.flows.observer?.id ||
      neuron?.flows.context?.id;

    if (!flowId) return;

    try {
      await this.combinator.chronicle.emit(flowId, {
        eventType,
        payload,
        source: 'lemon-media-hub-neurons',
      });
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }

  async pushBatchTelemetry(
    channel: 'ingest' | 'view',
    payload: Record<string, any>,
    dedupKey?: string,
  ): Promise<void> {
    if (!this.combinator) return;
    const batchFlowId = this.neurons[channel]?.flows.batch?.id;
    if (!batchFlowId) return;

    try {
      await this.combinator.batch.push(batchFlowId, payload, dedupKey);
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }
}
