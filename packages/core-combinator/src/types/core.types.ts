import { Observable } from 'rxjs';

export type FlowType =
  | 'CONTEXT'
  | 'MUTEX'
  | 'OBSERVER'
  | 'FSM'
  | 'TIMER'
  | 'CIRCUIT_BREAKER'
  | 'BATCH'
  | 'PROJECTION';

export type FlowStatus = 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'PROCESSING';

export type FlowImpulseType =
  | 'MUTEX_STATUS'
  | 'CONTEXT_UPDATED'
  | 'TIMER_TICK'
  | 'CIRCUIT_BREAKER_STATE'
  | 'BATCH_FLUSH'
  | 'PROJECTION_UPDATED'
  | 'FLOW_TRIGGER'
  | 'CHRONICLE_EVENT'
  | 'AGENT_SESSION_INIT'
  | 'AGENT_HEARTBEAT'
  | 'AGENT_DECISION'
  | 'DAILY_DIGEST_COMMITTED'
  | 'TASK_STATUS_CHANGED';

export type StreamPersistenceTier = 'EPHEMERAL' | 'DURABLE' | 'SAMPLED';

export interface FlowImpulsePacket<T = Record<string, any>> {
  id: string;
  type: FlowImpulseType;
  folderId: string | null;
  flowId: string;
  flowName: string;
  flowType: FlowType;
  timestamp: string;
  payload: T;
  activeSessionIds?: string[];
  persistence?: StreamPersistenceTier;
  metadata?: {
    coalescedCount?: number;
    latencyMs?: number;
    source?: string;
  };
}

export interface StreamFilter {
  folderId?: string;
  flowId?: string;
  flowType?: FlowType;
  impulseType?: FlowImpulseType;
  persistenceTier?: StreamPersistenceTier;
}

export interface StreamLoadStats {
  streamId: string;
  streamName: string;
  totalReceived: number;
  totalEmitted: number;
  totalSuppressed: number;
  reductionPercentage: number;
  lastImpulseAt: string | null;
  activeSubscribers: number;
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

export interface CoalesceRule {
  /** Maximum window in milliseconds to buffer and coalesce rapid impulses */
  windowMs: number;
  /** Custom merge function for payload when multiple impulses arrive */
  mergePayload?: (prevPayload: any, nextPayload: any, count: number) => any;
  /** Whether this impulse type is ephemeral (not written to persistent storage) */
  ephemeral?: boolean;
}

export interface StreamDescriptor {
  id: string;
  name: string;
  flowType: FlowType;
  folderId?: string | null;
  persistenceTier: StreamPersistenceTier;
  tags?: string[];
  coalesceWindowMs?: number;
}

export interface ClientLaunchPayload {
  clientId: string;
  clientVersion: string;
  agentRole: string;
  workspaceRoot: string;
  environment: string;
  launchedAt: string;
  tags?: string[];
}

export interface AgentSessionRecord {
  sessionId: string;
  clientId: string;
  flowId: string;
  startedAt: string;
  endedAt?: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  agentRole: string;
  repoPath: string;
  tasksCompletedCount: number;
  decisionsCount: number;
}

export interface AgentDecisionRecord {
  decisionId: string;
  sessionId: string;
  title: string;
  rationaleMarkdown: string;
  tags: string[];
  repoName: string;
  timestamp: string;
  flowId?: string;
}

export interface DailyDigestSnapshot {
  date: string;
  digestId: string;
  generatedAt: string;
  commitHash?: string;
  commitMessage?: string;
  repoPath: string;
  tasksCompleted: Array<{
    id: string;
    title: string;
    testsPassed?: number;
    status: string;
  }>;
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
