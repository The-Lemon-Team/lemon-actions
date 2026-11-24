import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import {
  buildProjectWildcard,
  buildStackTopic,
  sanitizeTopicToken,
} from '../topics/topic-router';
import { InMemoryStackBusTransport } from '../transports/in-memory.transport';
import {
  NatsJetStreamBusOptions,
  NatsJetStreamTransport,
} from '../transports/nats-jetstream.transport';
import {
  IStackBusTransport,
  StackBusDriverKind,
  StackBusEnvelope,
  StackBusPublishInput,
  StackBusReplayOptions,
  StackBusStatus,
  StackBusSubscriptionHandle,
  StackBusSubscriptionOptions,
} from '../types/stack-bus.types';

export interface CreateStackBusOptions extends NatsJetStreamBusOptions {
  driver?: StackBusDriverKind | 'auto';
  maxBufferSize?: number;
}

/**
 * Isolated per-project bus facade (`lemon.<projectSlug>.>`).
 * Every publish automatically namespaces topics under the project slug;
 * subscriptions stay isolated to this project unless crossBus() is used.
 */
export class ProjectBusClient {
  readonly projectSlug: string;
  readonly sourceApp: string;

  constructor(
    private readonly transport: IStackBusTransport,
    projectSlug: string,
    sourceApp?: string,
  ) {
    this.projectSlug = sanitizeTopicToken(projectSlug);
    this.sourceApp = sourceApp?.trim() || this.projectSlug;
  }

  topic(domain: string, event: string): string {
    return buildStackTopic(this.projectSlug, domain, event);
  }

  publish<TPayload = Record<string, unknown>>(
    domainOrRelativeTopic: string,
    eventOrPayload: string | TPayload,
    maybePayloadOrOpts?:
      | TPayload
      | Omit<StackBusPublishInput<TPayload>, 'topic' | 'projectSlug' | 'domain' | 'event' | 'payload'>,
    maybeOpts?: Omit<
      StackBusPublishInput<TPayload>,
      'topic' | 'projectSlug' | 'domain' | 'event' | 'payload'
    >,
  ): Promise<StackBusEnvelope<TPayload>> {
    if (typeof eventOrPayload === 'string') {
      const opts = (maybeOpts ?? {}) as Record<string, any>;
      return this.transport.publish<TPayload>({
        ...opts,
        projectSlug: this.projectSlug,
        domain: domainOrRelativeTopic,
        event: eventOrPayload,
        sourceApp: opts.sourceApp ?? this.sourceApp,
        payload: maybePayloadOrOpts as TPayload,
      });
    }

    const opts = (maybePayloadOrOpts ?? {}) as Record<string, any>;
    return this.transport.publish<TPayload>({
      ...opts,
      projectSlug: this.projectSlug,
      topic: domainOrRelativeTopic,
      sourceApp: opts.sourceApp ?? this.sourceApp,
      payload: eventOrPayload,
    });
  }

  subscribe<TPayload = Record<string, unknown>>(
    patternOrOptions: string | Omit<StackBusSubscriptionOptions, 'projectSlug'>,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle> {
    const opts = this.scopeOptions(patternOrOptions);
    return this.transport.subscribe<TPayload>(opts, handler);
  }

  subscribe$<TPayload = Record<string, unknown>>(
    patternOrOptions?: string | Omit<StackBusSubscriptionOptions, 'projectSlug'>,
  ): Observable<StackBusEnvelope<TPayload>> {
    return this.transport.subscribe$<TPayload>(this.scopeOptions(patternOrOptions));
  }

  replay<TPayload = Record<string, unknown>>(
    options: Omit<StackBusReplayOptions, 'projectSlug'> = {},
  ): Promise<StackBusEnvelope<TPayload>[]> {
    return this.transport.replay<TPayload>({
      ...options,
      projectSlug: this.projectSlug,
      topicPattern: options.topicPattern
        ? this.scopePattern(options.topicPattern)
        : buildProjectWildcard(this.projectSlug),
    });
  }

  private scopeOptions(
    patternOrOptions?: string | Omit<StackBusSubscriptionOptions, 'projectSlug'>,
  ): StackBusSubscriptionOptions {
    if (typeof patternOrOptions === 'string') {
      return {
        projectSlug: this.projectSlug,
        topicPattern: this.scopePattern(patternOrOptions),
      };
    }
    return {
      ...(patternOrOptions ?? {}),
      projectSlug: this.projectSlug,
      topicPattern: patternOrOptions?.topicPattern
        ? this.scopePattern(patternOrOptions.topicPattern)
        : buildProjectWildcard(this.projectSlug),
    };
  }

  private scopePattern(pattern: string | string[]): string | string[] {
    const scopeOne = (p: string) => {
      const cleaned = p.trim().toLowerCase();
      if (cleaned.startsWith('lemon.')) return cleaned;
      return `lemon.${this.projectSlug}.${cleaned}`;
    };
    return Array.isArray(pattern) ? pattern.map(scopeOne) : scopeOne(pattern);
  }
}

/**
 * Central StackBus Hub:
 * - `forProject(slug)` gives each project its own namespaced bus (`lemon.<slug>.*`)
 * - `crossBus()` / direct methods subscribe and route events across multiple projects (`lemon.*.media.created`, `lemon.>`)
 */
export class StackBusHub {
  private readonly projectClients = new Map<string, ProjectBusClient>();
  private readonly transportSubject: BehaviorSubject<IStackBusTransport>;

  constructor(private _transport: IStackBusTransport) {
    this.transportSubject = new BehaviorSubject<IStackBusTransport>(_transport);
  }

  get transport(): IStackBusTransport {
    return this._transport;
  }

  set transport(next: IStackBusTransport) {
    this._transport = next;
    this.transportSubject.next(next);
  }

  get driver(): StackBusDriverKind {
    return this._transport.driver;
  }

  async connect(): Promise<void> {
    await this._transport.connect();
  }

  async disconnect(): Promise<void> {
    await this._transport.disconnect();
  }

  forProject(projectSlug: string, sourceApp?: string): ProjectBusClient {
    const key = `${sanitizeTopicToken(projectSlug)}:${sourceApp ?? ''}`;
    let client = this.projectClients.get(key);
    if (!client) {
      // Delegate through the hub so ProjectBusClient automatically follows transport upgrades (memory -> nats).
      client = new ProjectBusClient(this.proxyTransport, projectSlug, sourceApp);
      this.projectClients.set(key, client);
    }
    return client;
  }

  private readonly proxyTransport: IStackBusTransport = {
    get driver() {
      return 'memory' as StackBusDriverKind;
    },
    connect: () => this.connect(),
    disconnect: () => this.disconnect(),
    publish: (input) => this.publish(input),
    subscribe: (options, handler) => this.subscribe(options, handler),
    subscribe$: (options) => this.subscribe$(options),
    replay: (options) => this.replay(options),
    getStatus: () => this.getStatus(),
  };

  publish<TPayload = Record<string, unknown>>(
    input: StackBusPublishInput<TPayload>,
  ): Promise<StackBusEnvelope<TPayload>> {
    return this._transport.publish(input);
  }

  subscribe<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle> {
    return this._transport.subscribe(options, handler);
  }

  subscribe$<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions = {},
  ): Observable<StackBusEnvelope<TPayload>> {
    return this.transportSubject.pipe(
      switchMap((t) => t.subscribe$<TPayload>(options)),
    );
  }

  replay<TPayload = Record<string, unknown>>(
    options: StackBusReplayOptions = {},
  ): Promise<StackBusEnvelope<TPayload>[]> {
    return this._transport.replay(options);
  }

  getStatus(): Promise<StackBusStatus> {
    return this._transport.getStatus();
  }
}

/**
 * Creates and connects a StackBusHub.
 * In `auto` mode (default), attempts NATS JetStream (`NATS_URL` / `nats://127.0.0.1:4222`)
 * and cleanly falls back to `InMemoryStackBusTransport` if NATS is not reachable.
 */
export async function createConnectedStackBus(
  options: CreateStackBusOptions = {},
): Promise<StackBusHub> {
  const driver = (options.driver ?? (process.env.LEMON_BUS_DRIVER as any) ?? 'auto')
    .toString()
    .toLowerCase();

  if (driver === 'memory') {
    const mem = new InMemoryStackBusTransport({
      maxBufferSize: options.maxBufferSize,
      streamName: options.streamName,
    });
    await mem.connect();
    return new StackBusHub(mem);
  }

  const nats = new NatsJetStreamTransport(options);
  if (driver === 'nats') {
    await nats.connect();
    return new StackBusHub(nats);
  }

  try {
    await nats.connect();
    return new StackBusHub(nats);
  } catch {
    const mem = new InMemoryStackBusTransport({
      maxBufferSize: options.maxBufferSize,
      streamName: options.streamName,
    });
    await mem.connect();
    return new StackBusHub(mem);
  }
}
