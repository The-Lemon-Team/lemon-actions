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

export interface AiHealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export interface AiStatusResponse {
  configured: boolean;
  service: string;
  imageEngine: string;
  imageModels: string[];
  geminiConfigured: boolean;
  textModels: string[];
}

export interface AiMediaAssetSummary {
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

export interface GenerateTextRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface GenerateTextResponse {
  text: string;
  requestId: string;
}

export interface GenerateNoteRequest {
  title?: string;
  topic?: string;
  tags?: string[];
  tone?: AiTone;
  category?: string;
  dateStr?: string;
  context?: string;
  noteType?: string;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface GeneratedNoteResult {
  title: string;
  content: string;
  tags: string[];
  summary: string;
  keyQuote?: string;
  requestId?: string;
}

export interface ParseQuickAddRequest {
  rawText: string;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface QuickAddParsedResult {
  title: string;
  content: string;
  tags: string[];
  eventDate: string | null;
  priority: 'low' | 'normal' | 'high';
  suggestedCoverPrompt: string;
  requestId?: string;
}

export interface GenerateImagesRequest {
  prompt: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string;
  count?: number;
  tags?: string[];
  context?: string;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface GenerateImagesResponse {
  requestId: string;
  synthesizedPrompt: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: AiMediaAssetSummary[];
}

export interface RemixImageRequest {
  sourceAssetId: string;
  instruction: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string;
  count?: number;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface RemixImageResponse {
  requestId: string;
  sourceAsset: AiMediaAssetSummary;
  remixPrompt: string;
  description: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: AiMediaAssetSummary[];
}

export interface AnalyzeImageRequest {
  sourceAssetId: string;
  instruction?: string;
  correlationId?: string;
  combinatorFlowId?: string;
}

export interface AnalyzeImageResponse {
  requestId: string;
  sourceAssetId: string;
  description: string;
  tags: string[];
}

export interface AiRequestLog {
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
  taskType?: AiTaskType;
  status?: AiRequestStatus;
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface AiHistoryPage {
  items: AiRequestLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AiUsageStats {
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

export interface AiClientApp {
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

export interface CreateAiClientInput {
  slug: string;
  name: string;
  allowedTasks?: AiTaskType[];
  dailyLimit?: number;
}

export interface CreatedAiClientResponse extends AiClientApp {
  apiKey: string;
}

export type AiImpulseType =
  | 'AI_TASK_SUBMITTED'
  | 'AI_TEXT_GENERATED'
  | 'AI_NOTE_GENERATED'
  | 'AI_QUICK_ADD_PARSED'
  | 'AI_IMAGES_GENERATED'
  | 'AI_IMAGE_REMIXED'
  | 'AI_IMAGE_ANALYZED'
  | 'AI_TASK_FAILED'
  | 'AI_CLIENT_CREATED'
  | 'AI_HISTORY_SYNCED';

export interface AiEventImpulse {
  type: AiImpulseType;
  taskType?: AiTaskType;
  requestId?: string;
  correlationId?: string;
  model?: string;
  isFallback?: boolean;
  mediaAssetIds?: string[];
  summary?: string;
  error?: string;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface AiSsePacket {
  type: AiImpulseType;
  impulse: AiEventImpulse;
  receivedAt: number;
}

export interface AiHistoryNeuronState {
  items: AiRequestLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  filters: AiHistoryQuery;
  stats: AiUsageStats | null;
  isLoading: boolean;
  lastImpulse: AiEventImpulse | null;
}
