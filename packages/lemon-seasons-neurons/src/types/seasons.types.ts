export type NoteType =
  | 'SINGLE'
  | 'PERIOD'
  | 'EVENT'
  | 'FILM_RELEASE'
  | 'MENTION'
  | 'DONE';

export type NotePrivacy = 'public' | 'private';

export interface IngestSeasonNoteInput {
  externalId?: string;
  title?: string;
  content: string;
  summary?: string;
  type?: NoteType;
  privacy?: NotePrivacy;
  status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  feedSlug?: string;
  feedId?: string;
  streamSlug?: string;
  author?: string;
  parentNoteId?: string;
  startDate?: string;
  endDate?: string;
  icon?: string;
  tags?: string[];
  folder?: string;
  origin?: string;
  metadata?: Record<string, any>;
}

export interface NotesPageQuery {
  limit?: number;
  offset?: number;
  feedId?: string;
  feedSlug?: string;
  streamSource?: string;
  type?: string;
  privacy?: 'public' | 'private' | 'all';
  author?: string;
  parentNoteId?: string;
  hashtag?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: 'startDate' | 'type' | 'folder' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedNotesWindow<T = any> {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: T[];
}

export interface TopologyFeedNode {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  color?: string;
  privacy: NotePrivacy;
  notesCount: number;
}

export interface TopologyStreamNode {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  color?: string;
  privacy: NotePrivacy;
  feeds: TopologyFeedNode[];
}

export interface SeasonsTopologySnapshot {
  streams: TopologyStreamNode[];
  totalNotes: number;
  totalFeeds: number;
}

export interface SeasonsLiveNoteImpulse {
  id: string;
  type:
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'NOTE_ENTERED'
    | 'NOTE_LEFT'
    | 'STREAM_UPDATED';
  noteId?: string;
  streamSlug?: string;
  feedSlug?: string;
  note?: IngestSeasonNoteInput;
  timestamp: string;
}

export interface SeasonsSsePacket {
  event: string;
  data: SeasonsLiveNoteImpulse;
  id?: string;
}
