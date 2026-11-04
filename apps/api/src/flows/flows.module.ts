import { Module } from '@nestjs/common';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsController } from './flows.controller';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS, FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

@Module({
  controllers: [FlowsController],
  providers: [
    FlowsService,
    FlowsRepository,
    FlowTypeRegistry,
    FlowSchedulerService,
    // Add new FlowType handlers to this list; no orchestrator change required.
    { provide: FLOW_TYPE_HANDLERS, useValue: DEFAULT_FLOW_TYPE_HANDLERS },
  ],
  exports: [FlowsService, FlowSchedulerService],
})
export class FlowsModule {}
