import {
  StreamDescriptor,
  StreamFilter,
  StreamLoadStats,
  FlowImpulsePacket,
} from '../types/core.types';

export class StreamRegistry {
  private readonly streams = new Map<string, StreamDescriptor>();
  private readonly stats = new Map<
    string,
    {
      received: number;
      emitted: number;
      suppressed: number;
      lastImpulseAt: string | null;
      subscribers: number;
    }
  >();

  registerStream(descriptor: StreamDescriptor): void {
    this.streams.set(descriptor.id, descriptor);
    if (!this.stats.has(descriptor.id)) {
      this.stats.set(descriptor.id, {
        received: 0,
        emitted: 0,
        suppressed: 0,
        lastImpulseAt: null,
        subscribers: 0,
      });
    }
  }

  unregisterStream(streamId: string): boolean {
    this.stats.delete(streamId);
    return this.streams.delete(streamId);
  }

  getStream(streamId: string): StreamDescriptor | undefined {
    return this.streams.get(streamId);
  }

  listStreams(filter?: { flowType?: string; folderId?: string }): StreamDescriptor[] {
    let result = Array.from(this.streams.values());
    if (filter?.flowType) {
      result = result.filter((s) => s.flowType === filter.flowType);
    }
    if (filter?.folderId) {
      result = result.filter((s) => s.folderId === filter.folderId);
    }
    return result;
  }

  recordPacketReceived(streamId: string, timestamp: string): void {
    const s = this.stats.get(streamId);
    if (s) {
      s.received++;
      s.lastImpulseAt = timestamp;
    }
  }

  recordPacketEmitted(streamId: string): void {
    const s = this.stats.get(streamId);
    if (s) {
      s.emitted++;
    }
  }

  recordPacketSuppressed(streamId: string): void {
    const s = this.stats.get(streamId);
    if (s) {
      s.suppressed++;
    }
  }

  incrementSubscribers(streamId: string): void {
    const s = this.stats.get(streamId);
    if (s) s.subscribers++;
  }

  decrementSubscribers(streamId: string): void {
    const s = this.stats.get(streamId);
    if (s && s.subscribers > 0) s.subscribers--;
  }

  getStreamStats(streamId: string): StreamLoadStats | null {
    const desc = this.streams.get(streamId);
    const s = this.stats.get(streamId);
    if (!desc || !s) return null;

    const total = s.received;
    const reduction = total > 0 ? (s.suppressed / total) * 100 : 0;

    return {
      streamId: desc.id,
      streamName: desc.name,
      totalReceived: s.received,
      totalEmitted: s.emitted,
      totalSuppressed: s.suppressed,
      reductionPercentage: Math.round(reduction * 10) / 10,
      lastImpulseAt: s.lastImpulseAt,
      activeSubscribers: s.subscribers,
    };
  }

  getAllStats(): StreamLoadStats[] {
    const list: StreamLoadStats[] = [];
    for (const id of this.streams.keys()) {
      const st = this.getStreamStats(id);
      if (st) list.push(st);
    }
    return list;
  }

  matchesFilter(packet: FlowImpulsePacket, filter?: StreamFilter): boolean {
    if (!filter) return true;
    if (filter.folderId && packet.folderId !== filter.folderId) return false;
    if (filter.flowId && packet.flowId !== filter.flowId) return false;
    if (filter.flowType && packet.flowType !== filter.flowType) return false;
    if (filter.impulseType && packet.type !== filter.impulseType) return false;
    if (filter.persistenceTier && packet.persistence !== filter.persistenceTier) return false;
    return true;
  }
}
