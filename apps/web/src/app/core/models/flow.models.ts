import { Observable } from 'rxjs';

export type AppMode = 'party' | 'arena' | 'home' | 'code' | 'core';

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

/* ---------- Imperative App «Lemon Code Lab» View Models ---------- */

export interface CodeTaskTestLog {
  test: string;
  error?: string;
  stack?: string;
}

export interface CodeTaskMeta {
  id: string;
  slug: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  testSuite?: string;
  repoId?: string;
  repoPath?: string;
  status?: 'PASSED' | 'FAILED' | 'STUB' | 'IN_PROGRESS' | 'NEW';
  testsTotal?: number;
  testsPassed?: number;
  testsFailed?: number;
  testsSkipped?: number;
  durationMs?: number;
  lastLogs?: CodeTaskTestLog[];
  lastRunAt?: string;
}

export interface CodeTaskView {
  flow: Flow;
  meta: CodeTaskMeta;
  tags: string[];
  isActive: boolean;
  isPassed: boolean;
  isFailed: boolean;
  isStub: boolean;
  repoName?: string;
}

export interface CodeRepoView {
  id: string;
  name: string;
  localPath: string;
  folderId: string;
  folderPath: string;
  profileId: string | null;
  defaultTags: string[];
  tasksCount: number;
  passedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  isWatching: boolean;
}

/* ---------- Imperative App «Neuron Arena · Teambuilding & Paradoxes» View Models ---------- */

export type ArenaActorCategory = 'HUMAN' | 'MYTHIC' | 'CYBER' | 'SAGE';
export type ArenaAccentColor = 'amber' | 'emerald' | 'indigo' | 'rose' | 'cyan' | 'violet';
export type ArenaVoiceSource = 'MANUAL_PUPPET' | 'AUDIO_VOICE' | 'NEURAL_DRAFT';
export type ArenaVoiceIntent = 'SUPPORT' | 'COUNTER_PROPOSE' | 'PARADOX_OPINION' | 'ANALYTICS';

export interface ArenaActorCard {
  id: string;
  handle: string;
  flowId: string;
  name: string;
  title: string;
  category: ArenaActorCategory;
  categoryLabel: string;
  avatarIcon: string;
  accentColor: ArenaAccentColor;
  rankLabel: string;
  quote: string;
  paradoxPhilosophy: string;
  favoriteDesire: string;
  affinities: string[];
  traits: {
    charisma: number;
    analytical: number;
    rebelVersus: number;
  };
  voicePitch: number;
  voiceRate: number;
  sampleVoices: {
    support: string;
    counter: string;
    paradox: string;
  };
  isLead: boolean;
  voicesCount: number;
}

export interface ArenaVoiceEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorTitle: string;
  actorIcon: string;
  actorAccent: ArenaAccentColor;
  paradoxId: string;
  threadId?: string | null;
  threadTitle?: string | null;
  intent: ArenaVoiceIntent;
  sourceMode: ArenaVoiceSource;
  text: string;
  durationSec: number;
  audioDataUrl?: string;
  activeNeuronSessions: string[];
  createdAt: string;
}

export interface ArenaDesireCardMatchRecord {
  id: string;
  gameTitle: string;
  paradoxId: string;
  playedAt: string;
  outcome: 'WON' | 'LOST';
  votesReceived: number;
  totalGameVotes: number;
  winnerCardId: string;
  winnerCardTitle: string;
  opponentTitles: string[];
  note: string;
}

export interface ArenaDesireCard {
  id: string;
  flowId: string;
  title: string;
  category: string;
  description: string;
  icon: string;
  colorTheme: ArenaAccentColor;
  tags: string[];
  createdByActorName: string;
  gamesPlayed: number;
  winsCount: number;
  lossesCount: number;
  winRatePercent: number;
  totalHistoricalVotes: number;
  nemesisCardTitle?: string | null;
  nemesisScore?: string | null;
  analyticsInsight: string;
  matchHistory: ArenaDesireCardMatchRecord[];
  isInCurrentField: boolean;
}

export interface ArenaDeckAnalytics {
  totalGamesAnalyzed: number;
  topWinnerCard: ArenaDesireCard | null;
  mostPlayedCard: ArenaDesireCard | null;
  headlineConclusion: string;
  rivalryInsights: string[];
}

export interface ArenaDesireThread {
  id: string;
  desireCardId?: string;
  flowId: string;
  paradoxId: string;
  title: string;
  subtitle: string;
  icon: string;
  colorTheme: ArenaAccentColor;
  proposerActorId: string;
  proposerName: string;
  proposerIcon: string;
  supporterActorIds: string[];
  supporters: Array<{
    id: string;
    name: string;
    title: string;
    icon: string;
    accentColor: ArenaAccentColor;
  }>;
  votesCount: number;
  sharePercent: number;
  isLeading: boolean;
  isWinner?: boolean;
  tags: string[];
  voices: ArenaVoiceEntry[];
  createdAt: string;
  cardStats?: {
    gamesPlayed: number;
    winsCount: number;
    winRatePercent: number;
    nemesisCardTitle?: string | null;
    analyticsInsight: string;
  };
}

export interface ArenaPeriodSummary {
  resolvedAt: string;
  winnerThreadId: string;
  winnerTitle: string;
  winnerIcon: string;
  winnerColor: ArenaAccentColor;
  winnerSupporters: string[];
  totalVotes: number;
  totalVoices: number;
  competingThreads: Array<{
    id: string;
    title: string;
    icon: string;
    votes: number;
    sharePercent: number;
    proposerName: string;
    colorTheme: ArenaAccentColor;
  }>;
  teamSynthesis: string;
  paradoxVerdict: string;
  characterHighlights: Array<{
    actorId: string;
    actorName: string;
    actorTitle: string;
    actorIcon: string;
    accentColor: ArenaAccentColor;
    stance: string;
  }>;
}

export interface ArenaParadoxField {
  id: string;
  folderPath: string;
  title: string;
  occasionTag: string;
  contextStory: string;
  paradoxQuestion: string;
  status: 'ACTIVE_BATTLE' | 'RESOLVED';
  periodLabel: string;
  resolvedSummary?: ArenaPeriodSummary | null;
}

export interface NeuralTrainingSample {
  id: string;
  timestamp: string;
  actorHandle: string;
  actorName: string;
  actorCategory: ArenaActorCategory;
  neuronPath: string;
  activeSessionSnapshot: string[];
  stimulusParadox: string;
  competingDesires: string[];
  intent: ArenaVoiceIntent;
  chosenThread: string | null;
  voiceOutput: string;
  sourceMode: ArenaVoiceSource;
}

/* ---------- Combine Mode (Поле Времени, Активная Зона (Pin) и Карточки Истории Совмещений) ---------- */

export type ArenaGameSubMode = 'VERSUS' | 'COMBINE' | 'CLOUD';
export type CombineIdeaOutcome = 'PENDING' | 'HIT' | 'SO_SO' | 'BORED_REPLACED';

export interface CombineActivitySuggestion {
  id: string;
  desireCardId?: string;
  timeFieldId: string;
  title: string;
  subtitle: string;
  icon: string;
  colorTheme: ArenaAccentColor;
  actorId: string;
  actorName: string;
  actorTitle: string;
  actorIcon: string;
  actorAccent: ArenaAccentColor;
  pitchVoice: string;
  isPinned: boolean;
  pinnedAt?: string | null;
  unpinnedReason?: string | null;
  replacedByTitle?: string | null;
  replacesTitle?: string | null;
  outcome: CombineIdeaOutcome;
  outcomeNote?: string;
  createdAt: string;
}

export interface CombineTimeField {
  id: string;
  folderPath: string;
  title: string;
  baseActivity: string;
  baseIcon: string;
  durationLabel: string;
  contextDescription: string;
  status: 'ACTIVE_COMBINE' | 'SAVED_TO_HISTORY';
}

export interface CombineHistoryCard {
  id: string;
  timeFieldId: string;
  timeFieldTitle: string;
  baseActivity: string;
  baseIcon: string;
  durationLabel: string;
  savedAt: string;
  pinnedActivities: Array<{
    id: string;
    title: string;
    icon: string;
    actorName: string;
    actorIcon: string;
    colorTheme: ArenaAccentColor;
    outcome: CombineIdeaOutcome;
    note: string;
    replacesTitle?: string | null;
  }>;
  replacedActivities: Array<{
    id: string;
    title: string;
    icon: string;
    actorName: string;
    reason: string;
    replacedByTitle: string;
  }>;
  mostSuccessfulActorName: string;
  mostSuccessfulIdeaTitle: string;
  synthesisConclusion: string;
}

/* ---------- Imperative App «Chrono Cloud · Daily Character Notes & Timeline» View Models ---------- */

export type CloudItemType = 'thought' | 'proposal' | 'action';
export type NoteVisibility = 'PUBLIC' | 'PRIVATE' | 'GM_ONLY';

export interface CloudDayNote {
  id: string;
  dateKey: string;
  time: string;
  timeMinutes: number;
  type: CloudItemType;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  actorAccent: ArenaAccentColor;
  actorTitle?: string;
  title?: string;
  text: string;
  tags?: string[];
  supporters: string[];
  votesCount: number;
  moodEmoji?: string;
  createdAt: string;

  /* Hybrid Model fields: Player ownership, pins & cloud syncing */
  authorProfileId?: string;
  authorProfileName?: string;
  visibility?: NoteVisibility;
  isPinnedToHero?: boolean;
  isPinnedToCloud?: boolean;
  forkedFromNoteId?: string;
  forkedFromAuthorName?: string;
}

export interface CloudDateTab {
  dateKey: string;
  label: string;
  subLabel: string;
  isToday: boolean;
  notesCount: number;
}




