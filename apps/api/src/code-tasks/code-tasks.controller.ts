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
import { PushCodeResultsDto, RegisterCodeRepoDto } from './code-tasks.dto';
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
}
