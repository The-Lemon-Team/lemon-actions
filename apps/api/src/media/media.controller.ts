import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MediaKind,
  MediaVisibility,
  ProcessingStatus,
} from '@lemon/media-hub-neurons';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateMediaClientDto,
  CreateMediaFolderDto,
  MediaLoginDto,
  UpdateMediaAccessDto,
  UpdateMediaMetadataDto,
} from './media.dto';
import { MediaService, UploadedBinaryFile } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('status')
  getStatus() {
    return this.mediaService.getStatus();
  }

  @Post('auth/login')
  login(@Body() dto: MediaLoginDto) {
    return this.mediaService.login(dto.username, dto.password);
  }

  @Post('neurons/ensure')
  ensureNeurons() {
    return this.mediaService.ensureCombinatorNeurons();
  }

  @Get('folders')
  listFolders() {
    return this.mediaService.listFolders();
  }

  @Post('folders')
  createFolder(@Body() dto: CreateMediaFolderDto) {
    return this.mediaService.createFolder(dto);
  }

  @Delete('folders/:id')
  deleteFolder(@Param('id') id: string) {
    return this.mediaService.deleteFolder(id);
  }

  @Get('assets')
  listAssets(
    @Query('kind') kind?: MediaKind,
    @Query('visibility') visibility?: MediaVisibility,
    @Query('processingStatus') processingStatus?: ProcessingStatus,
    @Query('folderId') folderId?: string,
    @Query('folderPath') folderPath?: string,
    @Query('search') search?: string,
    @Query('style') style?: string,
    @Query('tag') tag?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.mediaService.listAssets({
      kind,
      visibility,
      processingStatus,
      folderId,
      folderPath: folderPath === 'all' ? undefined : folderPath,
      search,
      style,
      tag,
      isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('assets/:id')
  getAsset(@Param('id') id: string) {
    return this.mediaService.getAsset(id);
  }

  @Get('assets/:id/lineage')
  getAssetLineage(@Param('id') id: string) {
    return this.mediaService.getAssetLineage(id);
  }

  @Get('assets/:id/file')
  streamDefaultFile(
    @Param('id') id: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    return this.mediaService.streamAssetFile(id, undefined, rangeHeader, res);
  }

  @Get('assets/:id/file/:variant')
  streamVariantFile(
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    return this.mediaService.streamAssetFile(id, variant, rangeHeader, res);
  }

  @Post('assets/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadAsset(
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body() body: Record<string, string | undefined>,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Multipart field "file" is required');
    }

    const tags = body.tags
      ? body.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const allowedClients = body.allowedClients
      ? body.allowedClients
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : undefined;
    const visibility =
      body.visibility === 'PRIVATE' ||
      body.visibility === 'SCOPED' ||
      body.visibility === 'PUBLIC'
        ? body.visibility
        : undefined;

    return this.mediaService.uploadAsset(file, {
      folderPath: body.folderPath || 'covers',
      tags,
      title: body.title,
      description: body.description,
      visibility,
      allowedClients,
      waitForReady: body.waitForReady === 'true',
      dedupKey: body.dedupKey,
    });
  }

  @Patch('assets/:id')
  updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateMediaMetadataDto,
  ) {
    return this.mediaService.updateMetadata(id, dto);
  }

  @Patch('assets/:id/access')
  updateAccess(
    @Param('id') id: string,
    @Body() dto: UpdateMediaAccessDto,
  ) {
    return this.mediaService.updateAccess(id, dto);
  }

  @Patch('assets/:id/favorite')
  toggleFavorite(@Param('id') id: string) {
    return this.mediaService.toggleFavorite(id);
  }

  @Post('assets/:id/reprocess')
  reprocessAsset(@Param('id') id: string) {
    return this.mediaService.reprocessAsset(id);
  }

  @Post('assets/:id/view')
  trackView(
    @Param('id') id: string,
    @Body() body?: { variant?: string },
  ) {
    return this.mediaService.trackView(id, body?.variant);
  }

  @Delete('assets/:id')
  deleteAsset(
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    return this.mediaService.deleteAsset(id, reason);
  }

  @Get('clients')
  listClients() {
    return this.mediaService.listClients();
  }

  @Post('clients')
  createClient(@Body() dto: CreateMediaClientDto) {
    return this.mediaService.createClient(dto);
  }

  @Post('clients/:id/rotate-key')
  rotateClientKey(@Param('id') id: string) {
    return this.mediaService.rotateClientKey(id);
  }

  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.mediaService.events$().pipe(
      map((packet) => ({ data: packet }) as MessageEvent),
    );
  }
}
