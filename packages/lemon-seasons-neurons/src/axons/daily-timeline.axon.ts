import { CompositeNeuronInstance } from '@lemon/core-combinator-sdk';
import { SeasonsCombinatorBridge } from '../bridge/seasons-combinator-bridge';
import { IngestSeasonNoteInput } from '../types/seasons.types';

export interface DailyTimelineAxonOptions {
  bridge: SeasonsCombinatorBridge;
  streamSlug?: string;
  feedSlug?: string;
  privacy?: 'public' | 'private';
}

export class DailyTimelineAxon {
  private readonly bridge: SeasonsCombinatorBridge;
  private readonly streamSlug: string;
  private readonly feedSlug: string;
  private readonly privacy: 'public' | 'private';
  private neuronInstance: CompositeNeuronInstance | null = null;

  constructor(options: DailyTimelineAxonOptions) {
    this.bridge = options.bridge;
    this.streamSlug = options.streamSlug || 'daily-timeline';
    this.feedSlug = options.feedSlug || 'day-reviews';
    this.privacy = options.privacy || 'private';
  }

  /**
   * Initializes both the Seasons Feed and the Core Combinator Daily Timeline Neuron.
   */
  async init(): Promise<CompositeNeuronInstance> {
    // 1. Ensure Seasons topology
    await this.bridge.ensureTopology({
      streamSlug: this.streamSlug,
      streamTitle: 'Daily Life Timeline',
      feeds: [
        {
          slug: this.feedSlug,
          title: 'Daily History & Reviews',
          icon: '📅',
          privacy: this.privacy,
          hashtags: ['timeline', 'daily-review'],
        },
      ],
    });

    // 2. Ensure Core Combinator Composite Neuron
    this.neuronInstance = await this.bridge.combinator.neurons.ensureCompositeNeuron({
      name: 'Daily Timeline Neuron',
      path: 'seasons.timeline.daily',
      flows: {
        batch: {
          name: 'Day Items Influx Buffer',
          maxBatchSize: 20,
          maxWaitSeconds: 1800, // 30 min window
          idleTimeoutSeconds: 300,
        },
        timer: {
          name: 'Evening Review Timer',
          intervalSeconds: 3600, // hourly or evening checks
        },
        mutex: {
          name: 'Daily Review Synthesis Mutex',
          isExclusive: true,
          leaseTimeoutSeconds: 120,
        },
        observer: {
          name: 'Timeline Telemetry',
        },
      },
    });

    // 3. Listen to BATCH_FLUSH from the batch flow -> ingest note into Seasons
    const batchFlow = this.neuronInstance.flows.batch;
    if (batchFlow) {
      this.bridge.combinator.batch.onFlush(batchFlow.id, async (batch) => {
        await this.onBatchFlush(batch);
      });
    }

    return this.neuronInstance;
  }

  /**
   * Adds a micro-note, reflection or event into today's timeline batch buffer.
   */
  async appendDayItem(item: {
    title: string;
    text: string;
    actorId?: string;
    moodEmoji?: string;
    tags?: string[];
  }): Promise<void> {
    if (!this.neuronInstance?.flows.batch) {
      throw new Error('[DailyTimelineAxon] Axon not initialized. Call init() first.');
    }

    await this.bridge.combinator.batch.push(
      this.neuronInstance.flows.batch.id,
      {
        ...item,
        timestamp: new Date().toISOString(),
      },
      item.title,
    );
  }

  private async onBatchFlush(batch: any): Promise<void> {
    const items = batch.items || [];
    if (!items.length) return;

    const dateKey = new Date().toISOString().split('T')[0];
    const content = items
      .map((i: any) => `* **${i.payload.moodEmoji || '📝'} ${i.payload.title}**: ${i.payload.text}`)
      .join('\n');

    const notePayload: IngestSeasonNoteInput = {
      externalId: `daily-batch:${dateKey}:${batch.batchId}`,
      title: `Daily Timeline Segment (${items.length} items)`,
      content,
      summary: `Automated timeline segment for ${dateKey}`,
      type: 'PERIOD',
      privacy: this.privacy,
      status: 'PUBLISHED',
      feedSlug: this.feedSlug,
      streamSlug: this.streamSlug,
      tags: ['timeline', 'daily-segment', `date:${dateKey}`],
      origin: 'DAILY_TIMELINE_AXON',
      metadata: {
        batchId: batch.batchId,
        itemsCount: items.length,
        dateKey,
      },
    };

    const flowId = this.neuronInstance?.flows.observer?.id;
    await this.bridge.ingestNote(notePayload, flowId);
  }
}
