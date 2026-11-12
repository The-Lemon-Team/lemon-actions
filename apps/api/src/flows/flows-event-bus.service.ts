import { Injectable } from '@nestjs/common';
import { FlowType } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type FlowImpulseType =
  | 'MUTEX_STATUS'
  | 'CONTEXT_UPDATED'
  | 'TIMER_TICK'
  | 'CIRCUIT_BREAKER_STATE'
  | 'BATCH_FLUSH'
  | 'PROJECTION_UPDATED'
  | 'FLOW_TRIGGER'
  | 'CHRONICLE_EVENT';

export interface FlowImpulsePacket {
  id: string;
  type: FlowImpulseType;
  folderId: string | null;
  flowId: string;
  flowName: string;
  flowType: FlowType;
  timestamp: string;
  payload: Record<string, unknown>;
  activeSessionIds?: string[];
}

export interface StreamFilter {
  folderId?: string;
  flowId?: string;
  flowType?: FlowType;
  impulseType?: FlowImpulseType;
}

@Injectable()
export class FlowsEventBusService {
  private readonly bus$ = new Subject<FlowImpulsePacket>();

  emit(packet: FlowImpulsePacket): void {
    this.bus$.next(packet);
  }

  stream$(filterOptions?: StreamFilter): Observable<FlowImpulsePacket> {
    return this.bus$.asObservable().pipe(
      filter((packet) => {
        if (!filterOptions) return true;
        if (filterOptions.folderId && packet.folderId !== filterOptions.folderId) return false;
        if (filterOptions.flowId && packet.flowId !== filterOptions.flowId) return false;
        if (filterOptions.flowType && packet.flowType !== filterOptions.flowType) return false;
        if (filterOptions.impulseType && packet.type !== filterOptions.impulseType) return false;
        return true;
      }),
    );
  }
}
