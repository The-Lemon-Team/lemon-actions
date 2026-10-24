import { Observable } from 'rxjs';

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
  /** ltree path, e.g. 'root.workspace' */
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
  tags: Tag[];
  config?: FsmConfig | any;
  orchestratorRules?: any;
  createdAt: string;
  updatedAt: string;
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
