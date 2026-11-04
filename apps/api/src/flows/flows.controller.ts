import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateFlowDto,
  CreateFlowEventDto,
  ListFlowEventsQueryDto,
  ListFlowsQueryDto,
  UpdateFlowDto,
  UpdateFlowStatusDto,
} from './flow.dto';
import { FlowsService } from './flows.service';

@Controller('flows')
export class FlowsController {
  constructor(private readonly service: FlowsService) {}

  @Get()
  list(
    @Query() q: ListFlowsQueryDto,
    @Headers('x-profile-id') headerProfileId?: string,
    @Headers('x-app-scope') headerScope?: string,
  ) {
    return this.service.list({
      ...q,
      profileId: q.profileId ?? headerProfileId,
      scope: q.scope ?? headerScope,
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

  @Post(':id/events')
  appendEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFlowEventDto) {
    return this.service.appendEvent(id, dto);
  }

  @Post()
  create(
    @Body() dto: CreateFlowDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.service.create({
      ...dto,
      profileId: dto.profileId ?? headerProfileId ?? null,
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
