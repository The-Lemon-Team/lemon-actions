import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { AiRequestStatus, AiTaskType } from '@lemon/ai-neurons';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AnalyzeImageDto,
  CreateAiClientDto,
  GenerateImagesDto,
  GenerateNoteDto,
  GenerateTextDto,
  ParseQuickAddDto,
  RemixImageDto,
  SetAiApiKeyDto,
} from './ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('auth/key')
  setApiKey(@Body() dto: SetAiApiKeyDto) {
    return this.aiService.setApiKey(dto.apiKey);
  }

  @Post('neurons/ensure')
  ensureNeurons() {
    return this.aiService.ensureCombinatorNeurons();
  }

  @Get('history')
  getHistory(
    @Query('clientSlug') clientSlug?: string,
    @Query('taskType') taskType?: AiTaskType,
    @Query('status') status?: AiRequestStatus,
    @Query('correlationId') correlationId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiService.getHistory({
      clientSlug,
      taskType,
      status,
      correlationId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('history/stats')
  getHistoryStats() {
    return this.aiService.getHistoryStats();
  }

  @Get('history/:id')
  getHistoryById(@Param('id') id: string) {
    return this.aiService.getHistoryById(id);
  }

  @Post('generate-text')
  generateText(@Body() dto: GenerateTextDto) {
    return this.aiService.generateText(dto);
  }

  @Post('generate-note')
  generateNote(@Body() dto: GenerateNoteDto) {
    return this.aiService.generateNote(dto);
  }

  @Post('parse-quick-add')
  parseQuickAdd(@Body() dto: ParseQuickAddDto) {
    return this.aiService.parseQuickAdd(dto);
  }

  @Post('generate-images')
  generateImages(@Body() dto: GenerateImagesDto) {
    return this.aiService.generateImages(dto);
  }

  @Post('remix-image')
  remixImage(@Body() dto: RemixImageDto) {
    return this.aiService.remixImage(dto);
  }

  @Post('analyze-image')
  analyzeImage(@Body() dto: AnalyzeImageDto) {
    return this.aiService.analyzeImage(dto);
  }

  @Get('clients')
  listClients() {
    return this.aiService.listClients();
  }

  @Post('clients')
  createClient(@Body() dto: CreateAiClientDto) {
    return this.aiService.createClient(dto);
  }

  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.aiService.events$().pipe(
      map((packet) => ({ data: packet }) as MessageEvent),
    );
  }
}
