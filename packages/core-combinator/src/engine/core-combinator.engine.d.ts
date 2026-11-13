import { Observable } from 'rxjs';
import { StreamLoadOptimizer } from '../optimizer/stream-load-optimizer';
import { StreamRegistry } from '../registry/stream-registry';
import { FlowImpulsePacket, OptimizationMetrics, StreamDescriptor, StreamFilter, StreamLoadStats } from '../types/core.types';
export declare class CoreCombinatorEngine {
    readonly registry: StreamRegistry;
    readonly optimizer: StreamLoadOptimizer;
    private readonly bus$;
    constructor(options?: {
        optimizer?: StreamLoadOptimizer;
        registry?: StreamRegistry;
    });
    /**
     * Registers a new reactive stream with the Combinator Core.
     */
    registerStream(descriptor: StreamDescriptor): void;
    /**
     * Ingests a raw impulse into the combinator. The impulse goes through the StreamLoadOptimizer
     * for debouncing, coalescing, and telemetry tiering before being broadcast to subscribers.
     */
    emit(packet: FlowImpulsePacket, onOptimizedReady?: (packet: FlowImpulsePacket) => void): void;
    /**
     * Subscribes to the optimized event bus with optional stream filtering.
     * Tracks active subscriber metrics on the registry.
     */
    stream$(options?: StreamFilter): Observable<FlowImpulsePacket>;
    /**
     * Retrieves overall system optimization metrics.
     */
    getOptimizationMetrics(): OptimizationMetrics;
    /**
     * Retrieves per-stream statistics and load reduction data.
     */
    getStreamStats(streamId: string): StreamLoadStats | null;
    /**
     * Retrieves stats for all registered streams.
     */
    getAllStreamStats(): StreamLoadStats[];
    /**
     * Gracefully flushes all pending buffers.
     */
    flush(): void;
}
