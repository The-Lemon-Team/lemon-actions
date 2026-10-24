import { FlowStatus, FlowType } from '../models/flow.models';

export interface FlowTypeUi {
  label: string;
  icon: string;
  /** Tailwind classes for the type pill (from the prototype). */
  classes: string;
}

export const FLOW_TYPE_UI: Record<FlowType, FlowTypeUi> = {
  [FlowType.MUTEX]: { label: 'Mutex', icon: 'lock', classes: 'bg-surface-container-high text-on-surface' },
  [FlowType.FSM]: { label: 'FSM Graph', icon: 'schema', classes: 'bg-tertiary-container/50 text-on-tertiary-fixed' },
  [FlowType.TIMER]: { label: 'Interval Timer', icon: 'timer', classes: 'bg-surface-container-high text-on-surface' },
  [FlowType.OBSERVER]: { label: 'Reactive Stream', icon: 'bolt', classes: 'bg-secondary-fixed text-on-secondary-fixed' },
  [FlowType.CONTEXT]: { label: 'Context', icon: 'psychology', classes: 'bg-primary-fixed text-on-primary-fixed' },
};

export interface FlowStatusUi {
  label: string;
  pill: string;
  dot: string;
  pulse: boolean;
}

export const FLOW_STATUS_UI: Record<FlowStatus, FlowStatusUi> = {
  [FlowStatus.ACTIVE]: { label: 'Active', pill: 'bg-success-container text-on-success-container', dot: 'bg-success', pulse: true },
  [FlowStatus.PROCESSING]: { label: 'Processing', pill: 'bg-success-container text-on-success-container', dot: 'bg-success', pulse: true },
  [FlowStatus.PAUSED]: { label: 'Paused', pill: 'bg-warning-container text-on-warning-container', dot: 'bg-warning', pulse: false },
  [FlowStatus.INACTIVE]: { label: 'Idle', pill: 'bg-surface-container text-on-surface-variant', dot: 'bg-tertiary', pulse: false },
};

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
