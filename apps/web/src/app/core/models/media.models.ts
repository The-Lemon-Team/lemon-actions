export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MediaVisibility = 'PRIVATE' | 'SCOPED' | 'PUBLIC';
export type MediaProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MediaCombinatorNeuronSummaryView {
  channel: string;
  neuronId: string;
  path: string;
  flowIds: string[];
}

export interface MediaStatusView {
  baseUrl: string;
  connected: boolean;
  authenticated: boolean;
  sseConnected: boolean;
  neuronsSynced: boolean;
  combinatorNeurons: MediaCombinatorNeuronSummaryView[];
  error?: string;
}

export interface MediaFolderView {
  id: string;
  name: string;
  path: string;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
  defaultVisibility: MediaVisibility;
  assetsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAccessGrantView {
  id: string;
  clientId: string;
  clientSlug?: string;
  clientName?: string;
  permission: 'READ' | 'WRITE';
  grantedAt: string;
  expiresAt?: string | null;
}

export interface MediaVariantSummaryView {
  id: string;
  variantType: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MediaAssetView {
  id: string;
  kind: MediaKind;
  title?: string | null;
  description?: string | null;
  url: string;
  thumbnailUrl: string;
  filename: string;
  originalFilename: string;
  folderId?: string | null;
  folderPath: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  aspectRatio: string;
  durationMs?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  processingStatus: MediaProcessingStatus;
  processingError?: string | null;
  processedAt?: string | null;
  visibility: MediaVisibility;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  sourceAssetId?: string | null;
  sourceApp: string;
  prompt?: string | null;
  userPrompt?: string | null;
  style?: string | null;
  model: string;
  variants?: MediaVariantSummaryView[];
  grants?: MediaAccessGrantView[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetLineageView {
  asset: MediaAssetView;
  rootAsset: MediaAssetView | null;
  parent: MediaAssetView | null;
  ancestors: MediaAssetView[];
  children: MediaAssetView[];
  siblings: MediaAssetView[];
}

export interface MediaAssetsPageView {
  items: MediaAssetView[];
  total: number;
}

export interface MediaServiceClientView {
  id: string;
  slug: string;
  name: string;
  apiKeyPrefix: string;
  apiKey?: string;
  scopes: string[];
  isActive: boolean;
  grantsCount?: number;
  createdAt: string;
}

export interface MediaAssetsQuery {
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: MediaProcessingStatus;
  folderPath?: string;
  search?: string;
  tag?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface MediaSseImpulseView {
  id: string;
  type:
    | 'MEDIA_ADDED'
    | 'MEDIA_PROCESSING'
    | 'MEDIA_READY'
    | 'MEDIA_FAILED'
    | 'MEDIA_UPDATED'
    | 'MEDIA_ACCESS_CHANGED'
    | 'MEDIA_FAVORITED'
    | 'MEDIA_VIEWED'
    | 'MEDIA_DELETED'
    | 'FOLDER_CREATED'
    | 'FOLDER_DELETED';
  timestamp: string;
  assetId?: string;
  folderId?: string;
  folderPath?: string;
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: MediaProcessingStatus;
  asset?: MediaAssetView;
  folder?: MediaFolderView;
  payload?: Record<string, unknown>;
}

export interface MediaSsePacketView {
  type: MediaSseImpulseView['type'];
  impulse: MediaSseImpulseView;
  receivedAt: number;
}
