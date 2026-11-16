import { AppEnvironment, AppNetworkMode } from './health-checker.models';
import { LemonCardColor } from './worker.models';
import { ProjectSessionLogEntry } from './chronicle-card.models';
import { ReactiveTodoItem } from './todo-card.models';

export type StandAppStatus = 'HEALTHY' | 'DEGRADED' | 'CHECKING' | 'EVICTED' | 'OFFLINE';

export interface StandAppItem {
  id: string;
  appName: string;
  role: string;
  host?: string;
  port: number;
  url: string;
  instanceId: string;
  leaseToken: string;
  environment: AppEnvironment;
  networkMode: AppNetworkMode;
  machineId?: string;
  machineName?: string;
  status: StandAppStatus;
  lastLatencyMs: number;
  lastCheckedAt: string;
  consecutiveFailures: number;
  icon: string;
}

export type AppRunEndReason = 'ACTIVE' | 'RELEASED' | 'TTL_EXPIRED' | 'EVICTED';

export interface MachineSummary {
  machineId: string;
  machineName: string;
  activeLocalCount: number;
  activePublicCount: number;
  lastSeenAt: string;
}

export interface MachineAppBreakdown {
  appName: string;
  standSlug: string;
  standName: string;
  runs: number;
  activeCount: number;
  totalDurationSec: number;
}

export interface MachineRunStats {
  machineId: string;
  machineName: string;
  activeCount: number;
  totalRuns: number;
  totalDurationSec: number;
  lastActiveAt?: string;
  topApps: MachineAppBreakdown[];
}

export interface AppRunSummary {
  id: string;
  standSlug: string;
  standName: string;
  appName: string;
  host: string;
  port: number;
  environment: AppEnvironment;
  networkMode: AppNetworkMode;
  machineId: string;
  machineName: string;
  startedAt: string;
  lastHeartbeatAt: string;
  endedAt?: string;
  durationSec: number;
  endReason: AppRunEndReason;
}

export interface ProjectariumAnalytics {
  windowDays: number;
  generatedAt: string;
  totalRuns: number;
  activeRuns: number;
  totalDurationSec: number;
  machines: MachineRunStats[];
  topApps: Array<{
    appName: string;
    standSlug: string;
    standName: string;
    totalRuns: number;
    activeCount: number;
    totalDurationSec: number;
    machines: string[];
  }>;
  recentRuns: AppRunSummary[];
}

export interface StandNoteItem {
  id: string;
  title?: string;
  content: string;
  author: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStand {
  id: string;
  name: string;
  slug: string;
  projectToken?: string;
  description: string;
  color: LemonCardColor;
  isPinned: boolean;
  neuronPath: string;
  tags: string[];
  environments: AppEnvironment[];
  activeEnvironment: AppEnvironment | 'ALL';
  apps: StandAppItem[];
  chronicle: ProjectSessionLogEntry[];
  todos: ReactiveTodoItem[];
  notes: StandNoteItem[];
  createdAt: string;
  updatedAt: string;
}
