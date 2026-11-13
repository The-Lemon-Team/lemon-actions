import { Observable } from 'rxjs';

/**
 * Lemon Actions — Reactive Worker Cards & TCA (Trigger-Condition-Action) Type System
 *
 * Frontend Models & View Configurations for Google Keep-style Worker Cards
 */

export type LemonCardColor =
  | 'default'
  | 'lemon'
  | 'amber'
  | 'sage'
  | 'lavender'
  | 'sky'
  | 'rose'
  | 'slate';

export type WorkerStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'RUNNING'
  | 'PAUSED'
  | 'FAILED'
  | 'CIRCUIT_OPEN';

/* -------------------------------------------------------------------------- */
/* 1. КОГДА (Trigger / Event Source)                                          */
/* -------------------------------------------------------------------------- */

export interface TimerTrigger {
  kind: 'TIMER';
  cron?: string;
  intervalMs?: number;
  exactTiming?: boolean;
  label?: string;
}

export interface WatcherTrigger {
  kind: 'WATCHER';
  targetNeuronId: string;
  targetNeuronPath?: string;
  events: Array<
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'FILE_CHANGED'
    | 'STATUS_CHANGED'
  >;
  globPattern?: string;
  debounceMs?: number;
}

export interface ImpulseTrigger {
  kind: 'IMPULSE';
  streamId?: string;
  impulseType: string;
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
  lockKey: string;
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
  sourceNeuronId: string;
  lookbackWindowMs?: number;
  format: 'markdown' | 'json' | 'bullet_points' | 'executive_summary';
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
  trigger: ActionTrigger;
  condition?: ActionCondition;
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
/* 6. Lemon Worker Card Entity                                                */
/* -------------------------------------------------------------------------- */

export interface LemonWorkerCard {
  id: string;
  name: string;
  description?: string;
  neuronId: string;
  neuronPath: string;
  color: LemonCardColor;
  isPinned: boolean;
  order: number;
  tags: string[];
  status: WorkerStatus;
  rule: WorkerRule;
  telemetry: WorkerTelemetry;
  lastExecution?: ExecutionRecord;
  createdAt: string;
  updatedAt: string;
}

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

/* -------------------------------------------------------------------------- */
/* 7. UI-Specific Color Themes & View State                                   */
/* -------------------------------------------------------------------------- */

export interface LemonColorPalette {
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  glowClass: string;
  accentHex: string;
}

export const LEMON_CARD_PALETTES: Record<LemonCardColor, LemonColorPalette> = {
  default: {
    bgClass: 'bg-[#ffffff] dark:bg-[#1f201e]',
    borderClass: 'border-[#eae8e4] dark:border-[#383734]',
    badgeClass: 'bg-[#efeeea] text-[#4d4633] dark:bg-[#2d2e2b] dark:text-[#d0c6ac]',
    glowClass: 'shadow-sm hover:shadow-md',
    accentHex: '#7e7761',
  },
  lemon: {
    bgClass: 'bg-[#fffde7] dark:bg-[#2e2a14]',
    borderClass: 'border-[#f7d02c]/50 dark:border-[#e9c31c]/40',
    badgeClass: 'bg-[#ffe176] text-[#6c5900] dark:bg-[#554500] dark:text-[#ffe176]',
    glowClass: 'shadow-[0_0_15px_rgba(247,208,44,0.18)] hover:shadow-[0_0_20px_rgba(247,208,44,0.3)]',
    accentHex: '#f7d02c',
  },
  amber: {
    bgClass: 'bg-[#fff8e1] dark:bg-[#2d2410]',
    borderClass: 'border-[#ffb74d]/40 dark:border-[#ffb74d]/30',
    badgeClass: 'bg-[#ffe082] text-[#8d6e63] dark:bg-[#5d4037] dark:text-[#ffecb3]',
    glowClass: 'shadow-[0_0_15px_rgba(255,183,77,0.18)]',
    accentHex: '#ffa726',
  },
  sage: {
    bgClass: 'bg-[#f1f8e9] dark:bg-[#1c2718]',
    borderClass: 'border-[#a5d6a7]/40 dark:border-[#81c784]/30',
    badgeClass: 'bg-[#c8e6c9] text-[#2e7d32] dark:bg-[#1b5e20] dark:text-[#c8e6c9]',
    glowClass: 'shadow-[0_0_15px_rgba(165,214,167,0.2)]',
    accentHex: '#66bb6a',
  },
  lavender: {
    bgClass: 'bg-[#f3e5f5] dark:bg-[#251929]',
    borderClass: 'border-[#ce93d8]/40 dark:border-[#ba68c8]/30',
    badgeClass: 'bg-[#e1bee7] text-[#6a1b9a] dark:bg-[#4a148c] dark:text-[#e1bee7]',
    glowClass: 'shadow-[0_0_15px_rgba(206,147,216,0.2)]',
    accentHex: '#ab47bc',
  },
  sky: {
    bgClass: 'bg-[#e1f5fe] dark:bg-[#13232c]',
    borderClass: 'border-[#81d4fa]/40 dark:border-[#4fc3f7]/30',
    badgeClass: 'bg-[#b3e5fc] text-[#0277bd] dark:bg-[#01579b] dark:text-[#b3e5fc]',
    glowClass: 'shadow-[0_0_15px_rgba(129,212,250,0.2)]',
    accentHex: '#29b6f6',
  },
  rose: {
    bgClass: 'bg-[#ffebee] dark:bg-[#2c1518]',
    borderClass: 'border-[#ef9a9a]/40 dark:border-[#e57373]/30',
    badgeClass: 'bg-[#ffcdd2] text-[#c62828] dark:bg-[#b71c1c] dark:text-[#ffcdd2]',
    glowClass: 'shadow-[0_0_15px_rgba(239,154,154,0.2)]',
    accentHex: '#ef5350',
  },
  slate: {
    bgClass: 'bg-[#eceff1] dark:bg-[#1c2125]',
    borderClass: 'border-[#b0bec5]/40 dark:border-[#78909c]/30',
    badgeClass: 'bg-[#cfd8dc] text-[#37474f] dark:bg-[#263238] dark:text-[#cfd8dc]',
    glowClass: 'shadow-[0_0_15px_rgba(176,190,197,0.2)]',
    accentHex: '#78909c',
  },
};

export interface WorkerCardViewState {
  card: LemonWorkerCard;
  status$: Observable<WorkerStatus>;
  isExecuting$: Observable<boolean>;
  pulseEffect$: Observable<boolean>;
  humanReadable: {
    when: string;
    if?: string;
    then: string;
  };
}
