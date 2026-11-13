import { Observable } from 'rxjs';
import { CoalesceRule, FlowImpulsePacket, FlowImpulseType, OptimizationMetrics } from '../types/core.types';
export declare class StreamLoadOptimizer {
    private customRules?;
    private readonly defaultRules;
    private readonly coalescingBuffers;
    private totalReceived;
    private totalEmitted;
    private totalSuppressed;
    private ephemeralCount;
    private readonly optimizedBus$;
    constructor(customRules?: Partial<Record<FlowImpulseType, CoalesceRule>> | undefined);
    /**
     * Enqueues an impulse into the load optimizer. If the impulse is configured for coalescing,
     * it waits within the window and merges incoming rapid pulses into a single consolidated packet.
     */
    process(packet: FlowImpulsePacket, onReady: (optimizedPacket: FlowImpulsePacket) => void): void;
    /**
     * Observable stream of all optimized packets.
     */
    get stream$(): Observable<FlowImpulsePacket>;
    /**
     * Real-time metrics showing how much stream load was reduced.
     */
    getMetrics(): OptimizationMetrics;
    /**
     * Force flush any currently pending buffers (e.g. on shutdown).
     */
    flushAll(onReady: (optimizedPacket: FlowImpulsePacket) => void): void;
    private resolveRule;
}
