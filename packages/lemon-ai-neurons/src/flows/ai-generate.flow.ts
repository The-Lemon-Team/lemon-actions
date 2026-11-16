import { Observable, Subject } from 'rxjs';
import { AiCombinatorBridge } from '../bridge/ai-combinator.bridge';
import { AiImpulseBus } from '../client/ai-impulse.bus';
import { AiServiceApiClient } from '../client/ai-service-api.client';
import {
  AiImpulseType,
  AiTaskType,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  GeneratedNoteResult,
  GenerateImagesRequest,
  GenerateImagesResponse,
  GenerateNoteRequest,
  GenerateTextRequest,
  GenerateTextResponse,
  ParseQuickAddRequest,
  QuickAddParsedResult,
  RemixImageRequest,
  RemixImageResponse,
} from '../types/ai.types';

export interface AiGenerateFlowOptions {
  apiClient: AiServiceApiClient;
  impulseBus: AiImpulseBus;
  bridge?: AiCombinatorBridge;
}

export interface AiFlowErrorEvent {
  taskType: AiTaskType;
  error: Error;
  correlationId?: string;
}

/**
 * Reactive AI Generation Flow.
 * Executes text, note, quick-add, image generation, image remix, and vision analysis tasks
 * against Umniy Lemon (`lemon-ai-service`), emits reactive impulses on `AiImpulseBus`,
 * and records Core Combinator Chronicle + Batch telemetry.
 */
export class AiGenerateFlow {
  private readonly apiClient: AiServiceApiClient;
  private readonly impulseBus: AiImpulseBus;
  private readonly bridge?: AiCombinatorBridge;
  private readonly errorsSubject = new Subject<AiFlowErrorEvent>();

  constructor(options: AiGenerateFlowOptions) {
    this.apiClient = options.apiClient;
    this.impulseBus = options.impulseBus;
    this.bridge = options.bridge;
  }

  get errors$(): Observable<AiFlowErrorEvent> {
    return this.errorsSubject.asObservable();
  }

  async generateText(input: GenerateTextRequest): Promise<GenerateTextResponse> {
    return this.executeTask({
      taskType: 'TEXT_GENERATE',
      channel: 'text',
      successImpulse: 'AI_TEXT_GENERATED',
      chronicleEvent: 'AI_TEXT_GENERATED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Prompt: ${input.prompt.slice(0, 64)}`,
      run: () => this.apiClient.generateText(input),
      extractMeta: (res) => ({
        requestId: res.requestId,
        summary: res.text.slice(0, 100),
      }),
    });
  }

  async generateNote(input: GenerateNoteRequest): Promise<GeneratedNoteResult> {
    return this.executeTask({
      taskType: 'NOTE_GENERATE',
      channel: 'text',
      successImpulse: 'AI_NOTE_GENERATED',
      chronicleEvent: 'AI_NOTE_GENERATED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Note: ${(input.topic || input.title || 'Untitled').slice(0, 64)}`,
      run: () => this.apiClient.generateNote(input),
      extractMeta: (res) => ({
        requestId: res.requestId,
        summary: res.title,
      }),
    });
  }

  async parseQuickAdd(input: ParseQuickAddRequest): Promise<QuickAddParsedResult> {
    return this.executeTask({
      taskType: 'QUICK_ADD_PARSE',
      channel: 'text',
      successImpulse: 'AI_QUICK_ADD_PARSED',
      chronicleEvent: 'AI_QUICK_ADD_PARSED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Quick-Add: ${input.rawText.slice(0, 64)}`,
      run: () => this.apiClient.parseQuickAdd(input),
      extractMeta: (res) => ({
        requestId: res.requestId,
        summary: res.title,
      }),
    });
  }

  async generateImages(input: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    const res = await this.executeTask({
      taskType: 'IMAGE_GENERATE',
      channel: 'images',
      successImpulse: 'AI_IMAGES_GENERATED',
      chronicleEvent: 'AI_IMAGES_GENERATED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Images (${input.count ?? 2}): ${input.prompt.slice(0, 64)}`,
      run: () => this.apiClient.generateImages(input),
      extractMeta: (r) => ({
        requestId: r.requestId,
        model: r.model,
        isFallback: r.isFallback,
        mediaAssetIds: r.items.map((i) => i.id),
        summary: `${r.items.length} image(s) via ${r.model}`,
      }),
    });

    if (this.bridge) {
      await this.bridge.pushBatchTelemetry(
        {
          requestId: res.requestId,
          model: res.model,
          count: res.items.length,
          folderPath: res.folderPath,
        },
        input.correlationId || res.requestId,
      );
    }

    return res;
  }

  async remixImage(input: RemixImageRequest): Promise<RemixImageResponse> {
    return this.executeTask({
      taskType: 'IMAGE_REMIX',
      channel: 'images',
      successImpulse: 'AI_IMAGE_REMIXED',
      chronicleEvent: 'AI_IMAGE_REMIXED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Remix ${input.sourceAssetId}: ${input.instruction.slice(0, 48)}`,
      run: () => this.apiClient.remixImage(input),
      extractMeta: (res) => ({
        requestId: res.requestId,
        model: res.model,
        isFallback: res.isFallback,
        mediaAssetIds: res.items.map((i) => i.id),
        summary: `${res.items.length} remix(es) via ${res.model}`,
      }),
    });
  }

  async analyzeImage(input: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
    return this.executeTask({
      taskType: 'VISION_ANALYZE',
      channel: 'images',
      successImpulse: 'AI_IMAGE_ANALYZED',
      chronicleEvent: 'AI_IMAGE_ANALYZED',
      correlationId: input.correlationId,
      combinatorFlowId: input.combinatorFlowId,
      summary: `Analyze asset ${input.sourceAssetId}`,
      run: () => this.apiClient.analyzeImage(input),
      extractMeta: (res) => ({
        requestId: res.requestId,
        mediaAssetIds: [res.sourceAssetId],
        summary: res.description.slice(0, 100),
      }),
    });
  }

  private async executeTask<T>(params: {
    taskType: AiTaskType;
    channel: 'text' | 'images';
    successImpulse: AiImpulseType;
    chronicleEvent: string;
    correlationId?: string;
    combinatorFlowId?: string;
    summary: string;
    run: () => Promise<T>;
    extractMeta: (res: T) => {
      requestId?: string;
      model?: string;
      isFallback?: boolean;
      mediaAssetIds?: string[];
      summary?: string;
    };
  }): Promise<T> {
    this.impulseBus.emit('AI_TASK_SUBMITTED', {
      taskType: params.taskType,
      correlationId: params.correlationId,
      summary: params.summary,
    });

    try {
      const result = await params.run();
      const meta = params.extractMeta(result);

      this.impulseBus.emit(params.successImpulse, {
        taskType: params.taskType,
        requestId: meta.requestId,
        correlationId: params.correlationId,
        model: meta.model,
        isFallback: meta.isFallback,
        mediaAssetIds: meta.mediaAssetIds,
        summary: meta.summary || params.summary,
      });

      if (this.bridge) {
        await this.bridge.emitChronicle(
          params.channel,
          params.chronicleEvent,
          {
            taskType: params.taskType,
            requestId: meta.requestId,
            correlationId: params.correlationId,
            model: meta.model,
            isFallback: meta.isFallback,
            mediaAssetIds: meta.mediaAssetIds,
          },
          params.combinatorFlowId,
        );
      }

      return result;
    } catch (rawErr: any) {
      const error = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
      this.errorsSubject.next({
        taskType: params.taskType,
        error,
        correlationId: params.correlationId,
      });

      this.impulseBus.emit('AI_TASK_FAILED', {
        taskType: params.taskType,
        correlationId: params.correlationId,
        error: error.message,
        summary: params.summary,
      });

      if (this.bridge) {
        await this.bridge.emitChronicle(
          params.channel,
          'FAILURE',
          {
            taskType: params.taskType,
            correlationId: params.correlationId,
            error: error.message,
          },
          params.combinatorFlowId,
        );
      }

      throw error;
    }
  }
}
