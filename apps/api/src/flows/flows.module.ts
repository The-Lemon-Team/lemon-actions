import { Module } from '@nestjs/common';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsController } from './flows.controller';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { createDefaultFlowTypeHandlers, FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { PROJECTION_REDUCERS, ProjectionReducerRegistry } from './handlers/projection-reducer.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';
import { SpaceTowersProjectionReducer } from './reducers/space-towers.projection-reducer';
import { ShardRetentionService } from './shard-retention.service';
import { ShardTelemetryService } from './shard-telemetry.service';
import { ShardController } from './shard.controller';

@Module({
  controllers: [FlowsController, ShardController],
  providers: [
    FlowsEventBusService,
    LemonBusRelayService,
    FlowsService,
    FlowsRepository,
    {
      provide: PROJECTION_REDUCERS,
      useValue: [new SpaceTowersProjectionReducer()],
    },
    ProjectionReducerRegistry,
    {
      provide: FLOW_TYPE_HANDLERS,
      inject: [ProjectionReducerRegistry],
      useFactory: (reducers: ProjectionReducerRegistry) => createDefaultFlowTypeHandlers(reducers),
    },
    FlowTypeRegistry,
    FlowSchedulerService,
    ShardRetentionService,
    ShardTelemetryService,
  ],
  exports: [
    FlowsService,
    FlowSchedulerService,
    FlowsEventBusService,
    FlowTypeRegistry,
    ProjectionReducerRegistry,
    ShardRetentionService,
    ShardTelemetryService,
  ],
})
export class FlowsModule {}
