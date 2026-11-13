import { LemonCardColor } from './worker.models';

export type ReactiveTriggerType =
  | 'MANUAL'
  | 'SERVICE_REGISTERED'
  | 'HEALTHCHECK_PING'
  | 'WORKER_TRIGGERED'
  | 'PORT_SHIELD'
  | 'CIRCUIT_BREAKER';

export interface ReactiveTodoItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  isReactive: boolean;
  triggerType?: ReactiveTriggerType;
  triggerDescription?: string;
  targetFilter?: string;
  scope?: 'PROJECT' | 'APP';
  targetAppName?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ReactiveTodoListCard {
  id: string;
  projectId: string; // e.g. "workspace.core", "workspace.reports", "home.supplies", "all"
  title: string;
  description?: string;
  color: LemonCardColor;
  isPinned: boolean;
  items: ReactiveTodoItem[];
  createdAt: string;
  updatedAt: string;
}
