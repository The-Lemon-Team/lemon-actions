import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { FlowType } from '@prisma/client';
import { FLOW_TYPE_HANDLERS, FlowTypeHandler } from './flow-type.handler';

@Injectable()
export class FlowTypeRegistry {
  private readonly byType = new Map<FlowType, FlowTypeHandler>();

  constructor(@Inject(FLOW_TYPE_HANDLERS) handlers: FlowTypeHandler[]) {
    handlers.forEach((h) => this.register(h));
  }

  register(handler: FlowTypeHandler): void {
    this.byType.set(handler.type, handler);
  }

  get(type: FlowType): FlowTypeHandler {
    const h = this.byType.get(type);
    if (!h) throw new BadRequestException(`No handler registered for flow type ${type}`);
    return h;
  }

  has(type: FlowType): boolean {
    return this.byType.has(type);
  }
}
