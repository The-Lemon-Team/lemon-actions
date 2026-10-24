import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { CreateFlowDto, ListFlowsQueryDto, UpdateFlowDto, UpdateFlowStatusDto } from './flow.dto';
import { FlowsService } from './flows.service';

@Controller('flows')
export class FlowsController {
  constructor(private readonly service: FlowsService) {}

  @Get()
  list(@Query() q: ListFlowsQueryDto) {
    return this.service.list(q);
  }

  // Must be declared before ':id'
  @Get('metrics')
  metrics() {
    return this.service.metrics();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFlowDto) {
    return this.service.create(dto);
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
