import { FlowStatus, FlowType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';

const stripHash = (v: unknown) =>
  Array.isArray(v) ? v.map((t) => (typeof t === 'string' ? t.replace(/^#/, '').trim() : t)) : v;

export class CreateFlowDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsEnum(FlowType)
  type: FlowType;

  @IsOptional() @IsBoolean()
  isExclusive?: boolean;

  @IsOptional() @IsUUID()
  folderId?: string | null;

  /** Tag names (leading '#' is stripped); created if missing. */
  @IsOptional() @IsArray() @IsString({ each: true }) @Transform(({ value }) => stripHash(value))
  tags?: string[];

  @IsOptional()
  config?: unknown;

  @IsOptional()
  orchestratorRules?: unknown;
}

export class UpdateFlowDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(FlowType)
  type?: FlowType;

  @IsOptional() @IsBoolean()
  isExclusive?: boolean;

  @IsOptional() @IsUUID()
  folderId?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true }) @Transform(({ value }) => stripHash(value))
  tags?: string[];

  @IsOptional()
  config?: unknown;

  @IsOptional()
  orchestratorRules?: unknown;
}

export class UpdateFlowStatusDto {
  @IsEnum(FlowStatus)
  status: FlowStatus;
}

export class ListFlowsQueryDto {
  @IsOptional() @IsUUID()
  folderId?: string;

  @IsOptional() @IsString() @Transform(({ value }) => (typeof value === 'string' ? value.replace(/^#/, '') : value))
  tag?: string;

  @IsOptional() @IsEnum(FlowType)
  type?: FlowType;

  @IsOptional() @IsEnum(FlowStatus)
  status?: FlowStatus;

  @IsOptional() @IsString()
  q?: string;
}
