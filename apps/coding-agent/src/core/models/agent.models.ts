export interface AgentSessionRecord {
  sessionId: string;
  clientId: string;
  clientVersion: string;
  agentRole: string;
  workspaceRoot: string;
  repoName: string;
  environment: string;
  startedAt: string;
  status: 'ACTIVE' | 'IDLE' | 'CLOSED';
  lastHeartbeatAt?: string;
  decisionsCount: number;
  tasksCompletedCount: number;
}

export interface AgentDecisionRecord {
  decisionId: string;
  sessionId: string;
  title: string;
  rationaleMarkdown: string;
  tags: string[];
  repoName: string;
  timestamp: string;
}

export interface DailyDigestTaskItem {
  id: string;
  title: string;
  testsPassed?: number;
  status: string;
}

export interface DailyDigestSnapshot {
  date: string;
  digestId: string;
  generatedAt: string;
  commitHash?: string;
  commitMessage?: string;
  repoPath: string;
  tasksCompleted: DailyDigestTaskItem[];
  decisions: Array<{
    title: string;
    summary: string;
  }>;
  metrics: {
    totalSessions: number;
    tasksPassedCount: number;
    testsPassedCount: number;
  };
  markdownSummary: string;
}

export interface OptimizationMetrics {
  totalImpulsesReceived: number;
  totalImpulsesEmitted: number;
  totalImpulsesSuppressed: number;
  overallReductionRate: number;
  activeRegisteredStreams: number;
  ephemeralPulsesRatio: number;
  lastOptimizedAt: string;
}

export interface StreamPulseItem {
  id: string;
  type: string;
  flowName: string;
  timestamp: string;
  payload: any;
  coalescedCount?: number;
}
