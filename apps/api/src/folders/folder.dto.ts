import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
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
