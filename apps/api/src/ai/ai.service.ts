import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AiClientApp,
  AiCompositeNeurons,
  AiHistoryPage,
  AiHistoryQuery,
  AiRequestLog,
  AiSsePacket,
  AiStudioAxon,
  AiUsageStats,
  AnalyzeImageResponse,
  CreatedAiClientResponse,
  GeneratedNoteResult,
  GenerateImagesResponse,
  GenerateTextResponse,
  QuickAddParsedResult,
  RemixImageResponse,
} from '@lemon/ai-neurons';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { Observable } from 'rxjs';
import {
  AnalyzeImageDto,
  CreateAiClientDto,
  GenerateImagesDto,
  GenerateNoteDto,
  GenerateTextDto,
  ParseQuickAddDto,
  RemixImageDto,
} from './ai.dto';

export interface AiCombinatorNeuronSummary {
  channel: keyof AiCompositeNeurons;
  neuronId: string;
  path: string;
  flowIds: string[];
}

export interface AiServiceStatusResponse {
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
  combinatorNeurons: AiCombinatorNeuronSummary[];
  error?: string;
}

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  public readonly baseUrl: string;
  private readonly combinatorClient: CoreCombinatorClient;
  private readonly axon: AiStudioAxon;

  private neuronsSynced = false;
  private initTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.baseUrl = (process.env.LEMON_AI_SERVICE_URL || 'http://127.0.0.1:3006').replace(
      /\/+$/,
      '',
    );
    const apiKey =
      process.env.LEMON_AI_API_KEY?.trim() ||
      process.env.AI_ADMIN_API_KEY?.trim() ||
      'lai_admin_dev_key_change_me';

    const combinatorUrl = (
      process.env.LEMON_CORE_COMBINATOR_URL ||
      `http://127.0.0.1:${process.env.PORT ?? 3000}/api`
    ).replace(/\/+$/, '');

    this.combinatorClient = new CoreCombinatorClient({ baseUrl: combinatorUrl });
    this.axon = new AiStudioAxon({
      baseUrl: this.baseUrl,
      apiKey,
      combinator: this.combinatorClient,
      basePath: '/ai-neurons',
    });
  }

  onModuleInit(): void {
    this.initTimer = setTimeout(() => {
      void this.bootstrapConnections();
    }, 1500);
    this.initTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    this.axon.stop();
  }

  events$(): Observable<AiSsePacket> {
    return this.axon.impulseBus.packets$;
  }

  async getStatus(): Promise<AiServiceStatusResponse> {
    let connected = false;
    let authenticated = false;
    let configured = false;
    let geminiConfigured = false;
    let imageEngine = 'flux';
    let textModels: string[] = [];
    let imageModels: string[] = [];
    let error: string | undefined;

    try {
      const status = await this.axon.status();
      connected = true;
      configured = status.configured;
      geminiConfigured = status.geminiConfigured;
      imageEngine = status.imageEngine || 'flux';
      textModels = status.textModels || [];
      imageModels = status.imageModels || [];

      try {
        await this.axon.getStats();
        authenticated = true;
      } catch (authErr) {
        const msg = authErr instanceof Error ? authErr.message : String(authErr);
        if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
          authenticated = false;
          error = 'API Key rejected by Umniy Lemon';
        } else {
          authenticated = this.axon.apiClient.hasApiKey();
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      baseUrl: this.baseUrl,
      connected,
      authenticated,
      hasApiKey: this.axon.apiClient.hasApiKey(),
      configured,
      geminiConfigured,
      imageEngine,
      textModels,
      imageModels,
      neuronsSynced: this.neuronsSynced,
      combinatorNeurons: this.summarizeNeurons(this.axon.bridge.registeredNeurons),
      error,
    };
  }

  async setApiKey(apiKey: string): Promise<{ authenticated: boolean; hasApiKey: boolean }> {
    this.axon.apiClient.setApiKey(apiKey);
    try {
      await this.axon.getStats();
      return { authenticated: true, hasApiKey: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
        throw new UnauthorizedException('Umniy Lemon rejected the provided X-Ai-Api-Key');
      }
      throw new BadGatewayException(msg);
    }
  }

  async ensureCombinatorNeurons(): Promise<{
    synced: boolean;
    neurons: AiCombinatorNeuronSummary[];
  }> {
    try {
      const registered = await this.axon.bridge.ensureAiTopology();
      this.neuronsSynced = true;
      return {
        synced: true,
        neurons: this.summarizeNeurons(registered),
      };
    } catch (err) {
      this.logger.warn(
        `Failed to sync AI neurons with Core Combinator: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        synced: false,
        neurons: this.summarizeNeurons(this.axon.bridge.registeredNeurons),
      };
    }
  }

  async getHistory(query: AiHistoryQuery): Promise<AiHistoryPage> {
    return this.executeUpstream(() => this.axon.queryHistory(query));
  }

  async getHistoryStats(): Promise<AiUsageStats> {
    return this.executeUpstream(() => this.axon.getStats());
  }

  async getHistoryById(id: string): Promise<AiRequestLog> {
    return this.executeUpstream(() => this.axon.apiClient.getHistoryById(id));
  }

  async generateText(dto: GenerateTextDto): Promise<GenerateTextResponse> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.generateText(dto));
  }

  async generateNote(dto: GenerateNoteDto): Promise<GeneratedNoteResult> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.generateNote(dto));
  }

  async parseQuickAdd(dto: ParseQuickAddDto): Promise<QuickAddParsedResult> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.parseQuickAdd(dto));
  }

  async generateImages(dto: GenerateImagesDto): Promise<GenerateImagesResponse> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.generateImages(dto));
  }

  async remixImage(dto: RemixImageDto): Promise<RemixImageResponse> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.remixImage(dto));
  }

  async analyzeImage(dto: AnalyzeImageDto): Promise<AnalyzeImageResponse> {
    await this.ensureNeuronsReady();
    return this.executeUpstream(() => this.axon.analyzeImage(dto));
  }

  async listClients(): Promise<AiClientApp[]> {
    return this.executeUpstream(() => this.axon.listClients());
  }

  async createClient(dto: CreateAiClientDto): Promise<CreatedAiClientResponse> {
    return this.executeUpstream(() => this.axon.createClient(dto));
  }

  private async bootstrapConnections(): Promise<void> {
    await this.ensureCombinatorNeurons();
  }

  private async ensureNeuronsReady(): Promise<void> {
    if (!this.neuronsSynced) {
      await this.ensureCombinatorNeurons();
    }
  }

  private async executeUpstream<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP 404')) {
        throw new NotFoundException(msg);
      }
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
        throw new UnauthorizedException(msg);
      }
      throw new BadGatewayException(msg);
    }
  }

  private summarizeNeurons(neurons: AiCompositeNeurons): AiCombinatorNeuronSummary[] {
    const entries = Object.entries(neurons) as Array<
      [keyof AiCompositeNeurons, AiCompositeNeurons[keyof AiCompositeNeurons]]
    >;
    return entries
      .filter(([, instance]) => Boolean(instance))
      .map(([channel, instance]) => ({
        channel,
        neuronId: instance!.neuron.id,
        path: instance!.neuron.path || `/${channel}`,
        flowIds: Object.values(instance!.flows)
          .filter((f): f is NonNullable<typeof f> => Boolean(f))
          .map((f) => f.id),
      }));
  }
}
