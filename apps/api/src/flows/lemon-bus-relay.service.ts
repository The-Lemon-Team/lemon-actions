import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { FlowsEventBusService, FlowImpulsePacket } from './flows-event-bus.service';

@Injectable()
export class LemonBusRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LemonBusRelayService.name);
  private sub: Subscription | null = null;
  private readonly busUrl = process.env.LEMON_BUS_URL || null;

  constructor(private readonly eventBus: FlowsEventBusService) {}

  onModuleInit() {
    this.sub = this.eventBus.stream$().subscribe((packet) => {
      this.relayToBus(packet).catch((err) => {
        this.logger.debug(`Could not relay impulse to LemonBus: ${err.message}`);
      });
    });
  }

  onModuleDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
  }

  private async relayToBus(packet: FlowImpulsePacket): Promise<void> {
    if (!this.busUrl) return;

    try {
      if (typeof fetch !== 'undefined') {
        await fetch(`${this.busUrl.replace(/\/+$/, '')}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: 'lemon.combinator.impulses',
            payload: packet,
          }),
        });
      }
    } catch (e: any) {
      // Non-blocking relay
      this.logger.debug(`LemonBus broadcast error: ${e.message}`);
    }
  }
}
