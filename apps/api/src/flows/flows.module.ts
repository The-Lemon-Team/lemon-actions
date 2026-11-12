import { Module } from '@nestjs/common';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsController } from './flows.controller';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS, FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';

@Module({
  controllers: [FlowsController],
  providers: [
    FlowsEventBusService,
    LemonBusRelayService,
    FlowsService,
    FlowsRepository,
    FlowTypeRegistry,
    FlowSchedulerService,
    // Add new FlowType handlers to this list; no orchestrator change required.
    { provide: FLOW_TYPE_HANDLERS, useValue: DEFAULT_FLOW_TYPE_HANDLERS },
  ],
  exports: [FlowsService, FlowSchedulerService, FlowsEventBusService],
})
export class FlowsModule {}
