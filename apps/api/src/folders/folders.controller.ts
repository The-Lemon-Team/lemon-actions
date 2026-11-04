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
import { CreateFolderDto, ListFoldersQueryDto, UpdateFolderDto } from './folder.dto';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private readonly service: FoldersService) {}

  @Get()
  findAll(
    @Query() q: ListFoldersQueryDto,
    @Headers('x-profile-id') headerProfileId?: string,
    @Headers('x-app-scope') headerScope?: string,
  ) {
    return this.service.findAll({
      profileId: q.profileId ?? headerProfileId,
      scope: q.scope ?? headerScope,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/subtree')
  subtree(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.subtree(id);
  }

  @Get(':id/context')
  context(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.context(id);
  }

  @Post()
  create(
    @Body() dto: CreateFolderDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.service.create({
      ...dto,
      profileId: dto.profileId ?? headerProfileId ?? null,
    });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFolderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
