import { StreamDescriptor, StreamFilter, StreamLoadStats, FlowImpulsePacket } from '../types/core.types';
export declare class StreamRegistry {
    private readonly streams;
    private readonly stats;
    registerStream(descriptor: StreamDescriptor): void;
    unregisterStream(streamId: string): boolean;
    getStream(streamId: string): StreamDescriptor | undefined;
    listStreams(filter?: {
        flowType?: string;
        folderId?: string;
    }): StreamDescriptor[];
    recordPacketReceived(streamId: string, timestamp: string): void;
    recordPacketEmitted(streamId: string): void;
    recordPacketSuppressed(streamId: string): void;
    incrementSubscribers(streamId: string): void;
    decrementSubscribers(streamId: string): void;
    getStreamStats(streamId: string): StreamLoadStats | null;
    getAllStats(): StreamLoadStats[];
    matchesFilter(packet: FlowImpulsePacket, filter?: StreamFilter): boolean;
}
