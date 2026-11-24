import crypto from 'node:crypto';
import {
  AckPolicy,
  connect,
  ConsumerConfig,
  ConsumerMessages,
  DeliverPolicy,
  JetStreamClient,
  JetStreamManager,
  JSONCodec,
  NatsConnection,
  RetentionPolicy,
  StorageType,
  Subscription,
} from 'nats';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  buildProjectWildcard,
  matchesAnyTopicPattern,
  resolvePublishAddress,
  STACK_BUS_PREFIX,
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

export interface NatsJetStreamBusOptions {
  natsUrl?: string;
  streamName?: string;
  token?: string;
  user?: string;
  pass?: string;
  maxAgeMs?: number;
  duplicateWindowMs?: number;
  connectTimeoutMs?: number;
}

export class NatsJetStreamTransport implements IStackBusTransport {
  readonly driver = 'nats' as const;

  private readonly natsUrl: string;
  private readonly streamName: string;
  private readonly token?: string;
  private readonly user?: string;
  private readonly pass?: string;
  private readonly maxAgeNs: number;
  private readonly duplicateWindowNs: number;
  private readonly connectTimeoutMs: number;
  private readonly codec = JSONCodec<StackBusEnvelope<any>>();

  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private coreMirrorSub: Subscription | null = null;
  private readonly liveSubject = new Subject<StackBusEnvelope<any>>();
  private readonly activeConsumers = new Set<ConsumerMessages>();
  private readonly projectStats = new Map<
    string,
    { count: number; lastEventAt: string | null; topics: Set<string> }
  >();

  private totalPublished = 0;
  private totalDelivered = 0;
  private lastError: string | undefined;

  constructor(options: NatsJetStreamBusOptions = {}) {
    this.natsUrl = (options.natsUrl || process.env.NATS_URL || 'nats://127.0.0.1:4222').trim();
    this.streamName = (options.streamName || process.env.LEMON_STACK_BUS_STREAM || 'LEMON_STACK_BUS').trim();
    this.token = options.token ?? process.env.NATS_TOKEN;
    this.user = options.user ?? process.env.NATS_USER;
    this.pass = options.pass ?? process.env.NATS_PASS;
    this.maxAgeNs = (options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000) * 1_000_000;
    this.duplicateWindowNs = (options.duplicateWindowMs ?? 120 * 1000) * 1_000_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 3000;
  }

  async connect(): Promise<void> {
    if (this.nc && !this.nc.isClosed()) {
      return;
    }

    try {
      this.nc = await connect({
        servers: this.natsUrl,
        token: this.token,
        user: this.user,
        pass: this.pass,
        timeout: this.connectTimeoutMs,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 2000,
        name: 'lemon-stack-bus',
      });

      this.jsm = await this.nc.jetstreamManager();
      this.js = this.nc.jetstream();
      await this.ensureStream();
      this.startLiveMirror();
      this.lastError = undefined;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      await this.disconnect();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    for (const iter of this.activeConsumers) {
      try {
        iter.stop();
      } catch {
        // ignore stop errors on shutdown
      }
    }
    this.activeConsumers.clear();

    if (this.coreMirrorSub) {
      try {
        this.coreMirrorSub.unsubscribe();
      } catch {
        // ignore
      }
      this.coreMirrorSub = null;
    }

    if (this.nc) {
      try {
        await this.nc.drain();
      } catch {
        try {
          await this.nc.close();
        } catch {
          // ignore
        }
      }
      this.nc = null;
      this.js = null;
      this.jsm = null;
    }
  }

  async publish<TPayload = Record<string, unknown>>(
    input: StackBusPublishInput<TPayload>,
  ): Promise<StackBusEnvelope<TPayload>> {
    if (!this.js) {
      await this.connect();
    }
    if (!this.js) {
      throw new Error('NATS JetStream client is not connected');
    }

    const address = resolvePublishAddress(input);
    const envelope: StackBusEnvelope<TPayload> = {
      eventId: crypto.randomUUID(),
      seq: 0,
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

    const ack = await this.js.publish(
      envelope.topic,
      this.codec.encode(envelope),
      input.dedupKey ? { msgID: input.dedupKey } : undefined,
    );

    envelope.seq = ack.seq;
    if (!ack.duplicate) {
      this.totalPublished += 1;
      this.recordProjectMetric(envelope);
    }

    return envelope;
  }

  async subscribe<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle> {
    if (!this.js || !this.jsm) {
      await this.connect();
    }
    if (!this.js || !this.jsm) {
      throw new Error('NATS JetStream client is not connected');
    }

    const filterSubjects = this.resolveFilterSubjects(options);
    const consumerName = options.durableName
      ? options.durableName.replace(/[^a-zA-Z0-9_-]+/g, '_')
      : `ephemeral_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    const deliverPolicy = this.mapDeliverPolicy(options.deliverPolicy, options.startSeq);
    const cfg: Partial<ConsumerConfig> = {
      durable_name: options.durableName ? consumerName : undefined,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: deliverPolicy,
      ...(options.startSeq && deliverPolicy === DeliverPolicy.StartSequence
        ? { opt_start_seq: options.startSeq }
        : {}),
      ...(filterSubjects.length === 1
        ? { filter_subject: filterSubjects[0] }
        : { filter_subjects: filterSubjects }),
    };

    const info = await this.jsm.consumers.add(this.streamName, cfg);
    const consumer = await this.js.consumers.get(this.streamName, info.name);
    const messages = await consumer.consume();
    this.activeConsumers.add(messages);

    void (async () => {
      for await (const msg of messages) {
        try {
          const decoded = this.codec.decode(msg.data) as StackBusEnvelope<TPayload>;
          decoded.seq = msg.seq;
          if (!this.matchesTags(decoded, options.tags)) {
            msg.ack();
            continue;
          }
          this.totalDelivered += 1;
          await handler(decoded);
          msg.ack();
        } catch (err) {
          this.lastError = err instanceof Error ? err.message : String(err);
          msg.nak();
        }
      }
    })();

    return {
      unsubscribe: async () => {
        messages.stop();
        this.activeConsumers.delete(messages);
        if (!options.durableName && this.jsm) {
          await this.jsm.consumers.delete(this.streamName, info.name).catch(() => {});
        }
      },
    };
  }

  subscribe$<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions = {},
  ): Observable<StackBusEnvelope<TPayload>> {
    return this.liveSubject.asObservable().pipe(
      filter((env) => {
        if (options.projectSlug && !matchesAnyTopicPattern(buildProjectWildcard(options.projectSlug), env.topic)) {
          return false;
        }
        if (options.topicPattern && !matchesAnyTopicPattern(options.topicPattern, env.topic)) {
          return false;
        }
        return this.matchesTags(env, options.tags);
      }),
    ) as Observable<StackBusEnvelope<TPayload>>;
  }

  async replay<TPayload = Record<string, unknown>>(
    options: StackBusReplayOptions = {},
  ): Promise<StackBusEnvelope<TPayload>[]> {
    if (!this.jsm || !this.js) {
      await this.connect();
    }
    if (!this.jsm || !this.js) return [];

    const streamInfo = await this.jsm.streams.info(this.streamName);
    const totalInStream = streamInfo.state.messages;
    if (totalInStream === 0) return [];

    const filterSubjects = this.resolveFilterSubjects(options);
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
    const startSeq = options.sinceSeq ? options.sinceSeq + 1 : Math.max(1, streamInfo.state.last_seq - limit + 1);

    const tempInfo = await this.jsm.consumers.add(this.streamName, {
      ack_policy: AckPolicy.None,
      deliver_policy: DeliverPolicy.StartSequence,
      opt_start_seq: startSeq,
      ...(filterSubjects.length === 1
        ? { filter_subject: filterSubjects[0] }
        : { filter_subjects: filterSubjects }),
    });

    const results: StackBusEnvelope<TPayload>[] = [];
    try {
      const consumer = await this.js.consumers.get(this.streamName, tempInfo.name);
      const iter = await consumer.fetch({ max_messages: limit, expires: 1500 });
      for await (const msg of iter) {
        const decoded = this.codec.decode(msg.data) as StackBusEnvelope<TPayload>;
        decoded.seq = msg.seq;
        results.push(decoded);
      }
    } finally {
      await this.jsm.consumers.delete(this.streamName, tempInfo.name).catch(() => {});
    }

    return results;
  }

  async getStatus(): Promise<StackBusStatus> {
    let bufferedCount = 0;
    const connected = Boolean(this.nc && !this.nc.isClosed());

    if (connected && this.jsm) {
      try {
        const info = await this.jsm.streams.info(this.streamName);
        bufferedCount = info.state.messages;
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
      }
    }

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
      connected,
      streamName: this.streamName,
      natsUrl: this.natsUrl,
      totalPublished: this.totalPublished,
      totalDelivered: this.totalDelivered,
      bufferedCount,
      projects,
      lastError: this.lastError,
    };
  }

  private async ensureStream(): Promise<void> {
    if (!this.jsm) return;
    const subjectRoot = `${STACK_BUS_PREFIX}.>`;
    try {
      const existing = await this.jsm.streams.info(this.streamName);
      if (!existing.config.subjects.includes(subjectRoot)) {
        await this.jsm.streams.update(this.streamName, {
          ...existing.config,
          subjects: [...new Set([...existing.config.subjects, subjectRoot])],
          allow_direct: true,
        });
      }
    } catch {
      await this.jsm.streams.add({
        name: this.streamName,
        subjects: [subjectRoot],
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
        max_age: this.maxAgeNs,
        duplicate_window: this.duplicateWindowNs,
        allow_direct: true,
      });
    }
  }

  private startLiveMirror(): void {
    if (!this.nc || this.coreMirrorSub) return;
    this.coreMirrorSub = this.nc.subscribe(`${STACK_BUS_PREFIX}.>`);
    void (async () => {
      if (!this.coreMirrorSub) return;
      for await (const msg of this.coreMirrorSub) {
        try {
          const decoded = this.codec.decode(msg.data) as StackBusEnvelope<any>;
          this.recordProjectMetric(decoded);
          this.liveSubject.next(decoded);
        } catch {
          // Ignore non-JSON control messages
        }
      }
    })();
  }

  private recordProjectMetric(envelope: StackBusEnvelope<any>): void {
    const stats = this.projectStats.get(envelope.projectSlug) ?? {
      count: 0,
      lastEventAt: null,
      topics: new Set<string>(),
    };
    stats.count += 1;
    stats.lastEventAt = envelope.timestamp;
    stats.topics.add(envelope.topic);
    this.projectStats.set(envelope.projectSlug, stats);
  }

  private resolveFilterSubjects(
    options: Pick<StackBusSubscriptionOptions, 'topicPattern' | 'projectSlug'>,
  ): string[] {
    if (options.projectSlug && !options.topicPattern) {
      return [buildProjectWildcard(options.projectSlug)];
    }
    if (!options.topicPattern) {
      return [`${STACK_BUS_PREFIX}.>`];
    }
    const rawList = Array.isArray(options.topicPattern)
      ? options.topicPattern
      : [options.topicPattern];

    const normalized = rawList
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
      .map((p) => {
        if (!options.projectSlug) return p;
        const prefix = `${STACK_BUS_PREFIX}.${options.projectSlug.toLowerCase()}.`;
        return p.startsWith(`${STACK_BUS_PREFIX}.`) ? p : `${prefix}${p}`;
      });

    return normalized.length > 0 ? normalized : [`${STACK_BUS_PREFIX}.>`];
  }

  private mapDeliverPolicy(
    policy?: StackBusSubscriptionOptions['deliverPolicy'],
    startSeq?: number,
  ): DeliverPolicy {
    if (startSeq && startSeq > 0) return DeliverPolicy.StartSequence;
    if (policy === 'all') return DeliverPolicy.All;
    if (policy === 'last') return DeliverPolicy.Last;
    return DeliverPolicy.New;
  }

  private matchesTags(envelope: StackBusEnvelope<any>, tags?: string[]): boolean {
    if (!tags || tags.length === 0) return true;
    const envTags = new Set(envelope.tags ?? []);
    return tags.some((t) => envTags.has(t));
  }
}
