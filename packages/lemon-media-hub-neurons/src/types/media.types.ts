export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MediaVisibility = 'PRIVATE' | 'SCOPED' | 'PUBLIC';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MediaFolder {
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

export interface MediaVariantSummary {
  id: string;
  variantType: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MediaAsset {
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
  waveformPeaks?: number[] | null;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
  processedAt?: string | null;
  visibility: MediaVisibility;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  sourceAssetId?: string | null;
  sourceApp: string;
  aiRequestId?: string | null;
  prompt?: string | null;
  userPrompt?: string | null;
  style?: string | null;
  model: string;
  variants?: MediaVariantSummary[];
  grants?: Array<{
    id: string;
    clientId: string;
    clientSlug?: string;
    clientName?: string;
    permission: 'READ' | 'WRITE';
    grantedAt: string;
    expiresAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AssetLineage {
  asset: MediaAsset;
  rootAsset: MediaAsset | null;
  parent: MediaAsset | null;
  ancestors: MediaAsset[];
  children: MediaAsset[];
  siblings: MediaAsset[];
}

export interface MediaSignedUrlResult {
  assetId: string;
  variant: string;
  relativeUrl: string;
  expiresAt: string;
}

export interface QueryAssetsOptions {
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: ProcessingStatus;
  folderId?: string;
  folderPath?: string;
  search?: string;
  style?: string;
  tag?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface UploadMediaInput {
  file: Blob | Uint8Array | ArrayBuffer;
  filename: string;
  mimeType?: string;
  folderPath?: string;
  tags?: string[];
  title?: string;
  description?: string;
  visibility?: MediaVisibility;
  allowedClients?: string[];
  aiRequestId?: string;
  sourceAssetId?: string;
  prompt?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
}

export type MediaImpulseType =
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

export interface MediaEventImpulse {
  id: string;
  type: MediaImpulseType;
  timestamp: string;
  assetId?: string;
  folderId?: string;
  folderPath?: string;
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: ProcessingStatus;
  asset?: MediaAsset;
  folder?: MediaFolder;
  payload?: Record<string, any>;
}

export interface MediaSsePacket {
  type: MediaImpulseType;
  impulse: MediaEventImpulse;
  receivedAt: number;
}

export interface MediaIngestRequest extends UploadMediaInput {
  dedupKey?: string;
  waitForReady?: boolean;
  readyTimeoutMs?: number;
  combinatorFlowId?: string;
}

export interface MediaIngestResult {
  asset: MediaAsset;
  dedupKey?: string;
  waitedForProcessing: boolean;
  elapsedMs: number;
}

export interface MediaDeleteRequest {
  assetId: string;
  reason?: string;
  combinatorFlowId?: string;
}

export interface MediaDeleteResult {
  assetId: string;
  success: boolean;
  deletedAt: string;
  reason?: string;
}

export interface MediaViewRequest {
  assetId: string;
  variant?: string;
  ttlSeconds?: number;
  trackUsage?: boolean;
  viewerContext?: string;
}

export interface MediaViewResolved {
  asset: MediaAsset;
  variant: string;
  url: string;
  relativeUrl: string;
  signed: boolean;
  expiresAt?: string;
}

export interface MediaUsageFlushBatch {
  flushedAt: string;
  countsByAsset: Record<string, number>;
  totalViews: number;
}

export interface FolderNeuronState<TAsset extends { id: string } = MediaAsset> {
  folderPath: string;
  filters: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>;
  items: TAsset[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  lastImpulse: MediaEventImpulse | null;
}

export interface MediaLibraryNeuronState<TAsset extends { id: string } = MediaAsset> {
  activeFolderPath: string;
  items: TAsset[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  lastImpulse: MediaEventImpulse | null;
}

export interface MediaServiceClient {
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

export interface MediaAssetNeuronState<TAsset extends { id: string } = MediaAsset> {
  assetId: string;
  asset: TAsset | null;
  resolvedUrl: string | null;
  thumbnailUrl: string | null;
  signedExpiresAt: string | null;
  processingStatus: ProcessingStatus | null;
  deleted: boolean;
  isLoading: boolean;
  error: string | null;
  lastImpulse: MediaEventImpulse | null;
}
