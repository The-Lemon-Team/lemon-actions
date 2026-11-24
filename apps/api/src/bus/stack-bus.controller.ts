import { Body, Controller, Get, MessageEvent, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PublishBusEventDto, ReplayBusQueryDto } from './stack-bus.dto';
import { StackBusService } from './stack-bus.service';

@Controller('bus')
export class StackBusController {
  constructor(private readonly bus: StackBusService) {}

  @Get('status')
  status() {
    return this.bus.getStatus();
  }

  @Post('publish')
  publish(@Body() dto: PublishBusEventDto) {
    return this.bus.publish(dto);
  }

  @Get('replay')
  replay(@Query() q: ReplayBusQueryDto) {
    return this.bus.replay({
      projectSlug: q.projectSlug,
      topicPattern: q.topic,
      sinceSeq: q.sinceSeq,
      limit: q.limit,
    });
  }

  @Sse('stream')
  stream(
    @Query('projectSlug') projectSlug?: string,
    @Query('topic') topic?: string,
    @Query('tags') tags?: string,
  ): Observable<MessageEvent> {
    const parsedTags = tags
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    return this.bus
      .subscribe$({
        projectSlug,
        topicPattern: topic,
        tags: parsedTags,
      })
      .pipe(map((envelope) => ({ data: envelope } as MessageEvent)));
  }
}
