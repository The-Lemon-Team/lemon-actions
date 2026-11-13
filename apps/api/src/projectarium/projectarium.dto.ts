import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import {
  ProjectariumEnvironment,
  ProjectariumNetworkMode,
  ProjectariumPriority,
  ProjectariumScope,
} from '@lemon/projectarium';

export class ProjectariumRegisterDto {
  @IsOptional()
  @IsString()
  projectSlug?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  projectToken?: string;

  @IsOptional()
  @IsString()
  appName?: string;

  @IsOptional()
  @IsNumber()
  @Min(80)
  preferredPort?: number;

  @IsOptional()
  @IsIn(['dev', 'staging', 'production'])
  environment?: ProjectariumEnvironment;

  @IsOptional()
  @IsIn(['local', 'tailscale-lan', 'tailscale-funnel'])
  networkMode?: ProjectariumNetworkMode;

  @IsOptional()
  @IsString()
  healthUrl?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsArray()
  initialTodos?: string[];

  @IsOptional()
  @IsString()
  author?: string;
}

export class AddAppToProjectDto {
  @IsString()
  appName!: string;

  @IsOptional()
  @IsNumber()
  @Min(80)
  preferredPort?: number;

  @IsOptional()
  @IsIn(['dev', 'staging', 'production'])
  environment?: ProjectariumEnvironment;

  @IsOptional()
  @IsIn(['local', 'tailscale-lan', 'tailscale-funnel'])
  networkMode?: ProjectariumNetworkMode;

  @IsOptional()
  @IsString()
  healthUrl?: string;

  @IsOptional()
  @IsString()
  author?: string;
}

export class AddProjectTodoDto {
  @IsString()
  title!: string;

  @IsIn(['PROJECT', 'APP'])
  scope!: ProjectariumScope;

  @IsOptional()
  @IsString()
  targetAppName?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: ProjectariumPriority;

  @IsOptional()
  @IsString()
  author?: string;
}

export class AddChronicleEventDto {
  @IsString()
  description!: string;

  @IsIn(['PROJECT', 'APP'])
  scope!: ProjectariumScope;

  @IsOptional()
  @IsString()
  targetAppName?: string;

  @IsOptional()
  @IsString()
  author?: string;
}
