export type SeasonsPrivacy = 'public' | 'private';

export interface SeasonsStatusView {
  baseUrl: string;
  connected: boolean;
  projectariumStreamSlug: string;
  error?: string;
}

export interface SeasonsTodoItemView {
  id: string;
  title: string;
  completed: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  scope?: 'PROJECT' | 'APP';
  targetAppName?: string;
  author?: string;
  createdAt?: string;
  completedAt?: string | null;
}

export interface SeasonsTodoStatsView {
  total: number;
  completed: number;
  pending: number;
}

export interface SeasonsTabNodeView {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
  type: string;
  count: number;
  badge?: string | null;
  isHidden?: boolean;
  order?: number;
}

export interface SeasonsFeedNodeView {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  privacy: SeasonsPrivacy;
  totalNotes: number;
  publishedNotes: number;
  stagingNotes: number;
  upcomingCount?: number;
  byType?: Record<string, number>;
  streamSlugs: string[];
  lastNoteAt?: string | null;
}

export interface SeasonsStreamNodeView {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  badge?: string | null;
  privacy: SeasonsPrivacy;
  order?: number;
  totalNotes: number;
  upcomingCount?: number;
  tabs: SeasonsTabNodeView[];
}

export interface SeasonsTopologyView {
  revision: number;
  contour: 'public' | 'admin';
  totals: {
    streams?: number;
    feeds?: number;
    notes: number;
    publicNotes?: number;
    privateNotes?: number;
    upcomingNotes?: number;
    activePeriods?: number;
  };
  streams: SeasonsStreamNodeView[];
  feeds: SeasonsFeedNodeView[];
}

export interface SeasonsNoteView {
  id: string;
  title: string;
  description?: string | null;
  rawContent?: string | null;
  summary?: string | null;
  type: 'SINGLE' | 'PERIOD' | 'EVENT' | 'FILM_RELEASE' | 'MENTION' | 'DONE' | string;
  privacy: SeasonsPrivacy;
  status?: string;
  icon?: string | null;
  author?: string | null;
  externalId?: string | null;
  startDate?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: {
    todoList?: SeasonsTodoItemView[];
    todoStats?: SeasonsTodoStatsView;
    [key: string]: unknown;
  } | null;
  hashtags?: Array<{ id?: string; name: string }>;
}

export interface SeasonsPaginatedNotesView {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: SeasonsNoteView[];
}

export type SeasonsSsePacketView =
  | {
      kind: 'note';
      event: {
        id: string;
        type: string;
        noteId?: string;
        streamSlug?: string;
        feedSlug?: string;
        timestamp: string | number;
      };
    }
  | {
      kind: 'topology';
      patch: {
        type: 'TOPOLOGY_PATCH';
        revision: number;
        timestamp: number;
        reason?: string;
      };
    };
