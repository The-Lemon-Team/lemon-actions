import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import { matchesAnyTopicPattern, StackBusEnvelope } from '@lemon/stack-bus';
import { Subscription } from 'rxjs';
import { StackBusService } from '../bus/stack-bus.service';
import { FlowsEventBusService, FlowImpulsePacket } from './flows-event-bus.service';
import { FlowView } from './flows.repository';
import { FlowsService } from './flows.service';

export interface ObserverSelectorConfig {
  topics?: string[];
  tags?: string[];
  projectSlug?: string;
  crossProject?: boolean;
  targetFlowIds?: string[];
  persistEvents?: boolean;
}

const MAX_SEEN_EVENT_IDS = 1000;

@Injectable()
export class LemonBusRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LemonBusRelayService.name);
  private outboundSub: Subscription | null = null;
  private inboundSub: Subscription | null = null;
  private readonly seenEventIds = new Set<string>();

  constructor(
    private readonly eventBus: FlowsEventBusService,
    @Optional() private readonly stackBus?: StackBusService,
    @Optional() private readonly flowsService?: FlowsService,
  ) {}

  onModuleInit(): void {
    this.outboundSub = this.eventBus.stream$().subscribe((packet) => {
      if (packet.metadata?.source === 'stack-bus-observer') return;
      if (packet.type === 'AGENT_HEARTBEAT') return;
      void this.relayToBus(packet);
    });

    if (this.stackBus) {
      this.inboundSub = this.stackBus.subscribe$({ topicPattern: 'lemon.>' }).subscribe((envelope) => {
        void this.dispatchToObserverFlows(envelope);
      });
    }
  }

  onModuleDestroy(): void {
    this.outboundSub?.unsubscribe();
    this.outboundSub = null;
    this.inboundSub?.unsubscribe();
    this.inboundSub = null;
  }

  /**
   * Relays a Core Combinator impulse onto the persistent/cross-process Lemon Stack Bus.
   */
  async relayToBus(packet: FlowImpulsePacket): Promise<void> {
    if (!this.stackBus) return;
    try {
      const projectSlug = packet.projectSlug || 'lemon-core';
      const eventName = packet.type.toLowerCase();
      await this.stackBus.publish({
        topic: packet.topic || `lemon.${projectSlug}.flow.${eventName}`,
        projectSlug,
        domain: 'flow',
        event: eventName,
        sourceApp: 'lemon-actions-core',
        dedupKey: `impulse:${packet.id}`,
        tags: [projectSlug, 'flow', packet.flowType.toLowerCase()],
        payload: {
          flowId: packet.flowId,
          flowName: packet.flowName,
          flowType: packet.flowType,
          folderId: packet.folderId,
          impulseType: packet.type,
          data: packet.payload,
        },
      });
    } catch (err) {
      this.logger.debug(
        `StackBus relay skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Matches an incoming StackBusEnvelope against active OBSERVER flows (`config.selector`)
   * and triggers/records matching flows in lemon-core.
   */
  async dispatchToObserverFlows(envelope: StackBusEnvelope<any>): Promise<string[]> {
    if (!this.flowsService) return [];
    // Do not loop internally relayed flow impulses back into generic observers
    if (envelope.domain === 'flow' && envelope.sourceApp === 'lemon-actions-core') {
      return [];
    }
    if (this.seenEventIds.has(envelope.eventId)) {
      return [];
    }
    this.trackSeenEventId(envelope.eventId);

    let observers: FlowView[];
    try {
      observers = await this.flowsService.list({
        type: FlowType.OBSERVER,
        status: FlowStatus.ACTIVE,
      });
    } catch (err) {
      this.logger.debug(
        `Observer lookup skipped (DB unavailable): ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    const matchedFlowIds: string[] = [];
    for (const observer of observers) {
      if (!this.matchesObserverSelector(observer, envelope)) continue;
      matchedFlowIds.push(observer.id);

      const cfg = (observer.config ?? {}) as Record<string, any>;
      const selector = (cfg.selector ?? {}) as ObserverSelectorConfig;
      const shouldPersist = selector.persistEvents !== false;

      if (shouldPersist) {
        try {
          await this.flowsService.appendEvent(observer.id, {
            source: `stack-bus:${envelope.sourceApp}`,
            eventType: envelope.topic,
            payload: {
              eventId: envelope.eventId,
              projectSlug: envelope.projectSlug,
              domain: envelope.domain,
              event: envelope.event,
              tags: envelope.tags ?? [],
              data: envelope.payload,
            },
          });
        } catch (err) {
          this.logger.debug(
            `Observer appendEvent failed (${observer.id}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        this.eventBus.emit({
          id: envelope.eventId,
          type: 'FLOW_TRIGGER',
          folderId: observer.folderId,
          projectSlug: observer.projectSlug ?? envelope.projectSlug,
          topic: envelope.topic,
          flowId: observer.id,
          flowName: observer.name,
          flowType: observer.type,
          timestamp: envelope.timestamp,
          payload: envelope.payload,
          metadata: { source: 'stack-bus-observer' },
        });
      }

      if (Array.isArray(selector.targetFlowIds)) {
        for (const targetId of selector.targetFlowIds) {
          await this.flowsService
            .appendEvent(targetId, {
              source: `observer:${observer.id}`,
              eventType: envelope.event.toUpperCase(),
              payload: envelope.payload,
            })
            .catch(() => {});
        }
      }
    }

    return matchedFlowIds;
  }

  matchesObserverSelector(flow: FlowView, envelope: StackBusEnvelope<any>): boolean {
    const cfg = (flow.config ?? {}) as Record<string, any>;
    const selector = (cfg.selector ?? {}) as ObserverSelectorConfig;
    const topics = Array.isArray(selector.topics) ? selector.topics.filter(Boolean) : [];
    const tags = Array.isArray(selector.tags) ? selector.tags.map((t) => t.toLowerCase()) : [];

    if (topics.length === 0 && tags.length === 0) {
      return false;
    }

    const scopedProject = (selector.projectSlug ?? flow.projectSlug ?? '').trim().toLowerCase();
    const hasExplicitCrossTopic = topics.some(
      (t) => t.startsWith('lemon.*.') || (scopedProject && t.startsWith('lemon.') && !t.startsWith(`lemon.${scopedProject}.`)),
    );
    if (scopedProject && !selector.crossProject && !hasExplicitCrossTopic) {
      if (envelope.projectSlug.toLowerCase() !== scopedProject) {
        return false;
      }
    }

    const topicMatched =
      topics.length === 0 ||
      topics.some((pattern) => {
        const p = pattern.trim().toLowerCase();
        if (p.startsWith('lemon.')) {
          return matchesAnyTopicPattern(p, envelope.topic);
        }
        // Support short domain.event patterns such as `media.created` or `bounty.*`
        const shortTopic = `${envelope.domain}.${envelope.event}`.toLowerCase();
        return matchesAnyTopicPattern(p, shortTopic) || matchesAnyTopicPattern(`lemon.*.${p}`, envelope.topic);
      });

    const envTags = new Set(
      [
        ...(envelope.tags ?? []),
        envelope.projectSlug,
        envelope.domain,
        envelope.event,
      ].map((t) => t.toLowerCase()),
    );
    const tagMatched = tags.length === 0 || tags.some((t) => envTags.has(t));

    return topicMatched && tagMatched;
  }

  private trackSeenEventId(eventId: string): void {
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > MAX_SEEN_EVENT_IDS) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) this.seenEventIds.delete(oldest);
    }
  }
}
