/**
 * Lemon Actions — Lemon-Projectarium Types
 *
 * Core domain contracts for unified project stands, Smart Upsert registration,
 * Port Shield port allocation, dual-level reactive task boards, and history chronicles.
 */

export type ProjectariumAppStatus = 'ONLINE' | 'DEGRADED' | 'CHECKING' | 'EVICTED';
export type ProjectariumEnvironment = 'dev' | 'staging' | 'production';
export type ProjectariumNetworkMode = 'local' | 'tailscale-lan' | 'tailscale-funnel';
export type ProjectariumScope = 'PROJECT' | 'APP';
export type ProjectariumPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProjectariumApp {
  id: string;
  appName: string;
  port: number;
  instanceId: string;
  leaseToken: string;
  environment: ProjectariumEnvironment;
  networkMode: ProjectariumNetworkMode;
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

export type ProjectariumEventType =
  | 'PROJECT_CREATED'
  | 'APP_REGISTERED'
  | 'APP_HEARTBEAT'
  | 'APP_DEGRADED'
  | 'APP_EVICTED'
  | 'APP_RELEASED'
  | 'TODO_ADDED'
  | 'TODO_TOGGLED'
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
  chronicle: ProjectariumEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectariumRegisterPayload {
  projectSlug?: string;
  projectName?: string;
  projectToken?: string;
  appName?: string;
  preferredPort?: number;
  environment?: ProjectariumEnvironment;
  networkMode?: ProjectariumNetworkMode;
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
}
