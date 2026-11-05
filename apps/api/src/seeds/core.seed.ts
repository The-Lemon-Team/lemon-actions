import { FlowStatus, FlowType } from '@prisma/client';
import { SeedFlow, SeedFolder } from './seed.types';

export const CORE_FOLDERS: SeedFolder[] = [
  { name: 'Workspace', path: 'workspace' },
  { name: 'Core Services', path: 'workspace.core' },
  { name: 'Billing Pipelines', path: 'workspace.billing' },
  { name: 'Infrastructure', path: 'infrastructure' },
  { name: 'Focus Modes', path: 'focus_modes' },
  { name: 'Event Hooks', path: 'event_hooks' },
  { name: 'Archival Tasks', path: 'archival' },
  { name: 'Home', path: 'home' },
  { name: 'Household Supplies', path: 'home.supplies' },
  { name: 'Home Routines', path: 'home.routines' },
  { name: 'Home Tasks', path: 'home.tasks' },
  { name: 'Neuron Arena', path: 'arena' },
  { name: 'Character Deck', path: 'arena.actors' },
  { name: 'Desire Cards Deck', path: 'arena.desire_cards' },
  { name: 'Friday Sync Field', path: 'arena.friday_sync' },
];

export const DEEP_WORK_FSM = {
  initial: 'idle',
  states: {
    idle: {
      label: 'Idle',
      badgeColor: '#9ca3af',
      transitions: [
        { event: 'START', target: 'focusing', ui: { buttonLabel: 'Start Focus', icon: 'play_arrow', intent: 'primary' } },
      ],
    },
    focusing: {
      label: 'Focusing',
      badgeColor: '#16a34a',
      transitions: [
        { event: 'BREAK', target: 'break', ui: { buttonLabel: 'Take Break', icon: 'coffee', intent: 'secondary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
    break: {
      label: 'On Break',
      badgeColor: '#f59e0b',
      transitions: [
        { event: 'RESUME', target: 'focusing', ui: { buttonLabel: 'Resume', icon: 'play_arrow', intent: 'primary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
  },
};

export const CORE_FLOWS: SeedFlow[] = [
  {
    name: 'Database Sync',
    description: 'Keeps primary and replica databases in sync; only one sync may run at a time.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: true,
    folder: 'workspace.core',
    tags: ['infra', 'db', 'mutex'],
    orchestratorRules: { onConflict: 'reject' },
  },
  {
    name: 'Deep Work State Machine',
    description: 'Tracks focus, break and idle states for deep work sessions.',
    type: FlowType.FSM,
    status: FlowStatus.INACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['focus', 'daily', 'routine'],
    config: DEEP_WORK_FSM,
  },
  {
    name: 'Workday Dev Window',
    description: 'Scheduled Mutex (10:00–19:00): размечает рабочее окно в flow_sessions, не отсекая запись истории.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['schedule', 'mutex', 'workday'],
    orchestratorRules: {
      schedule: {
        enabled: true,
        windows: [{ days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' }],
      },
    },
  },
  {
    name: 'Antigravity Session Lock',
    description: 'Мьютекс активной сессии программирования с автоматическим таймаутом аренды (5 мин).',
    type: FlowType.MUTEX,
    status: FlowStatus.INACTIVE,
    isExclusive: true,
    folder: 'focus_modes',
    tags: ['dev', 'antigravity', 'mutex'],
    orchestratorRules: {
      leaseTimeoutSeconds: 300,
      onConflict: 'reject',
    },
  },
  {
    name: 'Antigravity Work Log',
    description: 'Непрерывный поток-приемник логов и событий разработки (хранит слепок активных сессий).',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['dev', 'antigravity', 'telemetry'],
  },
  {
    name: 'Token Refresh Engine',
    description: 'Periodically refreshes auth tokens before they expire.',
    type: FlowType.TIMER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'workspace.core',
    tags: ['auth', 'security', 'routine'],
    config: { intervalSeconds: 3300 },
  },
  {
    name: 'Webhook Ingestion Router',
    description: 'Observes incoming webhook streams and routes them to handlers.',
    type: FlowType.OBSERVER,
    status: FlowStatus.PAUSED,
    isExclusive: false,
    folder: 'event_hooks',
    tags: ['webhook', 'stream', 'fsm'],
  },
  {
    name: 'Memory Compactor',
    description: 'Compacts in-memory caches to reclaim resources.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'infrastructure',
    tags: ['infrastructure', 'mutex', 'routine'],
  },
];
