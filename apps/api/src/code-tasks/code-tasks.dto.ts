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

export class StartAgentSessionDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsOptional()
  clientVersion?: string;

  @IsString()
  @IsOptional()
  agentRole?: string;

  @IsString()
  @IsOptional()
  workspaceRoot?: string;

  @IsString()
  @IsOptional()
  repoName?: string;

  @IsString()
  @IsOptional()
  environment?: string;
}

export class AgentHeartbeatDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class RecordAgentDecisionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  rationaleMarkdown: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  repoName?: string;

  @IsString()
  @IsOptional()
  flowId?: string;
}

export class CommitDailyDigestDto {
  @IsString()
  @IsOptional()
  repoPath?: string;

  @IsString()
  @IsOptional()
  commitMessage?: string;

  @IsString()
  @IsOptional()
  date?: string;
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
