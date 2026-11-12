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

export interface FlowView {
  id: string;
  name: string;
  description?: string;
  type: FlowType;
  status: FlowStatus;
  isExclusive: boolean;
  folderId: string | null;
  profileId: string | null;
  tags: { id: string; name: string; colorHex?: string }[];
  config?: any;
  orchestratorRules?: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  profileId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type FlowImpulseType =
  | 'MUTEX_STATUS'
  | 'CONTEXT_UPDATED'
  | 'TIMER_TICK'
  | 'CIRCUIT_BREAKER_STATE'
  | 'BATCH_FLUSH'
  | 'PROJECTION_UPDATED'
  | 'FLOW_TRIGGER'
  | 'CHRONICLE_EVENT';

export interface FlowImpulsePacket {
  id: string;
  type: FlowImpulseType;
  folderId: string | null;
  flowId: string;
  flowName: string;
  flowType: FlowType;
  timestamp: string;
  payload: Record<string, any>;
  activeSessionIds?: string[];
}

export interface BatchFlushPacket<T = any> {
  batchId: string;
  folderId: string;
  flowId: string;
  flushReason: 'SIZE_THRESHOLD' | 'MAX_WAIT_TIMEOUT' | 'IDLE_TIMEOUT' | 'MANUAL_TRIGGER';
  itemsCount: number;
  items: Array<{
    id: string;
    enqueuedAt: string;
    payload: T;
  }>;
}

export interface NeuronGateView {
  id: string;
  type: string;
  status: string;
  isExclusive: boolean;
  config: any;
  canActivate: boolean;
  gateBlockReasons: string[];
}

export interface NeuronContextView {
  neuron: FolderDto;
  permissions: {
    isExclusiveLocked: boolean;
    activeFlows: string[];
    gates: Record<string, NeuronGateView>;
  };
  activeSessions: Array<{ id: string; flowId: string }>;
  recentEvents: Array<{
    id: string;
    flowId: string;
    eventType: string;
    payload: any;
    createdAt: string;
  }>;
}

export interface NeuronMetricsView {
  folderId: string;
  folderName: string;
  folderPath: string;
  telemetry: {
    totalPulses: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    lastPulseAt: string | null;
  };
  activeState: {
    isExclusiveLocked: boolean;
    activeSessionsCount: number;
    activeFlows: string[];
    flowsByType: Record<string, number>;
  };
  recentErrors: Array<{
    id: string;
    flowId: string;
    eventType: string;
    timestamp: string;
    message: string;
  }>;
}

export interface CompositeNeuronDefinition {
  name: string;
  path: string;
  profileId?: string | null;
  parentId?: string | null;
  flows: {
    context?: { name?: string; config?: Record<string, any> };
    mutex?: {
      name?: string;
      isExclusive?: boolean;
      leaseTimeoutSeconds?: number;
      onConflict?: 'reject' | 'pause' | 'queue';
      gate?: any;
    };
    timer?: { name?: string; intervalSeconds?: number };
    circuitBreaker?: {
      name?: string;
      failureThreshold?: number;
      cooldownSeconds?: number;
      successThreshold?: number;
    };
    batch?: {
      name?: string;
      maxBatchSize?: number;
      maxWaitSeconds?: number;
      idleTimeoutSeconds?: number;
      deduplicationKey?: string;
    };
    observer?: { name?: string };
    fsm?: { name?: string; config?: Record<string, any> };
    projection?: { name?: string; config?: Record<string, any> };
  };
}

export interface CompositeNeuronInstance {
  neuron: FolderDto;
  flows: {
    context?: FlowView;
    mutex?: FlowView;
    timer?: FlowView;
    circuitBreaker?: FlowView;
    batch?: FlowView;
    observer?: FlowView;
    fsm?: FlowView;
    projection?: FlowView;
  };
}
