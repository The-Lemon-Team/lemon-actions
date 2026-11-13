import { Subject, Observable } from 'rxjs';
import {
  CoalesceRule,
  FlowImpulsePacket,
  FlowImpulseType,
  OptimizationMetrics,
  StreamPersistenceTier,
} from '../types/core.types';

export class StreamLoadOptimizer {
  private readonly defaultRules: Record<FlowImpulseType, CoalesceRule> = {
    TIMER_TICK: { windowMs: 2000, ephemeral: true },
    AGENT_HEARTBEAT: { windowMs: 3000, ephemeral: true },
    CONTEXT_UPDATED: { windowMs: 500, ephemeral: false },
    MUTEX_STATUS: { windowMs: 300, ephemeral: false },
    CIRCUIT_BREAKER_STATE: { windowMs: 100, ephemeral: false },
    BATCH_FLUSH: { windowMs: 0, ephemeral: false },
    PROJECTION_UPDATED: { windowMs: 800, ephemeral: false },
    FLOW_TRIGGER: { windowMs: 250, ephemeral: false },
    CHRONICLE_EVENT: { windowMs: 0, ephemeral: false },
    AGENT_SESSION_INIT: { windowMs: 0, ephemeral: false },
    AGENT_DECISION: { windowMs: 0, ephemeral: false },
    DAILY_DIGEST_COMMITTED: { windowMs: 0, ephemeral: false },
    TASK_STATUS_CHANGED: { windowMs: 400, ephemeral: false },
  };

  private readonly coalescingBuffers = new Map<
    string,
    {
      packet: FlowImpulsePacket;
      timer: any;
      count: number;
    }
  >();

  private totalReceived = 0;
  private totalEmitted = 0;
  private totalSuppressed = 0;
  private ephemeralCount = 0;

  private readonly optimizedBus$ = new Subject<FlowImpulsePacket>();

  constructor(private customRules?: Partial<Record<FlowImpulseType, CoalesceRule>>) {}

  /**
   * Enqueues an impulse into the load optimizer. If the impulse is configured for coalescing,
   * it waits within the window and merges incoming rapid pulses into a single consolidated packet.
   */
  process(packet: FlowImpulsePacket, onReady: (optimizedPacket: FlowImpulsePacket) => void): void {
    this.totalReceived++;

    const rule = this.resolveRule(packet.type);
    const persistence: StreamPersistenceTier = packet.persistence ?? (rule.ephemeral ? 'EPHEMERAL' : 'DURABLE');
    packet.persistence = persistence;

    if (persistence === 'EPHEMERAL') {
      this.ephemeralCount++;
    }

    // If no windowing required, emit immediately
    if (!rule.windowMs || rule.windowMs <= 0) {
      this.totalEmitted++;
      this.optimizedBus$.next(packet);
      onReady(packet);
      return;
    }

    // Coalesce key: by flowId + impulseType
    const coalesceKey = `${packet.flowId}:${packet.type}`;
    const existing = this.coalescingBuffers.get(coalesceKey);

    if (existing) {
      // Suppress and coalesce payload
      this.totalSuppressed++;
      existing.count++;

      if (rule.mergePayload) {
        existing.packet.payload = rule.mergePayload(
          existing.packet.payload,
          packet.payload,
          existing.count,
        );
      } else {
        // Default payload merger: shallow merge and update timestamp
        existing.packet.payload = {
          ...existing.packet.payload,
          ...packet.payload,
          _coalescedPulses: existing.count,
        };
      }

      existing.packet.timestamp = packet.timestamp;
      existing.packet.metadata = {
        ...(existing.packet.metadata || {}),
        coalescedCount: existing.count,
      };
      return;
    }

    // First impulse in window -> start debounce timer
    const entry = {
      packet: { ...packet, metadata: { ...(packet.metadata || {}), coalescedCount: 1 } },
      count: 1,
      timer: null as any,
    };

    entry.timer = setTimeout(() => {
      this.coalescingBuffers.delete(coalesceKey);
      this.totalEmitted++;
      this.optimizedBus$.next(entry.packet);
      onReady(entry.packet);
    }, rule.windowMs);

    this.coalescingBuffers.set(coalesceKey, entry);
  }

  /**
   * Observable stream of all optimized packets.
   */
  get stream$(): Observable<FlowImpulsePacket> {
    return this.optimizedBus$.asObservable();
  }

  /**
   * Real-time metrics showing how much stream load was reduced.
   */
  getMetrics(): OptimizationMetrics {
    const total = this.totalReceived;
    const reductionRate = total > 0 ? (this.totalSuppressed / total) * 100 : 0;
    const ephemeralRatio = total > 0 ? (this.ephemeralCount / total) * 100 : 0;

    return {
      totalImpulsesReceived: this.totalReceived,
      totalImpulsesEmitted: this.totalEmitted,
      totalImpulsesSuppressed: this.totalSuppressed,
      overallReductionRate: Math.round(reductionRate * 10) / 10,
      activeRegisteredStreams: this.coalescingBuffers.size,
      ephemeralPulsesRatio: Math.round(ephemeralRatio * 10) / 10,
      lastOptimizedAt: new Date().toISOString(),
    };
  }

  /**
   * Force flush any currently pending buffers (e.g. on shutdown).
   */
  flushAll(onReady: (optimizedPacket: FlowImpulsePacket) => void): void {
    for (const [key, entry] of this.coalescingBuffers.entries()) {
      clearTimeout(entry.timer);
      this.coalescingBuffers.delete(key);
      this.totalEmitted++;
      this.optimizedBus$.next(entry.packet);
      onReady(entry.packet);
    }
  }

  private resolveRule(type: FlowImpulseType): CoalesceRule {
    if (this.customRules && this.customRules[type]) {
      return this.customRules[type]!;
    }
    return this.defaultRules[type] || { windowMs: 0, ephemeral: false };
  }
}
