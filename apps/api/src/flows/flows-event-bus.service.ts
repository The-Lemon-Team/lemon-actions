import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { FlowType } from '@prisma/client';
import { Observable } from 'rxjs';
import {
  CoreCombinatorEngine,
  FlowImpulsePacket as CorePacket,
  FlowImpulseType as CoreImpulseType,
  OptimizationMetrics,
  StreamDescriptor,
  StreamFilter as CoreFilter,
  StreamLoadStats,
} from '@lemon/core-combinator';

export type FlowImpulseType = CoreImpulseType;
export type FlowImpulsePacket = CorePacket;
export type StreamFilter = CoreFilter;

@Injectable()
export class FlowsEventBusService implements OnModuleDestroy {
  public readonly engine: CoreCombinatorEngine;

  constructor() {
    this.engine = new CoreCombinatorEngine();
  }

  onModuleDestroy() {
    this.engine.flush();
  }

  registerStream(descriptor: StreamDescriptor): void {
    this.engine.registerStream(descriptor);
  }

  emit(packet: FlowImpulsePacket, onReady?: (p: FlowImpulsePacket) => void): void {
    this.engine.emit(packet, onReady);
  }

  stream$(filterOptions?: StreamFilter): Observable<FlowImpulsePacket> {
    return this.engine.stream$(filterOptions);
  }

  getMetrics(): OptimizationMetrics {
    return this.engine.getOptimizationMetrics();
  }

  getStreamStats(streamId: string): StreamLoadStats | null {
    return this.engine.getStreamStats(streamId);
  }

  getAllStreamStats(): StreamLoadStats[] {
    return this.engine.getAllStreamStats();
  }
}
