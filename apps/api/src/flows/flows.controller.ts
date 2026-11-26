import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  MessageEvent,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { FlowType } from '@prisma/client';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateFlowDto,
  CreateFlowEventDto,
  ListFlowEventsQueryDto,
  ListFlowsQueryDto,
  PushBatchItemsDto,
  TriggerFlowDto,
  TripCircuitBreakerDto,
  UpdateFlowDto,
  UpdateFlowStatusDto,
} from './flow.dto';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly service: FlowsService,
    @Optional() private readonly eventBus?: FlowsEventBusService,
  ) {}

  @Sse('stream')
  stream(
    @Query('folderId') folderId?: string,
    @Query('projectSlug') projectSlug?: string,
    @Query('topic') topic?: string,
    @Query('flowId') flowId?: string,
    @Query('flowType') flowType?: FlowType,
    @Query('impulseType') impulseType?: any,
  ): Observable<MessageEvent> {
    if (!this.eventBus) {
      return of({ data: { message: 'Event bus is not active' } } as MessageEvent);
    }
    return this.eventBus.stream$({ folderId, projectSlug, topic, flowId, flowType, impulseType }).pipe(
      map((packet) => ({ data: packet } as MessageEvent)),
    );
  }

  @Get('stream/metrics')
  streamMetrics() {
    return this.eventBus ? this.eventBus.getMetrics() : { totalImpulsesReceived: 0, overallReductionRate: 0 };
  }

  @Get('stream/stats')
  streamStats() {
    return this.eventBus ? this.eventBus.getAllStreamStats() : [];
  }

  @Get()
  list(
    @Query() q: ListFlowsQueryDto,
    @Headers('x-profile-id') headerProfileId?: string,
    @Headers('x-app-scope') headerScope?: string,
    @Headers('x-project-slug') headerProjectSlug?: string,
  ) {
    return this.service.list({
      ...q,
      profileId: q.profileId ?? headerProfileId,
      scope: q.scope ?? headerScope,
      projectSlug: q.projectSlug ?? headerProjectSlug,
    });
  }

  // Must be declared before ':id'
  @Get('metrics')
  metrics(
    @Query('profileId') queryProfileId?: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.service.metrics(queryProfileId ?? headerProfileId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/sessions')
  listSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listSessions(id);
  }

  @Get(':id/events')
  listEvents(@Param('id', ParseUUIDPipe) id: string, @Query() q: ListFlowEventsQueryDto) {
    return this.service.listEvents(id, q.sessionId);
  }

  @Get(':id/tasks')
  listTaskPool(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('actorId') actorId?: string,
    @Query('status') status?: string,
    @Query('tower') tower?: string,
  ) {
    return this.service.queryTaskPool(id, { actorId, status, tower });
  }

  @Post(':id/events')
  appendEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFlowEventDto) {
    return this.service.appendEvent(id, dto);
  }

  @Post(':id/trigger')
  trigger(@Param('id', ParseUUIDPipe) id: string, @Body() dto?: TriggerFlowDto) {
    return this.service.trigger(id, dto);
  }

  @Post(':id/batch/push')
  pushBatch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PushBatchItemsDto) {
    return this.service.pushBatch(id, dto);
  }

  @Post(':id/batch/flush')
  flushBatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.flushBatch(id, 'MANUAL_TRIGGER');
  }

  @Get(':id/batch/items')
  listBatchItems(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listBatchItems(id);
  }

  @Post(':id/circuit-breaker')
  updateCircuitBreaker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TripCircuitBreakerDto,
  ) {
    return this.service.updateCircuitBreaker(id, dto.state || 'OPEN', dto.reason);
  }

  @Post()
  create(
    @Body() dto: CreateFlowDto,
    @Headers('x-profile-id') headerProfileId?: string,
    @Headers('x-project-slug') headerProjectSlug?: string,
  ) {
    const defaultShardSlug =
      process.env.LEMON_SHARD_TIER === 'dedicated' ? process.env.LEMON_SHARD_PROJECT_SLUG : undefined;
    return this.service.create({
      ...dto,
      profileId: dto.profileId ?? headerProfileId ?? null,
      projectSlug: dto.projectSlug ?? headerProjectSlug ?? defaultShardSlug ?? null,
    });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlowDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlowStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
