/**
 * Lemon Actions — Application Registrar & Live Service Mesh Types
 *
 * Core domain contracts for dynamic agent app registration, port allocation,
 * instance leasing, environments (dev/staging/production), network routing modes
 * (localhost, Tailscale LAN, Tailscale Funnel), and History Neuron chronicles.
 */

export type AppHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CHECKING' | 'EVICTED';

export type AppEnvironment = 'dev' | 'staging' | 'production';

export type AppNetworkMode = 'local' | 'tailscale-lan' | 'tailscale-funnel';

export interface ServiceCheckpointContext {
  id: string;
  appName: string;
  url: string;
  port: number;
  instanceId: string;
  leaseToken: string;
  environment: AppEnvironment;
  networkMode: AppNetworkMode;
  method: 'GET' | 'HEAD' | 'POST';
  expectedStatus: number;
  timeoutMs: number;
  group: 'Core Infrastructure' | 'Agent Dynamic Apps' | 'External APIs';
  icon?: string;
  projectId?: string;
  projectName?: string;
  registeredAt: string;
}

export interface ServicePingRecord {
  id: string;
  timestamp: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  statusCode: number;
  latencyMs: number;
  error?: string;
}

export interface ServiceHealthItemState {
  context: ServiceCheckpointContext;
  currentStatus: AppHealthStatus;
  consecutiveFailures: number;
  maxFailuresBeforeEviction: number;
  lastLatencyMs: number;
  lastCheckedAt: string;
  history: ServicePingRecord[];
}

export interface RegistryChronicleEvent {
  id: string;
  timestamp: string;
  type: 'ALLOCATED' | 'HEARTBEAT' | 'DEGRADED' | 'EVICTED' | 'RELEASED';
  appName: string;
  port: number;
  instanceId: string;
  environment: AppEnvironment;
  networkMode: AppNetworkMode;
  message: string;
}

export interface LiveRegistryPoolSnapshot {
  id: string;
  neuronPath: string;
  historyNeuronPath: string;
  title: string;
  totalServices: number;
  healthyCount: number;
  averageLatencyMs: number;
  lastRunAt: string;
  autoRefreshIntervalSec: number;
  isAutoRefreshActive: boolean;
  services: ServiceHealthItemState[];
  evictedServices: ServiceHealthItemState[];
  chronicle: RegistryChronicleEvent[];
}

export interface RegisterAppPayload {
  appName: string;
  customPort?: number;
  environment?: AppEnvironment;
  networkMode?: AppNetworkMode;
  group?: 'Core Infrastructure' | 'Agent Dynamic Apps' | 'External APIs';
  expectedStatus?: number;
  timeoutMs?: number;
  projectId?: string;
  projectName?: string;
}
