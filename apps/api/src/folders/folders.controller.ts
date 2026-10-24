import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { CreateFolderDto, UpdateFolderDto } from './folder.dto';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private readonly service: FoldersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/subtree')
  subtree(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.subtree(id);
  }

  @Post()
  create(@Body() dto: CreateFolderDto) {
    return this.service.create(dto);
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
