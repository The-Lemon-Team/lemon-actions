import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateSeasonStreamDto {
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsIn(['public', 'private'])
  @IsOptional()
  privacy?: 'public' | 'private';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  feedIds?: string[];
}

export class CreateSeasonFeedDto {
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsIn(['public', 'private'])
  @IsOptional()
  privacy?: 'public' | 'private';

  @IsString()
  @IsOptional()
  streamSlug?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hashtags?: string[];
}

export class NoteTodoItemDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  title: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  @IsOptional()
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsIn(['PROJECT', 'APP'])
  @IsOptional()
  scope?: 'PROJECT' | 'APP';

  @IsString()
  @IsOptional()
  targetAppName?: string;

  @IsString()
  @IsOptional()
  author?: string;
}

export class NoteMediaAttachmentDto {
  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsBoolean()
  @IsOptional()
  isMain?: boolean;

  @IsString()
  @IsOptional()
  mediaAssetId?: string;
}

export class IngestSeasonNoteDto {
  @IsString()
  @IsOptional()
  externalId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsIn(['SINGLE', 'PERIOD', 'EVENT', 'FILM_RELEASE', 'MENTION', 'DONE'])
  @IsOptional()
  type?: 'SINGLE' | 'PERIOD' | 'EVENT' | 'FILM_RELEASE' | 'MENTION' | 'DONE';

  @IsIn(['public', 'private'])
  @IsOptional()
  privacy?: 'public' | 'private';

  @IsString()
  @IsOptional()
  streamSlug?: string;

  @IsString()
  @IsOptional()
  feedSlug?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteTodoItemDto)
  @IsOptional()
  todoList?: NoteTodoItemDto[];

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  imageCaption?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteMediaAttachmentDto)
  @IsOptional()
  images?: NoteMediaAttachmentDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaAssetIds?: string[];
}

export class ProxyNoteTodosDto {
  @IsIn(['add', 'toggle', 'remove', 'replace'])
  action: 'add' | 'toggle' | 'remove' | 'replace';

  @IsString()
  @IsOptional()
  todoId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  @IsOptional()
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsIn(['PROJECT', 'APP'])
  @IsOptional()
  scope?: 'PROJECT' | 'APP';

  @IsString()
  @IsOptional()
  targetAppName?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteTodoItemDto)
  @IsOptional()
  todoList?: NoteTodoItemDto[];
}
