import {
  CompositeNeuronInstance,
  CoreCombinatorClient,
  FlowImpulsePacket,
} from '@lemon/core-combinator-sdk';
import { SeasonsApiClient } from '../client/seasons-api.client';
import { SeasonsSseBus } from '../client/seasons-sse.bus';
import {
  IngestSeasonNoteInput,
  NotesPageQuery,
  NoteTodoItem,
  PaginatedNotesWindow,
} from '../types/seasons.types';

export interface SeasonsCombinatorBridgeOptions {
  combinator?: CoreCombinatorClient;
  seasons: SeasonsApiClient;
  sseBus?: SeasonsSseBus;
  profileId?: string;
  basePath?: string;
  defaultStreamSlug?: string;
  defaultPrivacy?: 'public' | 'private';
  bestEffortTelemetry?: boolean;
}

export interface SeasonsCompositeNeurons {
  topology?: CompositeNeuronInstance;
  ingest?: CompositeNeuronInstance;
  todos?: CompositeNeuronInstance;
  media?: CompositeNeuronInstance;
}

export interface FeedNeuronBindingOptions {
  folderId: string;
  streamSlug: string;
  feedSlug: string;
  privacy?: 'public' | 'private';
  transformer?: (packet: FlowImpulsePacket) => IngestSeasonNoteInput | null;
}

export class SeasonsCombinatorBridge {
  public readonly combinator?: CoreCombinatorClient;
  public readonly seasons: SeasonsApiClient;
  public readonly sseBus?: SeasonsSseBus;
  public readonly profileId?: string;
  public readonly basePath: string;
  public readonly defaultStreamSlug: string;
  public readonly defaultPrivacy: 'public' | 'private';
  private readonly bestEffortTelemetry: boolean;
  private neurons: SeasonsCompositeNeurons = {};

  private activeBindings: Array<() => void> = [];

  constructor(options: SeasonsCombinatorBridgeOptions) {
    this.combinator = options.combinator;
    this.seasons = options.seasons;
    this.sseBus = options.sseBus;
    this.profileId = options.profileId;
    this.basePath = (options.basePath || 'seasons')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '.')
      .replace(/-/g, '_') || 'seasons';
    this.defaultStreamSlug = options.defaultStreamSlug || 'core-combinator';
    this.defaultPrivacy = options.defaultPrivacy || 'private';
    this.bestEffortTelemetry = options.bestEffortTelemetry ?? true;
  }

  get registeredNeurons(): SeasonsCompositeNeurons {
    return this.neurons;
  }

  /**
   * Idempotently registers Composite Neurons for Lemon Seasons operations in Core Combinator:
   * - `seasons.topology`
   * - `seasons.ingest`
   * - `seasons.todos`
   * - `seasons.media`
   */
  async ensureSeasonsCompositeNeurons(): Promise<SeasonsCompositeNeurons> {
    if (!this.combinator) {
      return this.neurons;
    }

    const [topology, ingest, todos, media] = await Promise.all([
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Seasons Topology & Streams',
        path: `${this.basePath}.topology`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              service: 'lemon-seasons',
              baseUrl: this.seasons.baseUrl,
              capabilities: ['topology', 'streams', 'feeds', 'notes', 'sse'],
            },
          },
          timer: {
            intervalSeconds: 30,
          },
          observer: {},
        },
      }),
      this.combinator.neurons.ensureCompositeNeuron({
        name: 'Seasons Note Ingest Flow',
        path: `${this.basePath}.ingest`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'impulse -> seasons-ingest -> postgres-upsert -> sse-broadcast',
            },
          },
          batch: {
            maxBatchSize: 15,
            maxWaitSeconds: 30,
            idleTimeoutSeconds: 5,
            deduplicationKey: 'externalId',
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
        name: 'Seasons TodoList Sync Flow',
        path: `${this.basePath}.todos`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'projectarium-todo -> markdown-merge -> note-patch',
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
        name: 'Seasons Note Media Bridge',
        path: `${this.basePath}.media`,
        profileId: this.profileId,
        flows: {
          context: {
            config: {
              pipeline: 'media-hub-neurons -> asset-resolve -> note-image-attach',
              upstream: '@lemon/media-hub-neurons',
            },
          },
          batch: {
            maxBatchSize: 10,
            maxWaitSeconds: 20,
            idleTimeoutSeconds: 5,
            deduplicationKey: 'mediaAssetId',
          },
          mutex: {
            isExclusive: false,
            onConflict: 'queue',
            leaseTimeoutSeconds: 120,
          },
          observer: {},
        },
      }),
    ]);

    this.neurons = { topology, ingest, todos, media };
    return this.neurons;
  }

  async emitChronicle(
    channel: keyof SeasonsCompositeNeurons,
    eventType: string,
    payload: Record<string, any>,
    explicitFlowId?: string,
  ): Promise<void> {
    if (!this.combinator) return;

    const neuron = this.neurons[channel];
    const flowId =
      explicitFlowId ||
      neuron?.flows?.observer?.id ||
      neuron?.flows?.context?.id;

    if (!flowId) return;

    try {
      await this.combinator.chronicle.emit(flowId, {
        eventType,
        payload,
        source: 'lemon-seasons-neurons',
      });
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }

  async pushBatchTelemetry(
    channel: 'ingest' | 'media',
    payload: Record<string, any>,
    dedupKey?: string,
  ): Promise<void> {
    if (!this.combinator) return;
    const batchFlowId = this.neurons[channel]?.flows?.batch?.id;
    if (!batchFlowId) return;

    try {
      await this.combinator.batch.push(batchFlowId, payload, dedupKey);
    } catch (err) {
      if (!this.bestEffortTelemetry) throw err;
    }
  }

  /**
   * Pre-creates or verifies the Stream and Feeds topology in Lemon Seasons,
   * attaching any missing feeds to the target stream.
   */
  async ensureTopology(input: {
    streamSlug?: string;
    streamTitle?: string;
    streamIcon?: string;
    streamColor?: string;
    privacy?: 'public' | 'private';
    feeds: Array<{
      slug: string;
      title: string;
      description?: string;
      icon?: string;
      color?: string;
      privacy?: 'public' | 'private';
      hashtags?: string[];
    }>;
  }): Promise<{ streamId: string; feedIds: string[] }> {
    const streamSlug = input.streamSlug || this.defaultStreamSlug;
    const streamPrivacy = input.privacy || this.defaultPrivacy;
    const feedIds: string[] = [];

    for (const f of input.feeds) {
      const feedRes = await this.seasons.ensureFeed({
        slug: f.slug,
        title: f.title,
        description: f.description,
        icon: f.icon || '📝',
        color: f.color,
        privacy: f.privacy || streamPrivacy,
        hashtags: f.hashtags,
      });
      if (feedRes?.id) feedIds.push(feedRes.id);
    }

    const streamRes = await this.seasons.ensureStream({
      slug: streamSlug,
      title: input.streamTitle || 'Core Combinator Stream',
      icon: input.streamIcon,
      color: input.streamColor,
      privacy: streamPrivacy,
      feedIds,
    });

    const streamId = streamRes?.id || streamSlug;
    const existingFeedIds: string[] = Array.isArray(streamRes?.feedIds)
      ? streamRes.feedIds
      : [];

    for (const feedId of feedIds) {
      if (!existingFeedIds.includes(feedId)) {
        await this.seasons.attachFeedToStream(streamId, feedId);
      }
    }

    return {
      streamId,
      feedIds,
    };
  }

  /**
   * Ingests a Note into Lemon Seasons and logs the chronicle event in Core Combinator.
   */
  async ingestNote(
    input: IngestSeasonNoteInput,
    flowId?: string,
  ): Promise<{ noteId: string; action: 'CREATED' | 'UPDATED'; note?: any }> {
    const notePayload: IngestSeasonNoteInput = {
      ...input,
      streamSlug: input.streamSlug || this.defaultStreamSlug,
      privacy: input.privacy || this.defaultPrivacy,
      origin: input.origin || 'CORE_COMBINATOR',
    };

    const res = await this.seasons.ingestNote(notePayload);

    const targetFlowId =
      flowId ||
      this.neurons.ingest?.flows?.observer?.id ||
      this.neurons.ingest?.flows?.context?.id;

    if (this.combinator && targetFlowId) {
      try {
        await this.combinator.chronicle.emit(targetFlowId, {
          eventType: 'SEASONS_NOTE_INGESTED',
          source: 'lemon-seasons-neurons',
          payload: {
            noteId: res.noteId,
            action: res.action,
            title: input.title,
            feedSlug: input.feedSlug,
            streamSlug: notePayload.streamSlug,
            mediaCount:
              (input.images?.length || 0) + (input.mediaAssetIds?.length || 0),
          },
        });
      } catch (err) {
        if (!this.bestEffortTelemetry) throw err;
      }
    }

    return { noteId: res.noteId, action: res.action, note: res.note };
  }

  /**
   * Idempotently projects a structured TodoList into a Note inside Lemon Seasons.
   */
  async syncTodoListNote(input: {
    externalId: string;
    title: string;
    streamSlug?: string;
    feedSlug: string;
    privacy?: 'public' | 'private';
    todoList: NoteTodoItem[];
    description?: string;
    tags?: string[];
    author?: string;
    origin?: string;
    metadata?: Record<string, any>;
    flowId?: string;
  }): Promise<{ noteId: string; action: 'CREATED' | 'UPDATED' }> {
    const targetFlowId =
      input.flowId ||
      this.neurons.todos?.flows?.observer?.id ||
      this.neurons.todos?.flows?.context?.id;

    return this.ingestNote(
      {
        externalId: input.externalId,
        title: input.title,
        content: input.description || input.title,
        type: 'PERIOD',
        status: 'PUBLISHED',
        privacy: input.privacy || this.defaultPrivacy,
        streamSlug: input.streamSlug || this.defaultStreamSlug,
        feedSlug: input.feedSlug,
        icon: '✅',
        author: input.author,
        tags: input.tags || ['todolist'],
        origin: input.origin || 'PROJECTARIUM_SYNC',
        todoList: input.todoList,
        metadata: input.metadata,
      },
      targetFlowId,
    );
  }

  /**
   * Queries notes from Lemon Seasons with honest pagination.
   */
  async queryNotes<T = any>(query: NotesPageQuery = {}): Promise<PaginatedNotesWindow<T>> {
    return this.seasons.getNotesPage<T>({
      streamSource: this.defaultStreamSlug,
      privacy: this.defaultPrivacy,
      ...query,
    });
  }

  /**
   * Binds a Core Combinator Folder (Neuron) to a Lemon Seasons Feed.
   * Listens to SSE impulses (e.g. BATCH_FLUSH, CHRONICLE_EVENT) and automatically ingests notes.
   */
  bindNeuronToFeed(options: FeedNeuronBindingOptions): () => void {
    if (!this.combinator) {
      return () => {};
    }
    const unsub = this.combinator.stream.subscribe(
      { folderId: options.folderId },
      async (packet) => {
        let noteInput: IngestSeasonNoteInput | null = null;

        if (options.transformer) {
          noteInput = options.transformer(packet);
        } else {
          if (packet.type === 'BATCH_FLUSH') {
            const p = packet.payload as any;
            noteInput = {
              title: `Batch Flush: ${packet.flowName} (${p.itemsCount || 0} items)`,
              content: `\`\`\`json\n${JSON.stringify(p.items || [], null, 2)}\n\`\`\``,
              type: 'EVENT',
              summary: `Automated batch flush containing ${p.itemsCount || 0} items`,
              tags: ['combinator:batch', `flow:${packet.flowId}`],
            };
          } else if (packet.type === 'CHRONICLE_EVENT') {
            const p = packet.payload as any;
            noteInput = {
              title: `${packet.flowName}: ${p.eventType || 'Event'}`,
              content: typeof p.summary === 'string' ? p.summary : JSON.stringify(p, null, 2),
              type: 'SINGLE',
              tags: ['combinator:event', `flow:${packet.flowId}`],
            };
          }
        }

        if (noteInput) {
          await this.ingestNote(
            {
              ...noteInput,
              streamSlug: options.streamSlug,
              feedSlug: options.feedSlug,
              privacy: options.privacy || this.defaultPrivacy,
              metadata: {
                ...noteInput.metadata,
                combinatorFlowId: packet.flowId,
                combinatorFolderId: packet.folderId,
                combinatorImpulseType: packet.type,
                activeSessionIds: packet.activeSessionIds,
              },
            },
            packet.flowId,
          );
        }
      },
    );

    this.activeBindings.push(unsub);
    return unsub;
  }

  destroy(): void {
    for (const unsub of this.activeBindings) {
      unsub();
    }
    this.activeBindings = [];
    this.sseBus?.disconnect();
  }
}
