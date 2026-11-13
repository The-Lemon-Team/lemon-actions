import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AppEnvironment, AppNetworkMode } from '@lemon/app-registrar';

export class RegisterAppDto {
  @IsString()
  appName: string;

  @IsOptional()
  @IsNumber()
  @Min(1024)
  desiredPort?: number;

  @IsOptional()
  @IsIn(['dev', 'staging', 'production'])
  environment?: AppEnvironment;

  @IsOptional()
  @IsIn(['local', 'tailscale-lan', 'tailscale-funnel'])
  networkMode?: AppNetworkMode;

  @IsOptional()
  @IsString()
  group?: 'Core Infrastructure' | 'Agent Dynamic Apps' | 'External APIs';

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  projectName?: string;
}

export class HeartbeatDto {
  @IsString()
  instanceId: string;

  @IsString()
  leaseToken: string;
}

export class ReleaseAppDto {
  @IsString()
  instanceId: string;

  @IsString()
  leaseToken: string;
}
