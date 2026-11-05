import { Observable } from 'rxjs';

export type AppMode = 'home' | 'core';

export interface Profile {
  id: string;
  handle: string;
  displayName: string;
  avatarIcon?: string;
  createdAt: string;
}

export enum FlowType {
  CONTEXT = 'CONTEXT',
  MUTEX = 'MUTEX',
  OBSERVER = 'OBSERVER',
  FSM = 'FSM',
  TIMER = 'TIMER',
}

export enum FlowStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
}

export interface Tag {
  id: string;
  name: string;
  colorHex?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  profileId?: string | null;
  /** ltree path, e.g. 'home.supplies' or 'workspace.core' */
  path: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  isExpanded?: boolean;
}

export interface FsmConfig {
  initial: string;
  states: Record<
    string,
    {
      label: string;
      badgeColor: string;
      transitions: Array<{
        event: string;
        target: string;
        ui: { buttonLabel: string; icon?: string; intent: string };
      }>;
    }
  >;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  type: FlowType;
  status: FlowStatus;
  isExclusive: boolean;
  folderId: string | null;
  profileId?: string | null;
  tags: Tag[];
  config?: FsmConfig | any;
  orchestratorRules?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowPayload {
  name: string;
  description?: string;
  type: FlowType;
  isExclusive?: boolean;
  folderId?: string | null;
  profileId?: string | null;
  tags?: string[];
  config?: unknown;
  orchestratorRules?: unknown;
}

export interface FlowRowState {
  flow: Flow;
  /** Frontend-only addition: isolated per-row flow stream (for reactive config/state updates). */
  flow$: Observable<Flow>;
  /** Frontend-only addition: isolated per-row status stream (drives the badge). */
  status$: Observable<FlowStatus>;
  isActive$: Observable<boolean>;
  currentDuration$: Observable<number>;
}

/* ---------- Frontend view models (not part of the backend contract) ---------- */

export interface FlowMetrics {
  registered: number;
  executing: number;
  paused: number;
  standby: number;
}

/** Folder enriched for rendering the nested tree from the flat ltree list. */
export interface FolderNode extends Folder {
  children: FolderNode[];
  isExpanded: boolean;
  isSelected: boolean;
  depth: number;
  /** Number of flows in this folder subtree. */
  flowCount: number;
  /** Whether any flow in this subtree is actively running. */
  hasActiveFlow: boolean;
}

export interface TagWithCount extends Tag {
  flowCount: number;
  isSelected: boolean;
}

/* ---------- Core Combinator Rules & Chronicle Contracts ---------- */

export interface FlowScheduleWindow {
  days: number[];
  start: string;
  end: string;
}

export interface FlowOrchestratorRules {
  onConflict?: 'reject' | 'pause';
  leaseTimeoutSeconds?: number;
  schedule?: {
    enabled?: boolean;
    windows: FlowScheduleWindow[];
  };
}

export interface FlowSessionRecord {
  id: string;
  flowId: string;
  startedAt: string;
  endedAt?: string | null;
  closedBy?: string | null;
}

export interface FlowEventRecord {
  id: string;
  flowId: string;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  activeFlowSessionIds: string[];
  createdAt: string;
}

/* ---------- Imperative App «Lemon Home» View Models ---------- */

export interface RoomTask {
  id: string;
  title: string;
  room: string;
  done: boolean;
  createdAt: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface HomeWidgetMeta {
  kind?: 'supply' | 'routine';
  icon?: string;
  room?: string;
  expectedDays?: number;
  unitHint?: string;
  scheduleLabel?: string;
  brand?: string;
  price?: string;
  note?: string;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  daysPerUnit?: number;
}

export interface HomeWidgetView {
  flow: Flow;
  kind: 'supply' | 'routine';
  icon: string;
  room: string;
  expectedDays: number;
  unitHint: string;
  scheduleLabel?: string;
  brand?: string;
  price?: string;
  note?: string;
  isInStock: boolean;
  daysSinceUpdate: number;
  folderPath: string;
  currentQty: number;
  maxQty: number;
  unit: string;
  step: number;
  daysPerUnit: number;
  percentage: number;
}
