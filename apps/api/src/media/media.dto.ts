import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MediaLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateMediaFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsIn(['PRIVATE', 'SCOPED', 'PUBLIC'])
  @IsOptional()
  defaultVisibility?: 'PRIVATE' | 'SCOPED' | 'PUBLIC';
}

export class UpdateMediaMetadataDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  folderPath?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class MediaClientGrantDto {
  @IsString()
  @IsNotEmpty()
  clientSlug: string;

  @IsIn(['READ', 'WRITE'])
  @IsOptional()
  permission?: 'READ' | 'WRITE';

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateMediaAccessDto {
  @IsIn(['PRIVATE', 'SCOPED', 'PUBLIC'])
  visibility: 'PRIVATE' | 'SCOPED' | 'PUBLIC';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaClientGrantDto)
  @IsOptional()
  clients?: MediaClientGrantDto[];
}

export class CreateMediaClientDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];
}
