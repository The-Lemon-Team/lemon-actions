import { FlowStatus, FlowType } from '../models/flow.models';
import { I18nService } from '../i18n/i18n.service';

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

export function getFlowTypeUi(type: FlowType, i18n?: I18nService): FlowTypeUi {
  const base = FLOW_TYPE_UI[type];
  if (!i18n) return base;
  return {
    ...base,
    label: i18n.translateFlowType(type),
  };
}

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

export function getFlowStatusUi(status: FlowStatus, i18n?: I18nService): FlowStatusUi {
  const base = FLOW_STATUS_UI[status];
  if (!i18n) return base;
  return {
    ...base,
    label: i18n.translateFlowStatus(status),
  };
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export interface ProjectTheme {
  name: string;
  icon: string;
  badgeClass: string;
}

export const PROJECT_THEMES: Record<string, ProjectTheme> = {
  workspace: {
    name: 'Workspace',
    icon: 'domain',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25 hover:bg-blue-500/20',
  },
  home: {
    name: 'Lemon Home',
    icon: 'cottage',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20',
  },
  arena: {
    name: 'Neuron Arena',
    icon: 'psychology',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25 hover:bg-purple-500/20',
  },
  infrastructure: {
    name: 'Infrastructure',
    icon: 'dns',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/20',
  },
  focus_modes: {
    name: 'Focus Modes',
    icon: 'self_improvement',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20',
  },
  event_hooks: {
    name: 'Event Hooks',
    icon: 'bolt',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/20',
  },
  archival: {
    name: 'Archival',
    icon: 'archive',
    badgeClass: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/25 hover:bg-stone-500/20',
  },
  code: {
    name: 'Code Lab',
    icon: 'terminal',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25 hover:bg-indigo-500/20',
  },
};

export function getProjectTheme(path: string): ProjectTheme {
  const root = (path.split('.')[0] || '').toLowerCase();
  return (
    PROJECT_THEMES[root] ?? {
      name: root ? root.charAt(0).toUpperCase() + root.slice(1) : 'General',
      icon: 'category',
      badgeClass:
        'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest',
    }
  );
}
