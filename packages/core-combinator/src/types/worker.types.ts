/**
 * Lemon Actions — Reactive Worker Cards & TCA (Trigger-Condition-Action) Type System
 *
 * Core domain contracts for Google Keep-style Worker Cards, orchestrating
 * Neurons (folders/contexts) and reactive Streams (impulses/events).
 */

export type LemonCardColor =
  | 'default'   // Clean surface container
  | 'lemon'     // Signature vibrant primary yellow (#f7d02c / #ffe176)
  | 'amber'     // Warm honey / orange
  | 'sage'      // Muted calm green
  | 'lavender'  // Soft purple / indigo
  | 'sky'       // Crisp light blue
  | 'rose'      // Coral / pink
  | 'slate';    // Technical dark graphite / neutral

export type WorkerStatus =
  | 'IDLE'          // Standby, waiting for trigger event
  | 'LISTENING'     // Active watcher or stream subscription running
  | 'RUNNING'       // Currently executing action payload
  | 'PAUSED'        // Explicitly paused by user
  | 'FAILED'        // Last execution failed
  | 'CIRCUIT_OPEN'; // Circuit-breaker tripped due to repeated failures

/* -------------------------------------------------------------------------- */
/* 1. КОГДА (Trigger / Event Source)                                          */
/* -------------------------------------------------------------------------- */

export interface TimerTrigger {
  kind: 'TIMER';
  /** Standard cron expression, e.g. "0 * * * *" or "*\/15 * * * *" */
  cron?: string;
  /** Simple interval in milliseconds, e.g. 60000 for 1 minute */
  intervalMs?: number;
  /** Whether the schedule should trigger without jitter */
  exactTiming?: boolean;
  /** Human-readable schedule label, e.g. "Каждые 15 минут" */
  label?: string;
}

export interface WatcherTrigger {
  kind: 'WATCHER';
  /** ID of the Neuron (folder) being observed */
  targetNeuronId: string;
  /** ltree path of the observed folder, e.g. "workspace.core.reports" */
  targetNeuronPath?: string;
  /** Observable impulse/event types */
  events: Array<
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'FILE_CHANGED'
    | 'STATUS_CHANGED'
  >;
  /** Optional file glob pattern if observing filesystem, e.g. "*.md" or "data/**.json" */
  globPattern?: string;
  /** Debounce / coalesce window in ms to suppress flurry of changes */
  debounceMs?: number;
}

export interface ImpulseTrigger {
  kind: 'IMPULSE';
  /** Specific stream ID from Core Combinator */
  streamId?: string;
  /** Type of impulse, e.g. "FLOW_TRIGGER", "CHRONICLE_EVENT", "TASK_STATUS_CHANGED" */
  impulseType: string;
  /** Optional origin neuron filter */
  sourceNeuronId?: string;
}

export interface ManualTrigger {
  kind: 'MANUAL';
  buttonLabel?: string;
  requireConfirmation?: boolean;
}

export interface WebhookTrigger {
  kind: 'WEBHOOK';
  endpointSlug: string;
  secretToken?: string;
}

export type ActionTrigger =
  | TimerTrigger
  | WatcherTrigger
  | ImpulseTrigger
  | ManualTrigger
  | WebhookTrigger;

/* -------------------------------------------------------------------------- */
/* 2. ЕСЛИ (Condition / Guard / Filter)                                       */
/* -------------------------------------------------------------------------- */

export interface MutexCondition {
  kind: 'MUTEX';
  /** Resource key to lock against concurrent runs */
  lockKey: string;
  /** Behavior when lock is occupied: skip run, wait for release, or queue */
  onConflict: 'skip' | 'wait' | 'queue';
  timeoutMs?: number;
}

export interface FsmCondition {
  kind: 'FSM';
  flowId?: string;
  requiredState: string;
}

export interface PayloadFilterCondition {
  kind: 'PAYLOAD_FILTER';
  jsonPath: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'greater_than'
    | 'less_than'
    | 'regex'
    | 'exists';
  value?: unknown;
}

export interface CooldownCondition {
  kind: 'COOLDOWN';
  cooldownMs: number;
  maxRunsPerHour?: number;
}

export interface CircuitBreakerCondition {
  kind: 'CIRCUIT_BREAKER';
  maxConsecutiveFailures: number;
  resetTimeoutMs: number;
}

export interface CompositeCondition {
  kind: 'COMPOSITE';
  operator: 'AND' | 'OR';
  conditions: ActionCondition[];
}

export type ActionCondition =
  | MutexCondition
  | FsmCondition
  | PayloadFilterCondition
  | CooldownCondition
  | CircuitBreakerCondition
  | CompositeCondition;

/* -------------------------------------------------------------------------- */
/* 3. ЧТО (Action / Executable Effect)                                        */
/* -------------------------------------------------------------------------- */

export interface ScriptAction {
  kind: 'SCRIPT';
  runtime: 'node' | 'shell' | 'python' | 'agent';
  /** Script content inline or path relative to the Neuron folder */
  codeOrPath: string;
  arguments?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface HttpRequestAction {
  kind: 'HTTP_REQUEST';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retryCount?: number;
}

export interface DigestAction {
  kind: 'DIGEST';
  /** Neuron folder from which notes/impulses are gathered */
  sourceNeuronId: string;
  /** Timespan in ms to aggregate, e.g. 86400000 for 24 hours */
  lookbackWindowMs?: number;
  format: 'markdown' | 'json' | 'bullet_points' | 'executive_summary';
  /** Optional target Neuron folder to save generated digest note into */
  destinationNeuronId?: string;
  promptTemplate?: string;
}

export interface WatcherControlAction {
  kind: 'WATCHER_CONTROL';
  command: 'start' | 'stop' | 'restart';
  targetNeuronId: string;
  watcherName: string;
  config?: Record<string, unknown>;
}

export interface EmitImpulseAction {
  kind: 'EMIT_IMPULSE';
  targetStreamId: string;
  impulseType: string;
  payload: Record<string, unknown>;
}

export interface SequenceAction {
  kind: 'SEQUENCE';
  actions: ActionEffect[];
  stopOnError?: boolean;
}

export type ActionEffect =
  | ScriptAction
  | HttpRequestAction
  | DigestAction
  | WatcherControlAction
  | EmitImpulseAction
  | SequenceAction;

/* -------------------------------------------------------------------------- */
/* 4. Rule Definition (TCA Pipeline)                                          */
/* -------------------------------------------------------------------------- */

export interface WorkerRule {
  /** "КОГДА": Event trigger initiating evaluation */
  trigger: ActionTrigger;
  /** "ЕСЛИ": Optional guard checking whether execution is allowed */
  condition?: ActionCondition;
  /** "ЧТО": Executable payload effect */
  action: ActionEffect;
}

/* -------------------------------------------------------------------------- */
/* 5. Execution History & Telemetry                                           */
/* -------------------------------------------------------------------------- */

export interface ExecutionRecord {
  id: string;
  workerId: string;
  triggerEvent: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  skipReason?: string;
  outputSummary?: string;
  error?: string;
}

export interface WorkerTelemetry {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  averageDurationMs?: number;
}

/* -------------------------------------------------------------------------- */
/* 6. Lemon Worker Card (Keep-Style Entity)                                   */
/* -------------------------------------------------------------------------- */

export interface LemonWorkerCard {
  id: string;
  name: string;
  description?: string;
  /** Neuron (Folder) this worker oversees or belongs to */
  neuronId: string;
  neuronPath: string;
  /** Google Keep visual properties */
  color: LemonCardColor;
  isPinned: boolean;
  order: number;
  tags: string[];
  /** Lifecycle and Reactive State */
  status: WorkerStatus;
  rule: WorkerRule;
  telemetry: WorkerTelemetry;
  lastExecution?: ExecutionRecord;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter options for querying worker cards across neurons and streams
 */
export interface WorkerCardQuery {
  neuronId?: string;
  neuronPathPrefix?: string;
  status?: WorkerStatus;
  triggerKind?: ActionTrigger['kind'];
  actionKind?: ActionEffect['kind'];
  color?: LemonCardColor;
  isPinned?: boolean;
  tag?: string;
  search?: string;
}
