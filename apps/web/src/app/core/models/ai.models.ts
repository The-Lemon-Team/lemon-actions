export type AiTaskType =
  | 'TEXT_GENERATE'
  | 'NOTE_GENERATE'
  | 'QUICK_ADD_PARSE'
  | 'PROMPT_SYNTHESIS'
  | 'IMAGE_GENERATE'
  | 'IMAGE_REMIX'
  | 'VISION_ANALYZE'
  | 'AUDIO_TRANSCRIBE';

export type AiRequestStatus = 'PENDING' | 'SUCCESS' | 'FALLBACK' | 'FAILED';

export type ImageAspectRatio = '16:9' | '1:1' | '9:16' | '4:3' | '3:4';

export type AiTone = 'professional' | 'creative' | 'concise' | 'academic';

export interface AiCombinatorNeuronSummaryView {
  channel: string;
  neuronId: string;
  path: string;
  flowIds: string[];
}

export interface AiStatusView {
  baseUrl: string;
  connected: boolean;
  authenticated: boolean;
  hasApiKey: boolean;
  configured: boolean;
  geminiConfigured: boolean;
  imageEngine: string;
  textModels: string[];
  imageModels: string[];
  neuronsSynced: boolean;
  combinatorNeurons: AiCombinatorNeuronSummaryView[];
  error?: string;
}

export interface AiMediaAssetSummaryView {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  folderPath?: string;
  prompt?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
  sourceAssetId?: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  persisted?: boolean;
}

export interface AiGeneratedTextView {
  text: string;
  requestId: string;
}

export interface AiGeneratedNoteView {
  title: string;
  content: string;
  tags: string[];
  summary: string;
  keyQuote?: string;
  requestId?: string;
}

export interface AiQuickAddView {
  title: string;
  content: string;
  tags: string[];
  eventDate: string | null;
  priority: 'low' | 'normal' | 'high';
  suggestedCoverPrompt: string;
  requestId?: string;
}

export interface AiGeneratedImagesView {
  requestId: string;
  synthesizedPrompt: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: AiMediaAssetSummaryView[];
}

export interface AiRemixedImageView {
  requestId: string;
  sourceAsset: AiMediaAssetSummaryView;
  remixPrompt: string;
  description: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: AiMediaAssetSummaryView[];
}

export interface AiAnalyzedImageView {
  requestId: string;
  sourceAssetId: string;
  description: string;
  tags: string[];
}

export interface AiRequestLogView {
  id: string;
  clientId?: string | null;
  clientSlug: string;
  correlationId?: string | null;
  taskType: AiTaskType;
  provider: string;
  model: string;
  status: AiRequestStatus;
  isFallback: boolean;
  inputPayload: Record<string, any>;
  outputPayload?: Record<string, any> | null;
  errorMessage?: string | null;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  mediaAssetIds: string[];
  createdAt: string;
}

export interface AiHistoryQuery {
  clientSlug?: string;
  taskType?: AiTaskType | '';
  status?: AiRequestStatus | '';
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface AiHistoryPageView {
  items: AiRequestLogView[];
  total: number;
  limit: number;
  offset: number;
}

export interface AiUsageStatsView {
  totalRequests: number;
  avgLatencyMs: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  byStatus: Array<{ status: AiRequestStatus; count: number }>;
  byTask: Array<{ taskType: AiTaskType; count: number; avgLatencyMs: number }>;
}

export interface AiClientAppView {
  id: string;
  slug: string;
  name: string;
  apiKeyPrefix: string;
  allowedTasks: AiTaskType[];
  dailyLimit?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatedAiClientView extends AiClientAppView {
  apiKey: string;
}

export interface AiEventImpulseView {
  type: string;
  taskType?: AiTaskType;
  requestId?: string;
  correlationId?: string;
  model?: string;
  isFallback?: boolean;
  mediaAssetIds?: string[];
  summary?: string;
  error?: string;
  timestamp: string;
}

export interface AiSsePacketView {
  type: string;
  impulse: AiEventImpulseView;
  receivedAt: number;
}

export type AiStudioMode = 'text' | 'note' | 'quick-add' | 'images' | 'remix' | 'vision';

export type AiStudioResultUnion =
  | { kind: 'text'; data: AiGeneratedTextView }
  | { kind: 'note'; data: AiGeneratedNoteView }
  | { kind: 'quick-add'; data: AiQuickAddView }
  | { kind: 'images'; data: AiGeneratedImagesView }
  | { kind: 'remix'; data: AiRemixedImageView }
  | { kind: 'vision'; data: AiAnalyzedImageView };
