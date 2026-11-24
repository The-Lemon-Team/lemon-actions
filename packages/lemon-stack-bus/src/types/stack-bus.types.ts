import { Observable } from 'rxjs';

export type StackBusDriverKind = 'nats' | 'memory';

export interface StackBusEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  seq: number;
  /** Canonical hierarchical topic: `lemon.<projectSlug>.<domain>.<event>` */
  topic: string;
  projectSlug: string;
  domain: string;
  event: string;
  sourceApp: string;
  timestamp: string;
  correlationId?: string;
  dedupKey?: string;
  tags?: string[];
  payload: TPayload;
}

export interface StackBusPublishInput<TPayload = Record<string, unknown>> {
  /** Either full `lemon.<project>.<domain>.<event>` or relative `<domain>.<event>` when using ProjectBusClient */
  topic?: string;
  projectSlug?: string;
  domain?: string;
  event?: string;
  sourceApp?: string;
  correlationId?: string;
  dedupKey?: string;
  tags?: string[];
  payload: TPayload;
}

export type StackBusDeliverPolicy = 'new' | 'all' | 'last';

export interface StackBusSubscriptionOptions {
  /** Single pattern or list of NATS-style wildcard patterns (`*` = 1 token, `>` = 1+ trailing tokens). */
  topicPattern?: string | string[];
  /** Optional project isolation filter (`lemon.<projectSlug>.>`). */
  projectSlug?: string;
  /** Optional durable JetStream consumer name for reliable resumable delivery. */
  durableName?: string;
  deliverPolicy?: StackBusDeliverPolicy;
  startSeq?: number;
  /** Optional tag filter (matches if envelope.tags contains at least one requested tag). */
  tags?: string[];
}

export interface StackBusReplayOptions {
  topicPattern?: string | string[];
  projectSlug?: string;
  sinceSeq?: number;
  limit?: number;
}

export interface StackBusProjectSummary {
  projectSlug: string;
  publishedCount: number;
  lastEventAt: string | null;
  topics: string[];
}

export interface StackBusStatus {
  driver: StackBusDriverKind;
  connected: boolean;
  streamName: string;
  natsUrl?: string;
  totalPublished: number;
  totalDelivered: number;
  bufferedCount: number;
  projects: StackBusProjectSummary[];
  lastError?: string;
}

export interface StackBusSubscriptionHandle {
  unsubscribe(): Promise<void> | void;
}

export interface IStackBusTransport {
  readonly driver: StackBusDriverKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish<TPayload = Record<string, unknown>>(
    input: StackBusPublishInput<TPayload>,
  ): Promise<StackBusEnvelope<TPayload>>;
  subscribe<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle>;
  subscribe$<TPayload = Record<string, unknown>>(
    options?: StackBusSubscriptionOptions,
  ): Observable<StackBusEnvelope<TPayload>>;
  replay<TPayload = Record<string, unknown>>(
    options?: StackBusReplayOptions,
  ): Promise<StackBusEnvelope<TPayload>[]>;
  getStatus(): Promise<StackBusStatus>;
}
