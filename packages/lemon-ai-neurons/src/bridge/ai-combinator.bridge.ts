import { CompositeNeuronInstance, CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { AiImpulseBus } from '../client/ai-impulse.bus';
import { AiServiceApiClient } from '../client/ai-service-api.client';

export interface AiCombinatorBridgeOptions {
  apiClient: AiServiceApiClient;
  impulseBus?: AiImpulseBus;
  combinator?: CoreCombinatorClient;
  profileId?: string;
  basePath?: string;
  /** If true (default), Core Combinator telemetry failures do not fail AI operations */
  bestEffortTelemetry?: boolean;
}

export interface AiCompositeNeurons {
  studio?: CompositeNeuronInstance;
  text?: CompositeNeuronInstance;
  images?: CompositeNeuronInstance;
  history?: CompositeNeuronInstance;
}

/**
 * Bridge connecting Lemon AI Service (Umniy Lemon) with Core Combinator Composite Neurons.
 * Registers Composite Neurons for:
 * - `ai-neurons/studio`
 * - `ai-neurons/text`
 * - `ai-neurons/images`
 * - `ai-neurons/history`
 * and emits Chronicle + Batch telemetry for every generation lifecycle event.
 */
export class AiCombinatorBridge {
  public readonly apiClient: AiServiceApiClient;
  public readonly impulseBus?: AiImpulseBus;
  public readonly combinator?: CoreCombinatorClient;
  public readonly profileId?: string;
  public readonly basePath: string;
  private readonly bestEffortTelemetry: boolean;
  private neurons: AiCompositeNeurons = {};

  constructor(options: AiCombinatorBridgeOptions) {
    this.apiClient = options.apiClient;
    this.impulseBus = options.impulseBus;
    this.combinator = options.combinator;
    this.profileId = options.profileId;
    this.basePath = (options.basePath || 'ai_neurons')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '.')
      .replace(/-/g, '_') || 'ai_neurons';
    this.bestEffortTelemetry = options.bestEffortTelemetry ?? true;
  }

  get registeredNeurons(): AiCompositeNeurons {
    return this.neurons;
  }

  /**
   * Idempotently ensures Composite Neurons for AI-neurons operations in Core Combinator.
   */
  async ensureAiTopology(): Promise<AiCompositeNeurons> {
    if (!this.combinator) {
      return this.neurons;
    }

    const [studio, text, images, history] = await Promise.all([
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'AI Neurons Studio (Umniy Lemon)',
        path: `${this.basePath}.studio`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              service: 'lemon-ai-service',
              alias: 'Umniy Lemon',
              baseUrl: this.apiClient.baseUrl,
              capabilities: ['text', 'notes', 'quick-add', 'images', 'remix', 'vision'],
            },
          },
          observer: {},
        },
      }),
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'AI Text & Notes Flow',
        path: `${this.basePath}.text`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'prompt -> gemini -> history-log',
            },
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
        name: 'AI Images & Vision Flow',
        path: `${this.basePath}.images`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'prompt-synth -> flux/imagen -> media-hub -> history',
            },
          },
          batch: {
            maxBatchSize: 8,
            maxWaitSeconds: 20,
            idleTimeoutSeconds: 5,
            deduplicationKey: 'correlationId',
          },
          mutex: {
            isExclusive: false,
            onConflict: 'queue',
            leaseTimeoutSeconds: 90,
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
        name: 'AI History Projection',
        path: `${this.basePath}.history`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'pg-request-log -> stats -> ai-neurons-ui',
            },
          },
          timer: {
            intervalSeconds: 30,
          },
          observer: {},
        },
      }),
    ]);

    this.neurons = { studio, text, images, history };
    return this.neurons;
  }

  async emitChronicle(
    channel: keyof AiCompositeNeurons,
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
        source: 'lemon-ai-neurons',
      });
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }

  async pushBatchTelemetry(
    payload: Record<string, any>,
    dedupKey?: string,
  ): Promise<void> {
    if (!this.combinator) return;
    const batchFlowId = this.neurons.images?.flows.batch?.id;
    if (!batchFlowId) return;

    try {
      await this.combinator.batch.push(batchFlowId, payload, dedupKey);
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }
}
