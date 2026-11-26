/**
 * Lemon Actions — Lemon-Projectarium Types
 *
 * Core domain contracts for unified project stands, Smart Upsert registration,
 * Port Shield port allocation, dual-level reactive task boards, and history chronicles.
 */

export type ProjectariumAppStatus = 'ONLINE' | 'DEGRADED' | 'CHECKING' | 'EVICTED';
export type ProjectariumEnvironment = 'dev' | 'staging' | 'production';
export type ProjectariumNetworkMode = 'local' | 'lan' | 'tailscale-lan' | 'tailscale-funnel';
export type ProjectariumScope = 'PROJECT' | 'APP';
export type ProjectariumPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProjectariumApp {
  id: string;
  appName: string;
  host?: string;
  port: number;
  instanceId: string;
  leaseToken: string;
  environment: ProjectariumEnvironment;
  networkMode: ProjectariumNetworkMode;
  machineId?: string;
  machineName?: string;
  status: ProjectariumAppStatus;
  healthUrl?: string;
  lastPingAt?: string;
  pingLatencyMs?: number;
  consecutiveFailures: number;
  registeredAt: string;
  metadata?: Record<string, any>;
}

export interface ProjectariumTodoItem {
  id: string;
  title: string;
  completed: boolean;
  scope: ProjectariumScope;
  targetAppName?: string;
  createdAt: string;
  completedAt?: string;
  author: string;
  priority: ProjectariumPriority;
}

export interface ProjectariumNoteItem {
  id: string;
  title?: string;
  content: string;
  author: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectariumEventType =
  | 'PROJECT_CREATED'
  | 'APP_REGISTERED'
  | 'APP_HEARTBEAT'
  | 'APP_DEGRADED'
  | 'APP_EVICTED'
  | 'APP_RELEASED'
  | 'TODO_ADDED'
  | 'TODO_TOGGLED'
  | 'NOTE_ADDED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'MANUAL_NOTE';

export interface ProjectariumEvent {
  id: string;
  type: ProjectariumEventType;
  scope: ProjectariumScope;
  targetAppName?: string;
  description: string;
  timestamp: string;
  author: string;
  metadata?: Record<string, any>;
}

export interface ProjectariumProject {
  id: string;
  name: string;
  slug: string;
  neuronWorkspace: string;
  projectToken: string;
  context: Record<string, any>;
  apps: ProjectariumApp[];
  todos: ProjectariumTodoItem[];
  notes: ProjectariumNoteItem[];
  chronicle: ProjectariumEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectariumRegisterPayload {
  projectSlug?: string;
  projectName?: string;
  projectToken?: string;
  appName?: string;
  host?: string;
  preferredPort?: number;
  environment?: ProjectariumEnvironment;
  networkMode?: ProjectariumNetworkMode;
  machineId?: string;
  machineName?: string;
  healthUrl?: string;
  context?: Record<string, any>;
  initialTodos?: string[];
  author?: string;
}

export interface ProjectariumRegisterResponse {
  success: boolean;
  isNewProject: boolean;
  projectToken: string;
  project: ProjectariumProject;
  allocatedApp: ProjectariumApp;
  message: string;
}

export interface ProjectShieldStats {
  totalProjects: number;
  totalApps: number;
  onlineApps: number;
  degradedApps: number;
  evictedApps: number;
  zeroDeadlockRootCount: number;
  averageLatencyMs: number;
  publicAppsCount?: number;
  localAppsCount?: number;
  activeMachinesCount?: number;
}

export type ProjectariumRunEndReason = 'ACTIVE' | 'RELEASED' | 'TTL_EXPIRED' | 'EVICTED';

export interface ProjectariumMachineSummary {
  machineId: string;
  machineName: string;
  activeLocalCount: number;
  activePublicCount: number;
  lastSeenAt: string;
}

export interface ProjectariumMachineAppBreakdown {
  appName: string;
  standSlug: string;
  standName: string;
  runs: number;
  activeCount: number;
  totalDurationSec: number;
}

export interface ProjectariumMachineStats {
  machineId: string;
  machineName: string;
  activeCount: number;
  totalRuns: number;
  totalDurationSec: number;
  lastActiveAt?: string;
  topApps: ProjectariumMachineAppBreakdown[];
}

export interface ProjectariumAppRunSummary {
  id: string;
  standSlug: string;
  standName: string;
  appName: string;
  host: string;
  port: number;
  environment: ProjectariumEnvironment;
  networkMode: ProjectariumNetworkMode;
  machineId: string;
  machineName: string;
  startedAt: string;
  lastHeartbeatAt: string;
  endedAt?: string;
  durationSec: number;
  endReason: ProjectariumRunEndReason;
}

export interface ProjectariumAnalytics {
  windowDays: number;
  generatedAt: string;
  totalRuns: number;
  activeRuns: number;
  totalDurationSec: number;
  machines: ProjectariumMachineStats[];
  topApps: Array<{
    appName: string;
    standSlug: string;
    standName: string;
    totalRuns: number;
    activeCount: number;
    totalDurationSec: number;
    machines: string[];
  }>;
  recentRuns: ProjectariumAppRunSummary[];
}

export interface ProjectariumPoolItem {
  projectId: string;
  projectSlug: string;
  projectName: string;
  projectToken: string;
  app: ProjectariumApp;
}

export interface ProjectariumHeartbeatResponse {
  status: 'HEARTBEAT_ACK';
  projectSlug: string;
  instanceId: string;
  port: number;
  renewedAt: string;
}

export interface ProjectariumReleaseResponse {
  status: 'RELEASED';
  projectSlug: string;
  instanceId: string;
  port: number;
  releasedAt: string;
}

export type ProjectariumShardTier = 'logical' | 'embedded' | 'dedicated';

export interface ProjectariumShardInfo {
  projectSlug: string;
  projectName: string;
  shardId: string;
  tier: ProjectariumShardTier;
  status: ProjectariumAppStatus;
  instanceId: string;
  appName: string;
  apiBaseUrl: string;
  healthUrl?: string;
  pingLatencyMs?: number;
  lastPingAt?: string;
  capabilities: string[];
  customFlowTypes: string[];
  customReducers: string[];
}

export interface ProjectariumShardResolution {
  projectSlug: string;
  mode: 'dedicated-shard' | 'shared-logical';
  apiBaseUrl: string;
  shard: ProjectariumShardInfo | null;
  resolvedAt: string;
}
