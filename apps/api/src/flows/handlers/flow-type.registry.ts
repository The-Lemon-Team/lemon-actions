import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { FlowType } from '@prisma/client';
import { FLOW_TYPE_HANDLERS, FlowTypeHandler } from './flow-type.handler';

@Injectable()
export class FlowTypeRegistry {
  private readonly byType = new Map<FlowType, FlowTypeHandler>();

  constructor(@Inject(FLOW_TYPE_HANDLERS) handlers: FlowTypeHandler[]) {
    handlers.forEach((h) => this.byType.set(h.type, h));
  }

  get(type: FlowType): FlowTypeHandler {
    const h = this.byType.get(type);
    if (!h) throw new BadRequestException(`No handler registered for flow type ${type}`);
    return h;
  }
}
