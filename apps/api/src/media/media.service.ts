import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { ProjectBusClient } from '@lemon/stack-bus';
import {
  AssetLineage,
  MediaAsset,
  MediaCompositeNeurons,
  MediaEventImpulse,
  MediaFolder,
  MediaImpulseType,
  MediaKind,
  MediaLifecycleAxon,
  MediaServiceClient,
  MediaSsePacket,
  MediaVisibility,
  ProcessingStatus,
  QueryAssetsOptions,
} from '@lemon/media-hub-neurons';
import { Response } from 'express';
import { EMPTY, Observable, map } from 'rxjs';
import { Readable } from 'stream';
import { StackBusService } from '../bus/stack-bus.service';
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
  private readonly mediaBus?: ProjectBusClient;

  constructor(@Optional() private readonly stackBus?: StackBusService) {
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
    this.mediaBus = this.stackBus?.forProject('media-hub', 'lemon-media-hub');
  }

  onModuleInit(): void {
    // Defer bootstrap network calls until HTTP listener is ready.
    // Inter-service SSE to media-hub is intentionally disabled per inter-service-bus rule:
    // media-hub lifecycle events arrive via StackBus (NATS JetStream lemon.media-hub.>).
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
    if (!this.stackBus) {
      return EMPTY;
    }
    const eventToImpulse: Record<string, MediaImpulseType | undefined> = {
      created: 'MEDIA_ADDED',
      processing: 'MEDIA_PROCESSING',
      ready: 'MEDIA_READY',
      failed: 'MEDIA_FAILED',
      updated: 'MEDIA_UPDATED',
      access_changed: 'MEDIA_ACCESS_CHANGED',
      favorited: 'MEDIA_FAVORITED',
      viewed: 'MEDIA_VIEWED',
      deleted: 'MEDIA_DELETED',
    };

    return this.stackBus
      .subscribe$({ projectSlug: 'media-hub', topicPattern: 'lemon.media-hub.media.>' })
      .pipe(
        map((env) => {
          const payload = (env.payload ?? {}) as Record<string, unknown>;
          const type: MediaImpulseType = eventToImpulse[env.event] ?? 'MEDIA_UPDATED';
          const impulse: MediaEventImpulse = {
            id: env.eventId,
            type,
            timestamp: env.timestamp,
            assetId: typeof payload.assetId === 'string' ? payload.assetId : undefined,
            folderId: typeof payload.folderId === 'string' ? payload.folderId : undefined,
            folderPath: typeof payload.folderPath === 'string' ? payload.folderPath : undefined,
            kind: typeof payload.kind === 'string' ? (payload.kind as MediaKind) : undefined,
            visibility:
              typeof payload.visibility === 'string'
                ? (payload.visibility as MediaVisibility)
                : undefined,
            processingStatus:
              typeof payload.processingStatus === 'string'
                ? (payload.processingStatus as ProcessingStatus)
                : undefined,
            asset:
              payload.asset && typeof payload.asset === 'object'
                ? (payload.asset as MediaAsset)
                : undefined,
            payload,
          };
          return {
            type,
            impulse,
            receivedAt: Date.now(),
          } satisfies MediaSsePacket;
        }),
      );
  }

  async getStatus(): Promise<{
    baseUrl: string;
    connected: boolean;
    authenticated: boolean;
    sseConnected: boolean;
    busConnected: boolean;
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
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const busStatus = await this.stackBus?.getStatus().catch(() => null);
    const busConnected = busStatus?.connected ?? false;

    return {
      baseUrl: this.baseUrl,
      connected,
      authenticated: this.authenticated,
      sseConnected: busConnected,
      busConnected,
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
    const result = await this.withAutoAuth(() =>
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

    if (result?.asset) {
      await this.publishMediaLifecycleEvent('created', {
        assetId: result.asset.id,
        kind: result.asset.kind,
        folderPath: result.asset.folderPath,
        filename: result.asset.filename,
        visibility: result.asset.visibility,
      });
    }
    return result;
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
    const result = await this.withAutoAuth(() =>
      this.axon.deleteMedia({
        assetId: id,
        reason: reason || 'admin-moderation',
      }),
    );
    await this.publishMediaLifecycleEvent('deleted', {
      assetId: id,
      reason: reason || 'admin-moderation',
    });
    return result;
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
    await this.ensureAuthenticated();
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

  private async publishMediaLifecycleEvent(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.mediaBus) return;
    const assetId = typeof payload.assetId === 'string' ? payload.assetId : 'unknown';
    const kind = typeof payload.kind === 'string' ? payload.kind.toLowerCase() : undefined;
    try {
      await this.mediaBus.publish('media', event, payload, {
        dedupKey: `media:${event}:${assetId}`,
        tags: ['media-hub', 'media', event, ...(kind ? [kind] : [])],
      });
    } catch (err) {
      this.logger.debug(
        `Failed to publish media.${event} to StackBus: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
