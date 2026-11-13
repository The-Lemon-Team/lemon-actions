import { Observable, Subject } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';
import { StreamLoadOptimizer } from '../optimizer/stream-load-optimizer';
import { StreamRegistry } from '../registry/stream-registry';
import {
  FlowImpulsePacket,
  OptimizationMetrics,
  StreamDescriptor,
  StreamFilter,
  StreamLoadStats,
} from '../types/core.types';

export class CoreCombinatorEngine {
  public readonly registry: StreamRegistry;
  public readonly optimizer: StreamLoadOptimizer;
  private readonly bus$ = new Subject<FlowImpulsePacket>();

  constructor(options?: { optimizer?: StreamLoadOptimizer; registry?: StreamRegistry }) {
    this.registry = options?.registry ?? new StreamRegistry();
    this.optimizer = options?.optimizer ?? new StreamLoadOptimizer();
  }

  /**
   * Registers a new reactive stream with the Combinator Core.
   */
  registerStream(descriptor: StreamDescriptor): void {
    this.registry.registerStream(descriptor);
  }

  /**
   * Ingests a raw impulse into the combinator. The impulse goes through the StreamLoadOptimizer
   * for debouncing, coalescing, and telemetry tiering before being broadcast to subscribers.
   */
  emit(packet: FlowImpulsePacket, onOptimizedReady?: (packet: FlowImpulsePacket) => void): void {
    this.registry.recordPacketReceived(packet.flowId, packet.timestamp);

    this.optimizer.process(packet, (optimizedPacket) => {
      this.registry.recordPacketEmitted(optimizedPacket.flowId);
      this.bus$.next(optimizedPacket);
      if (onOptimizedReady) {
        onOptimizedReady(optimizedPacket);
      }
    });
  }

  /**
   * Subscribes to the optimized event bus with optional stream filtering.
   * Tracks active subscriber metrics on the registry.
   */
  stream$(options?: StreamFilter): Observable<FlowImpulsePacket> {
    const flowId = options?.flowId;
    if (flowId) {
      this.registry.incrementSubscribers(flowId);
    }

    return this.bus$.asObservable().pipe(
      filter((packet: FlowImpulsePacket) => this.registry.matchesFilter(packet, options)),
      finalize(() => {
        if (flowId) {
          this.registry.decrementSubscribers(flowId);
        }
      }),
    );
  }

  /**
   * Retrieves overall system optimization metrics.
   */
  getOptimizationMetrics(): OptimizationMetrics {
    return this.optimizer.getMetrics();
  }

  /**
   * Retrieves per-stream statistics and load reduction data.
   */
  getStreamStats(streamId: string): StreamLoadStats | null {
    return this.registry.getStreamStats(streamId);
  }

  /**
   * Retrieves stats for all registered streams.
   */
  getAllStreamStats(): StreamLoadStats[] {
    return this.registry.getAllStats();
  }

  /**
   * Gracefully flushes all pending buffers.
   */
  flush(): void {
    this.optimizer.flushAll((p) => {
      this.registry.recordPacketEmitted(p.flowId);
      this.bus$.next(p);
    });
  }
}
