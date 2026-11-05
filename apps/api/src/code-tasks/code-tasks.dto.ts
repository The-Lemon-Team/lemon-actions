import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterCodeRepoDto {
  @IsString()
  @IsNotEmpty()
  localPath: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  profileId?: string;

  @IsArray()
  @IsOptional()
  defaultTags?: string[];
}

export class PushCodeResultsDto {
  @IsString()
  @IsOptional()
  runner?: string;

  @IsOptional()
  summary?: {
    totalTasks?: number;
    completedTasks?: number;
    failedTasks?: number;
    stubTasks?: number;
    totalTests?: number;
    passedTests?: number;
    failedTests?: number;
  };

  @IsArray()
  results: Array<{
    taskId: string;
    status: 'PASSED' | 'FAILED' | 'STUB' | 'IN_PROGRESS';
    tests?: {
      total: number;
      passed: number;
      failed: number;
      skipped?: number;
    };
    durationMs?: number;
    logs?: Array<{
      test: string;
      error?: string;
      stack?: string;
    }>;
  }>;
}

export interface CodeRepoView {
  id: string;
  name: string;
  localPath: string;
  folderId: string;
  folderPath: string;
  profileId: string | null;
  defaultTags: string[];
  tasksCount: number;
  passedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  isWatching: boolean;
}
