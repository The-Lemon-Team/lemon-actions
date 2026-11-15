import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateSeasonFeedDto,
  CreateSeasonStreamDto,
  IngestSeasonNoteDto,
  ProxyNoteTodosDto,
} from './seasons.dto';
import { SeasonsService } from './seasons.service';

@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('status')
  getStatus() {
    return this.seasonsService.getStatus();
  }

  @Get('topology')
  getTopology(
    @Query('streamSlug') streamSlug?: string,
    @Query('privacy') privacy?: 'public' | 'private' | 'all',
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? Number(days) : undefined;
    return this.seasonsService.getTopology({
      streamSlug,
      privacy: privacy || 'all',
      days: Number.isFinite(parsedDays) ? parsedDays : undefined,
    });
  }

  @Post('streams')
  ensureStream(@Body() dto: CreateSeasonStreamDto) {
    return this.seasonsService.ensureStream(dto);
  }

  @Post('feeds')
  ensureFeed(@Body() dto: CreateSeasonFeedDto) {
    return this.seasonsService.ensureFeedAndAttach(dto);
  }

  @Get('feeds/:slug/notes')
  getFeedNotes(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.seasonsService.getFeedNotes(slug, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      search,
      type,
    });
  }

  @Get('streams/:slug/notes')
  getStreamNotes(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.seasonsService.getStreamNotes(slug, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      search,
      type,
    });
  }

  @Get('notes/:id')
  getNote(@Param('id') id: string) {
    return this.seasonsService.getNote(id);
  }

  @Post('notes/ingest')
  ingestNote(@Body() dto: IngestSeasonNoteDto) {
    return this.seasonsService.ingestNote(dto);
  }

  @Patch('notes/:id/todos')
  proxyNoteTodos(@Param('id') id: string, @Body() dto: ProxyNoteTodosDto) {
    return this.seasonsService.proxyNoteTodos(id, dto);
  }

  @Post('projectarium/ensure-namespace')
  ensureProjectariumNamespace() {
    return this.seasonsService.ensureProjectariumNamespace();
  }

  @Post('projectarium/:slug/sync')
  syncProjectariumStand(@Param('slug') slug: string) {
    return this.seasonsService.syncProjectariumStand(slug);
  }

  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.seasonsService.events$().pipe(
      map((packet) => ({ data: packet }) as MessageEvent),
    );
  }
}
