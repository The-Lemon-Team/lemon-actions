import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9_-]+$/i, {
    message: 'handle must contain only letters, digits, underscores, or hyphens',
  })
  handle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  avatarIcon?: string;
}

export interface ProfileView {
  id: string;
  handle: string;
  displayName: string;
  avatarIcon?: string;
  createdAt: Date;
}
