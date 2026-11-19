export type NoteType =
  | 'SINGLE'
  | 'PERIOD'
  | 'EVENT'
  | 'FILM_RELEASE'
  | 'MENTION'
  | 'DONE';

export type NotePrivacy = 'public' | 'private';

export interface NoteTodoItem {
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

export interface NoteTodoStats {
  total: number;
  completed: number;
  pending: number;
}

export interface NoteMediaAttachmentInput {
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  caption?: string;
  alt?: string;
  isMain?: boolean;
  mediaAssetId?: string;
}

export interface IngestSeasonNoteInput {
  externalId?: string;
  title?: string;
  content: string;
  summary?: string;
  type?: NoteType;
  privacy?: NotePrivacy;
  ownerUserId?: string;
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
  todoList?: NoteTodoItem[];
  imageUrl?: string;
  imageCaption?: string;
  images?: NoteMediaAttachmentInput[];
  mediaAssetIds?: string[];
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

export interface TopologyTabNode {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
  type: 'feed' | 'all' | 'period' | 'hashtag' | string;
  count: number;
  badge?: string | null;
  isHidden?: boolean;
  order?: number;
}

export interface TopologyFeedNode {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  privacy: NotePrivacy;
  totalNotes: number;
  publishedNotes: number;
  stagingNotes: number;
  upcomingCount?: number;
  byType?: Record<string, number>;
  streamSlugs: string[];
  lastNoteAt?: string | null;
  notesCount?: number;
}

export interface TopologyStreamNode {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  badge?: string | null;
  privacy: NotePrivacy;
  order?: number;
  totalNotes: number;
  upcomingCount?: number;
  tabs: TopologyTabNode[];
  subtopics?: Array<{ slug: string; label: string; count: number }>;
  feeds?: TopologyFeedNode[];
}

export interface TopologyFacetItem {
  name: string;
  count: number;
}

export interface TopologyDateBucket {
  dateKey: string;
  count: number;
}

export interface TopologyAuthorFacet {
  author: string;
  count: number;
}

export interface SeasonsTopologySnapshot {
  revision: number;
  contour: 'public' | 'admin';
  syncCursor?: {
    revision: number;
    lastEventId: string | null;
    serverTime: string;
  };
  totals: {
    streams?: number;
    feeds?: number;
    notes: number;
    publicNotes?: number;
    privateNotes?: number;
    upcomingNotes?: number;
    activePeriods?: number;
  };
  streams: TopologyStreamNode[];
  feeds: TopologyFeedNode[];
  facets?: {
    dateBuckets?: TopologyDateBucket[];
    authors?: TopologyAuthorFacet[];
    hashtags?: TopologyFacetItem[];
  };
  activePeriods?: Array<Record<string, any>>;
  totalNotes?: number;
  totalFeeds?: number;
}

export interface SeasonsTopologyPatch {
  type: 'TOPOLOGY_PATCH';
  revision: number;
  previousRevision?: number;
  timestamp: number;
  reason?: string;
  totals?: {
    streams?: number;
    feeds?: number;
    notes: number;
    publicNotes?: number;
    privateNotes?: number;
    upcomingNotes?: number;
    activePeriods?: number;
  };
  streams?: Record<
    string,
    {
      totalNotes: number;
      upcomingCount?: number;
      tabs?: Array<{ slug: string; count: number }>;
    }
  >;
  feeds?: Record<
    string,
    {
      totalNotes: number;
      publishedNotes: number;
      stagingNotes: number;
      byType?: Record<string, number>;
      lastNoteAt?: string | null;
    }
  >;
  dateBuckets?: Record<string, number>;
  authors?: Record<string, number>;
  hashtags?: Record<string, number>;
}

export interface SeasonsLiveNoteImpulse {
  id: string;
  type:
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'NOTE_ENTERED'
    | 'NOTE_LEFT'
    | 'STREAM_UPDATED'
    | 'FEED_UPDATED'
    | 'TOPOLOGY_CHANGED';
  noteId?: string;
  externalId?: string | null;
  parentNoteId?: string | null;
  title?: string;
  summary?: string | null;
  author?: string | null;
  origin?: string;
  streamSlug?: string | null;
  streamSlugs?: string[];
  feedId?: string | null;
  feedSlug?: string | null;
  previousFeedSlug?: string | null;
  feedTitle?: string | null;
  feedIcon?: string | null;
  feedColor?: string | null;
  privacy?: 'public' | 'private';
  status?: string;
  noteType?: string;
  dateKey?: string | null;
  hashtags?: string[];
  isPromoted?: boolean;
  publishedAt?: string | null;
  note?: any;
  timestamp: string | number;
}

export interface ShareNoteInput {
  granteeUserIds: string[];
  scopeType?: 'USER' | 'TIMELINE_GROUP';
  scopeRef?: string;
  canReadMedia?: boolean;
  expiresAt?: string;
}

export interface ShareFeedInput {
  granteeUserId: string;
  permission?: 'READ' | 'WRITE';
}

export type SeasonsSsePacket =
  | { kind: 'note'; event: SeasonsLiveNoteImpulse }
  | { kind: 'topology'; patch: SeasonsTopologyPatch }
  | { kind: 'snapshot'; snapshot: SeasonsTopologySnapshot };
