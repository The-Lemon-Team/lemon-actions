import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PublishBusEventDto {
  @IsOptional() @IsString()
  topic?: string;

  @IsOptional() @IsString()
  projectSlug?: string;

  @IsOptional() @IsString()
  domain?: string;

  @IsOptional() @IsString()
  event?: string;

  @IsOptional() @IsString()
  sourceApp?: string;

  @IsOptional() @IsString()
  correlationId?: string;

  @IsOptional() @IsString()
  dedupKey?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsObject() @IsNotEmpty()
  payload: Record<string, unknown>;
}

export class ReplayBusQueryDto {
  @IsOptional() @IsString()
  projectSlug?: string;

  @IsOptional() @IsString()
  topic?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sinceSeq?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
