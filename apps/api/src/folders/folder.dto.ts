import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsUUID()
  profileId?: string | null;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  /** Provide to move the folder (null = move to root). Omit to keep the parent. */
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class ListFoldersQueryDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;

  /** ltree scope prefix, e.g. 'home' or 'home.supplies' */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/i, {
    message: 'scope must be a valid ltree path (e.g. "home" or "home.supplies")',
  })
  scope?: string;
}
