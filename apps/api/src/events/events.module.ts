import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { CreateEventDto, ListEventsQueryDto } from './event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  list(@Query() q: ListEventsQueryDto) {
    return this.service.list(q.actionId);
  }

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.service.create(dto);
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
