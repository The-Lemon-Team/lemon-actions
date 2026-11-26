import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import {
  createConnectedStackBus,
  InMemoryStackBusTransport,
  ProjectBusClient,
  StackBusEnvelope,
  StackBusHub,
  StackBusPublishInput,
  StackBusReplayOptions,
  StackBusStatus,
  StackBusSubscriptionHandle,
  StackBusSubscriptionOptions,
} from '@lemon/stack-bus';
import { Observable } from 'rxjs';

export const STACK_BUS_HUB_TOKEN = Symbol('STACK_BUS_HUB_TOKEN');

@Injectable()
export class StackBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StackBusService.name);
  private hub: StackBusHub;
  private initialized = false;

  constructor(@Optional() @Inject(STACK_BUS_HUB_TOKEN) initialHub?: StackBusHub) {
    // Immediate in-memory hub guarantees publishers work even before async onModuleInit finishes.
    this.hub = initialHub ?? new StackBusHub(new InMemoryStackBusTransport());
  }

  async onModuleInit(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const connected = await createConnectedStackBus({
        driver: (process.env.LEMON_BUS_DRIVER as any) || 'auto',
        natsUrl: process.env.NATS_URL || 'nats://127.0.0.1:4222',
        streamName: process.env.LEMON_STACK_BUS_STREAM || 'LEMON_STACK_BUS',
      });
      if (connected.driver === 'nats') {
        // Swap underlying transport seamlessly so existing ProjectBusClient references keep working.
        this.hub.transport = connected.transport;
        this.logger.log(`Lemon Stack Bus connected to NATS JetStream (${process.env.NATS_URL || 'nats://127.0.0.1:4222'})`);
      } else {
        await this.hub.connect();
        this.logger.log('Lemon Stack Bus running with InMemory transport (NATS unavailable)');
      }
    } catch (err) {
      await this.hub.connect();
      this.logger.warn(
        `Lemon Stack Bus fallback to InMemory transport: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.hub.disconnect().catch(() => {});
  }

  get driver() {
    return this.hub.driver;
  }

  forProject(projectSlug: string, sourceApp?: string): ProjectBusClient {
    return this.hub.forProject(projectSlug, sourceApp);
  }

  publish<TPayload = Record<string, unknown>>(
    input: StackBusPublishInput<TPayload>,
  ): Promise<StackBusEnvelope<TPayload>> {
    return this.hub.publish(input);
  }

  subscribe<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions,
    handler: (envelope: StackBusEnvelope<TPayload>) => void | Promise<void>,
  ): Promise<StackBusSubscriptionHandle> {
    return this.hub.subscribe(options, handler);
  }

  subscribe$<TPayload = Record<string, unknown>>(
    options: StackBusSubscriptionOptions = {},
  ): Observable<StackBusEnvelope<TPayload>> {
    return this.hub.subscribe$(options);
  }

  replay<TPayload = Record<string, unknown>>(
    options: StackBusReplayOptions = {},
  ): Promise<StackBusEnvelope<TPayload>[]> {
    return this.hub.replay(options);
  }

  getStatus(): Promise<StackBusStatus> {
    return this.hub.getStatus();
  }
}
