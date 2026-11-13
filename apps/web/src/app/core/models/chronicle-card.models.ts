import { LemonCardColor } from './worker.models';

export type ChronicleEventType =
  | 'MILESTONE'
  | 'DEPLOY'
  | 'WORKER_RUN'
  | 'SERVICE_EVENT'
  | 'NOTE'
  | 'CIRCUIT_BREAKER';

export interface ProjectSessionLogEntry {
  id: string;
  timestamp: string;
  type: ChronicleEventType;
  author: string;
  title: string;
  details?: string;
  latencyMs?: number;
  badge?: string;
}

export interface ProjectChronicleCard {
  id: string;
  projectId: string; // e.g. "workspace.core", "workspace.reports", "home.supplies"
  projectName: string;
  description: string;
  color: LemonCardColor;
  isPinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metrics: {
    totalRuns: number;
    healthyServices: number;
    activeWorkers: number;
    lastActivity: string;
  };
  history: ProjectSessionLogEntry[];
}
