import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import {
  AssetLineage,
  MediaAsset,
  MediaCompositeNeurons,
  MediaFolder,
  MediaKind,
  MediaLifecycleAxon,
  MediaServiceClient,
  MediaSsePacket,
  MediaVisibility,
  ProcessingStatus,
  QueryAssetsOptions,
} from '@lemon/media-hub-neurons';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { Readable } from 'stream';
import {
  CreateMediaClientDto,
  CreateMediaFolderDto,
  UpdateMediaAccessDto,
  UpdateMediaMetadataDto,
} from './media.dto';

export interface UploadedBinaryFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface MediaCombinatorNeuronSummary {
  channel: keyof MediaCompositeNeurons;
  neuronId: string;
  path: string;
  flowIds: string[];
}

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  public readonly baseUrl: string;
  private readonly combinatorClient: CoreCombinatorClient;
  private readonly axon: MediaLifecycleAxon;
  private readonly adminUsername: string;
  private readonly adminPassword: string;

  private authenticated = false;
  private neuronsSynced = false;
  private initTimer: NodeJS.Timeout | null = null;
  private authInFlight: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = (process.env.LEMON_MEDIA_HUB_URL || 'http://127.0.0.1:3005').replace(
      /\/+$/,
      '',
    );
    const token = process.env.LEMON_MEDIA_HUB_TOKEN?.trim() || undefined;
    const apiKey = process.env.LEMON_MEDIA_HUB_API_KEY?.trim() || undefined;
    this.adminUsername = process.env.LEMON_MEDIA_HUB_ADMIN_USERNAME?.trim() || 'admin';
    this.adminPassword =
      process.env.LEMON_MEDIA_HUB_ADMIN_PASSWORD?.trim() || 'lemon_admin_change_me';

    const combinatorUrl = (
      process.env.LEMON_CORE_COMBINATOR_URL ||
      `http://127.0.0.1:${process.env.PORT ?? 3000}/api`
    ).replace(/\/+$/, '');

    this.combinatorClient = new CoreCombinatorClient({ baseUrl: combinatorUrl });
    this.axon = new MediaLifecycleAxon({
      baseUrl: this.baseUrl,
      token,
      apiKey,
      combinator: this.combinatorClient,
      basePath: '/media-hub',
      autoConnectSse: false,
    });

    this.authenticated = Boolean(token || apiKey);
  }

  onModuleInit(): void {
    // Defer bootstrap network calls until HTTP listener is ready
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

  events$(): Observable<MediaSsePacket> {
    return this.axon.sseBus.packets$;
  }

  async getStatus(): Promise<{
    baseUrl: string;
    connected: boolean;
    authenticated: boolean;
    sseConnected: boolean;
    neuronsSynced: boolean;
    combinatorNeurons: MediaCombinatorNeuronSummary[];
    error?: string;
  }> {
    let connected = false;
    let error: string | undefined;

    try {
      await this.axon.apiClient.health();
      connected = true;
      if (!this.authenticated) {
        await this.ensureAuthenticated();
      }
      if (this.authenticated && !this.axon.sseBus.isConnected) {
        this.axon.sseBus.connect();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      baseUrl: this.baseUrl,
      connected,
      authenticated: this.authenticated,
      sseConnected: this.axon.sseBus.isConnected,
      neuronsSynced: this.neuronsSynced,
      combinatorNeurons: this.summarizeNeurons(this.axon.bridge.registeredNeurons),
      error,
    };
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ authenticated: boolean; admin: { username: string; role: string } }> {
    try {
      const res = await this.axon.apiClient.loginAdmin(username, password);
      this.authenticated = true;
      this.axon.sseBus.connect();
      return { authenticated: true, admin: res.admin };
    } catch (err) {
      this.authenticated = false;
      throw new UnauthorizedException(
        err instanceof Error ? err.message : 'Invalid Media Hub credentials',
      );
    }
  }

  async ensureCombinatorNeurons(): Promise<{
    synced: boolean;
    neurons: MediaCombinatorNeuronSummary[];
  }> {
    try {
      const registered = await this.axon.bridge.ensureMediaTopology();
      this.neuronsSynced = true;
      return {
        synced: true,
        neurons: this.summarizeNeurons(registered),
      };
    } catch (err) {
      this.logger.warn(
        `Failed to sync Media Hub neurons with Core Combinator: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        synced: false,
        neurons: this.summarizeNeurons(this.axon.bridge.registeredNeurons),
      };
    }
  }

  async listFolders(): Promise<MediaFolder[]> {
    return this.withAutoAuth(() => this.axon.apiClient.listFolders());
  }

  async createFolder(dto: CreateMediaFolderDto): Promise<MediaFolder> {
    return this.withAutoAuth(() => this.axon.apiClient.createFolder(dto));
  }

  async deleteFolder(id: string): Promise<{ success: boolean }> {
    return this.withAutoAuth(() => this.axon.apiClient.deleteFolder(id));
  }

  async listAssets(query: QueryAssetsOptions): Promise<{ items: MediaAsset[]; total: number }> {
    return this.withAutoAuth(() => this.axon.apiClient.listAssets(query));
  }

  async getAsset(id: string): Promise<MediaAsset> {
    return this.withAutoAuth(() => this.axon.apiClient.getAsset(id));
  }

  async getAssetLineage(id: string): Promise<AssetLineage> {
    return this.withAutoAuth(() => this.axon.apiClient.getAssetLineage(id));
  }

  async uploadAsset(
    file: UploadedBinaryFile,
    body: {
      folderPath?: string;
      tags?: string[];
      title?: string;
      description?: string;
      visibility?: MediaVisibility;
      allowedClients?: string[];
      waitForReady?: boolean;
      dedupKey?: string;
    },
  ) {
    if (!this.neuronsSynced) {
      await this.ensureCombinatorNeurons();
    }
    return this.withAutoAuth(() =>
      this.axon.addMedia({
        file: new Uint8Array(file.buffer),
        filename: file.originalname,
        mimeType: file.mimetype,
        folderPath: body.folderPath,
        tags: body.tags,
        title: body.title,
        description: body.description,
        visibility: body.visibility,
        allowedClients: body.allowedClients,
        waitForReady: body.waitForReady,
        dedupKey: body.dedupKey,
      }),
    );
  }

  async updateMetadata(id: string, dto: UpdateMediaMetadataDto): Promise<MediaAsset> {
    return this.withAutoAuth(() => this.axon.apiClient.updateMetadata(id, dto));
  }

  async updateAccess(id: string, dto: UpdateMediaAccessDto): Promise<MediaAsset> {
    return this.withAutoAuth(() => this.axon.apiClient.updateAccess(id, dto));
  }

  async toggleFavorite(id: string): Promise<MediaAsset> {
    return this.withAutoAuth(() => this.axon.apiClient.toggleFavorite(id));
  }

  async reprocessAsset(id: string): Promise<MediaAsset> {
    return this.withAutoAuth(() => this.axon.apiClient.reprocess(id));
  }

  async trackView(id: string, variant?: string) {
    if (!this.neuronsSynced) {
      await this.ensureCombinatorNeurons();
    }
    return this.withAutoAuth(() =>
      this.axon.viewMedia({
        assetId: id,
        variant,
        trackUsage: true,
        viewerContext: 'media-admin',
      }),
    );
  }

  async deleteAsset(id: string, reason?: string) {
    if (!this.neuronsSynced) {
      await this.ensureCombinatorNeurons();
    }
    return this.withAutoAuth(() =>
      this.axon.deleteMedia({
        assetId: id,
        reason: reason || 'admin-moderation',
      }),
    );
  }

  async listClients(): Promise<MediaServiceClient[]> {
    return this.withAutoAuth(() => this.axon.apiClient.listClients());
  }

  async createClient(dto: CreateMediaClientDto): Promise<MediaServiceClient> {
    return this.withAutoAuth(() => this.axon.apiClient.createClient(dto));
  }

  async rotateClientKey(id: string): Promise<MediaServiceClient> {
    return this.withAutoAuth(() => this.axon.apiClient.rotateClientKey(id));
  }

  async streamAssetFile(
    id: string,
    variant: string | undefined,
    rangeHeader: string | undefined,
    res: Response,
  ): Promise<void> {
    await this.ensureAuthenticated();
    let upstream = await this.axon.apiClient.fetchAssetStream(id, variant, rangeHeader);

    if (upstream.status === 401) {
      const reauthed = await this.ensureAuthenticated(true);
      if (reauthed) {
        upstream = await this.axon.apiClient.fetchAssetStream(id, variant, rangeHeader);
      }
    }

    if (upstream.status === 404) {
      throw new NotFoundException(`Media file '${id}' not found`);
    }
    if (!upstream.ok && upstream.status !== 206) {
      throw new BadGatewayException(`Media Hub file stream failed with HTTP ${upstream.status}`);
    }

    res.status(upstream.status);
    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ];
    for (const name of forwardHeaders) {
      const val = upstream.headers.get(name);
      if (val) {
        res.setHeader(name, val);
      }
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(upstream.body as any);
    nodeStream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
    nodeStream.pipe(res);
  }

  private async bootstrapConnections(): Promise<void> {
    await this.ensureCombinatorNeurons();
    const ok = await this.ensureAuthenticated();
    if (ok) {
      this.axon.sseBus.connect();
    }
  }

  private async ensureAuthenticated(force = false): Promise<boolean> {
    if (this.authenticated && !force) return true;
    if (this.authInFlight) return this.authInFlight;

    this.authInFlight = (async () => {
      try {
        await this.axon.apiClient.loginAdmin(this.adminUsername, this.adminPassword);
        this.authenticated = true;
        return true;
      } catch (err) {
        this.authenticated = false;
        this.logger.warn(
          `Media Hub auto-login skipped (${this.baseUrl}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return false;
      } finally {
        this.authInFlight = null;
      }
    })();

    return this.authInFlight;
  }

  private async withAutoAuth<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.authenticated) {
      await this.ensureAuthenticated();
    }

    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP 401')) {
        const reauthed = await this.ensureAuthenticated(true);
        if (reauthed) {
          return await fn();
        }
      }
      if (msg.includes('HTTP 404')) {
        throw new NotFoundException(msg);
      }
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
        throw new UnauthorizedException(msg);
      }
      throw new BadGatewayException(msg);
    }
  }

  private summarizeNeurons(
    neurons: MediaCompositeNeurons,
  ): MediaCombinatorNeuronSummary[] {
    const entries = Object.entries(neurons) as Array<
      [keyof MediaCompositeNeurons, MediaCompositeNeurons[keyof MediaCompositeNeurons]]
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
