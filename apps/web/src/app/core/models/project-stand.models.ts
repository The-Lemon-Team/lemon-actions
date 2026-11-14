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
  status: StandAppStatus;
  lastLatencyMs: number;
  lastCheckedAt: string;
  consecutiveFailures: number;
  icon: string;
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
