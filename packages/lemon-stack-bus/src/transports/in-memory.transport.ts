import crypto from 'node:crypto';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  buildProjectWildcard,
  matchesAnyTopicPattern,
  resolvePublishAddress,
} from '../topics/topic-router';
import {
  IStackBusTransport,
  StackBusEnvelope,
  StackBusProjectSummary,
  StackBusPublishInput,
  StackBusReplayOptions,
  StackBusStatus,
  StackBusSubscriptionHandle,
  StackBusSubscriptionOptions,
} from '../types/stack-bus.types';

export interface InMemoryStackBusOptions {
  maxBufferSize?: number;
  streamName?: string;
}

export class InMemoryStackBusTransport implements IStackBusTransport {
  readonly driver = 'memory' as const;

  private readonly streamName: string;
  private readonly maxBufferSize: number;
  private readonly subject = new Subject<StackBusEnvelope<any>>();
  private readonly buffer: StackBusEnvelope<any>[] = [];
  private readonly dedupMap = new Map<string, StackBusEnvelope<any>>();
  private readonly projectStats = new Map<
    string,
    { count: number; lastEventAt: string | null; topics: Set<string> }
  >();

  private connected = false;
  private seqCounter = 0;
  private totalDelivered = 0;

  constructor(options: InMemoryStackBusOptions = {}) {
    this.streamName = options.streamName ?? 'LEMON_STACK_BUS';
    this.maxBufferSize = Math.max(100, options.maxBufferSize ?? 2000);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async publish<TPayload = Record<string, unknown>>(
    input: StackBusPublishInput<TPayload>,
  ): Promise<StackBusEnvelope<TPayload>> {
    if (!this.connected) {
      this.connected = true;
    }

    if (input.dedupKey && this.dedupMap.has(input.dedupKey)) {
      return this.dedupMap.get(input.dedupKey)! as StackBusEnvelope<TPayload>;
    }

    const address = resolvePublishAddress(input);
    const envelope: StackBusEnvelope<TPayload> = {
      eventId: crypto.randomUUID(),
      seq: ++this.seqCounter,
      topic: address.topic,
      projectSlug: address.projectSlug,
      domain: address.domain,
      event: address.event,
      sourceApp: input.sourceApp?.trim() || address.projectSlug,
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId,
      dedupKey: input.dedupKey,
      tags: input.tags ? [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))] : [],
      payload: input.payload,
    };

    if (input.dedupKey) {
      this.dedupMap.set(input.dedupKey, envelope);
      if (this.dedupMap.size > this.maxBufferSize) {
        const oldestKey = this.dedupMap.keys().next().value;
        if (oldestKey) this.dedupMap.delete(oldestKey);
      }
    }

    this.buffer.push(envelope);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    const stats = this.projectStats.get(envelope.projectSlug) ?? {
      count: 0,
      lastEventAt: null,
      topics: new Set<string>(),
    };
    stats.count += 1;
    stats.lastEventAt = envelope.timestamp;
    stats.topics.add(envelope.topic);
    this.projectStats.set(envelope.projectSlug, stats);

    this.subject.next(envelope);
    return envelope;
  }

  async subscribe<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle> {
    if (!this.connected) {
      this.connected = true;
    }

    const deliverPolicy = options.deliverPolicy ?? 'new';
    const matchingBuffer = this.filterBuffer(options);

    if (deliverPolicy === 'all') {
      const startSeq = options.startSeq ?? 0;
      for (const env of matchingBuffer) {
        if (env.seq >= startSeq) {
          this.totalDelivered += 1;
          await handler(env as StackBusEnvelope<TPayload>);
        }
      }
    } else if (deliverPolicy === 'last' && matchingBuffer.length > 0) {
      this.totalDelivered += 1;
      await handler(matchingBuffer[matchingBuffer.length - 1] as StackBusEnvelope<TPayload>);
    }

    const sub = this.subscribe$<TPayload>(options).subscribe((env) => {
      this.totalDelivered += 1;
      void handler(env);
    });

    return {
      unsubscribe: () => sub.unsubscribe(),
    };
  }

  subscribe$<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions = {},
  ): Observable<StackBusEnvelope<TPayload>> {
    return this.subject.asObservable().pipe(
      filter((env) => this.matchesSubscription(env, options)),
    ) as Observable<StackBusEnvelope<TPayload>>;
  }

  async replay<TPayload = Record<string, unknown>>(
    options: StackBusReplayOptions = {},
  ): Promise<StackBusEnvelope<TPayload>[]> {
    const matched = this.filterBuffer(options).filter((env) =>
      options.sinceSeq ? env.seq > options.sinceSeq : true,
    );
    const limit = options.limit && options.limit > 0 ? options.limit : matched.length;
    return matched.slice(-limit) as StackBusEnvelope<TPayload>[];
  }

  async getStatus(): Promise<StackBusStatus> {
    const projects: StackBusProjectSummary[] = Array.from(this.projectStats.entries()).map(
      ([projectSlug, s]) => ({
        projectSlug,
        publishedCount: s.count,
        lastEventAt: s.lastEventAt,
        topics: Array.from(s.topics).slice(-25),
      }),
    );

    return {
      driver: this.driver,
      connected: this.connected,
      streamName: this.streamName,
      totalPublished: this.seqCounter,
      totalDelivered: this.totalDelivered,
      bufferedCount: this.buffer.length,
      projects,
    };
  }

  private filterBuffer(
    options: Pick<StackBusSubscriptionOptions, 'topicPattern' | 'projectSlug' | 'tags'>,
  ): StackBusEnvelope<any>[] {
    return this.buffer.filter((env) => this.matchesSubscription(env, options));
  }

  private matchesSubscription(
    env: StackBusEnvelope<any>,
    options: Pick<StackBusSubscriptionOptions, 'topicPattern' | 'projectSlug' | 'tags'>,
  ): boolean {
    if (options.projectSlug) {
      const projectPattern = buildProjectWildcard(options.projectSlug);
      if (!matchesAnyTopicPattern(projectPattern, env.topic)) return false;
    }
    if (options.topicPattern && !matchesAnyTopicPattern(options.topicPattern, env.topic)) {
      return false;
    }
    if (options.tags && options.tags.length > 0) {
      const envTags = new Set(env.tags ?? []);
      if (!options.tags.some((t) => envTags.has(t))) return false;
    }
    return true;
  }
}
