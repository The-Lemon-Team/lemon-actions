import { CoreCombinatorClient, FlowImpulsePacket } from '@lemon/core-combinator-sdk';
import { SeasonsApiClient } from '../client/seasons-api.client';
import { SeasonsSseBus } from '../client/seasons-sse.bus';
import {
  IngestSeasonNoteInput,
  NotesPageQuery,
  NoteTodoItem,
  PaginatedNotesWindow,
} from '../types/seasons.types';

export interface SeasonsCombinatorBridgeOptions {
  combinator: CoreCombinatorClient;
  seasons: SeasonsApiClient;
  sseBus?: SeasonsSseBus;
  defaultStreamSlug?: string;
  defaultPrivacy?: 'public' | 'private';
}

export interface FeedNeuronBindingOptions {
  folderId: string;
  streamSlug: string;
  feedSlug: string;
  privacy?: 'public' | 'private';
  transformer?: (packet: FlowImpulsePacket) => IngestSeasonNoteInput | null;
}

export class SeasonsCombinatorBridge {
  public readonly combinator: CoreCombinatorClient;
  public readonly seasons: SeasonsApiClient;
  public readonly sseBus?: SeasonsSseBus;
  public readonly defaultStreamSlug: string;
  public readonly defaultPrivacy: 'public' | 'private';

  private activeBindings: Array<() => void> = [];

  constructor(options: SeasonsCombinatorBridgeOptions) {
    this.combinator = options.combinator;
    this.seasons = options.seasons;
    this.sseBus = options.sseBus;
    this.defaultStreamSlug = options.defaultStreamSlug || 'core-combinator';
    this.defaultPrivacy = options.defaultPrivacy || 'private';
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
  ): Promise<{ noteId: string; action: 'CREATED' | 'UPDATED' }> {
    const notePayload: IngestSeasonNoteInput = {
      ...input,
      streamSlug: input.streamSlug || this.defaultStreamSlug,
      privacy: input.privacy || this.defaultPrivacy,
      origin: input.origin || 'CORE_COMBINATOR',
    };

    const res = await this.seasons.ingestNote(notePayload);

    // If a Core Combinator flowId is provided, write a mirror FlowEvent
    if (flowId) {
      await this.combinator.chronicle.emit(flowId, {
        eventType: 'SEASONS_NOTE_INGESTED',
        source: 'lemon-seasons-neurons',
        payload: {
          noteId: res.noteId,
          action: res.action,
          title: input.title,
          feedSlug: input.feedSlug,
          streamSlug: notePayload.streamSlug,
        },
      });
    }

    return { noteId: res.noteId, action: res.action };
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
      input.flowId,
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
    const unsub = this.combinator.stream.subscribe({ folderId: options.folderId }, async (packet) => {
      let noteInput: IngestSeasonNoteInput | null = null;

      if (options.transformer) {
        noteInput = options.transformer(packet);
      } else {
        // Default transformer
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
        await this.ingestNote({
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
        }, packet.flowId);
      }
    });

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
