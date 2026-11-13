import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  AgentHeartbeatDto,
  CommitDailyDigestDto,
  PushCodeResultsDto,
  RecordAgentDecisionDto,
  RegisterCodeRepoDto,
  StartAgentSessionDto,
} from './code-tasks.dto';
import { CodeTasksService } from './code-tasks.service';

@Controller('code-tasks')
export class CodeTasksController {
  constructor(private readonly service: CodeTasksService) {}

  @Get('repos')
  listRepos(
    @Query('profileId') queryProfileId?: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.service.listRepos(queryProfileId ?? headerProfileId);
  }

  @Post('repos')
  registerRepo(
    @Body() dto: RegisterCodeRepoDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.service.registerRepo({
      ...dto,
      profileId: dto.profileId ?? headerProfileId,
    });
  }

  @Delete('repos/:id')
  @HttpCode(204)
  unregisterRepo(@Param('id') id: string) {
    return this.service.unregisterRepo(id);
  }

  @Post('repos/:id/sync')
  syncRepo(@Param('id') id: string) {
    return this.service.syncRepo(id);
  }

  @Post('repos/:id/results')
  pushResults(@Param('id') id: string, @Body() dto: PushCodeResultsDto) {
    return this.service.pushResults(id, dto);
  }

  // --- ANTIGRAVITY AGENT & SESSIONS ENDPOINTS ---

  @Post('agent/session/start')
  startAgentSession(@Body() dto: StartAgentSessionDto) {
    return this.service.startAgentSession(dto);
  }

  @Post('agent/session/heartbeat')
  sendAgentHeartbeat(@Body() dto: AgentHeartbeatDto) {
    return this.service.sendAgentHeartbeat(dto);
  }

  @Post('agent/decision')
  recordAgentDecision(@Body() dto: RecordAgentDecisionDto) {
    return this.service.recordAgentDecision(dto);
  }

  @Post('agent/digest/eod-commit')
  commitDailyDigest(@Body() dto: CommitDailyDigestDto) {
    return this.service.commitDailyDigest(dto);
  }

  @Get('agent/digest/today')
  getTodayDigest(@Query('date') date?: string) {
    return this.service.getTodayDigest(date);
  }

  @Get('agent/history')
  getAgentHistory(@Query('repoName') repoName?: string) {
    return this.service.getAgentHistory(repoName);
  }

  @Post('agent/migration/run')
  runMigration() {
    return this.service.runMigration();
  }
}
