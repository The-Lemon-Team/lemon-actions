import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { AiCombinatorBridge } from '../bridge/ai-combinator.bridge';
import { AiImpulseBus } from '../client/ai-impulse.bus';
import { AiServiceApiClient } from '../client/ai-service-api.client';
import { AiGenerateFlow } from '../flows/ai-generate.flow';
import { AiHistoryNeuron } from '../neurons/ai-history.neuron';
import {
  AiClientApp,
  AiHistoryQuery,
  AiStatusResponse,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  CreatedAiClientResponse,
  CreateAiClientInput,
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

export interface AiStudioAxonOptions {
  baseUrl?: string;
  apiKey?: string;
  combinator?: CoreCombinatorClient;
  profileId?: string;
  basePath?: string;
  historyPageSize?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Unified Reactive Axon for Umniy Lemon (`lemon-ai-service`).
 * Wires HTTP transport (`AiServiceApiClient`), reactive impulse bus (`AiImpulseBus`),
 * Core Combinator composite neurons (`AiCombinatorBridge`), history mirror (`AiHistoryNeuron`),
 * and generation flows (`AiGenerateFlow`).
 */
export class AiStudioAxon {
  public readonly apiClient: AiServiceApiClient;
  public readonly impulseBus: AiImpulseBus;
  public readonly bridge: AiCombinatorBridge;
  public readonly history: AiHistoryNeuron;
  public readonly generateFlow: AiGenerateFlow;

  constructor(options: AiStudioAxonOptions = {}) {
    this.apiClient = new AiServiceApiClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
    });
    this.impulseBus = new AiImpulseBus();
    this.bridge = new AiCombinatorBridge({
      apiClient: this.apiClient,
      impulseBus: this.impulseBus,
      combinator: options.combinator,
      profileId: options.profileId,
      basePath: options.basePath,
    });
    this.history = new AiHistoryNeuron({
      apiClient: this.apiClient,
      impulseBus: this.impulseBus,
      pageSize: options.historyPageSize,
    });
    this.generateFlow = new AiGenerateFlow({
      apiClient: this.apiClient,
      impulseBus: this.impulseBus,
      bridge: this.bridge,
    });
  }

  async start(options?: { ensureCombinatorTopology?: boolean; loadHistory?: boolean }): Promise<void> {
    if (options?.ensureCombinatorTopology !== false && this.bridge.combinator) {
      await this.bridge.ensureAiTopology().catch(() => {});
    }
    await this.history.connect(options?.loadHistory ?? false);
  }

  stop(): void {
    this.history.disconnect();
  }

  status(): Promise<AiStatusResponse> {
    return this.apiClient.status();
  }

  generateText(input: GenerateTextRequest): Promise<GenerateTextResponse> {
    return this.generateFlow.generateText(input);
  }

  generateNote(input: GenerateNoteRequest): Promise<GeneratedNoteResult> {
    return this.generateFlow.generateNote(input);
  }

  parseQuickAdd(input: ParseQuickAddRequest): Promise<QuickAddParsedResult> {
    return this.generateFlow.parseQuickAdd(input);
  }

  generateImages(input: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    return this.generateFlow.generateImages(input);
  }

  remixImage(input: RemixImageRequest): Promise<RemixImageResponse> {
    return this.generateFlow.remixImage(input);
  }

  analyzeImage(input: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
    return this.generateFlow.analyzeImage(input);
  }

  queryHistory(query?: AiHistoryQuery) {
    return this.apiClient.getHistory(query);
  }

  getStats() {
    return this.apiClient.getHistoryStats();
  }

  listClients(): Promise<AiClientApp[]> {
    return this.apiClient.listClients();
  }

  async createClient(input: CreateAiClientInput): Promise<CreatedAiClientResponse> {
    const client = await this.apiClient.createClient(input);
    this.impulseBus.emit('AI_CLIENT_CREATED', {
      summary: `Client ${client.slug} created`,
      payload: { slug: client.slug, name: client.name },
    });
    await this.bridge.emitChronicle('studio', 'AI_CLIENT_CREATED', {
      slug: client.slug,
      name: client.name,
    });
    return client;
  }
}
