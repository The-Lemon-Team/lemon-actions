import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { Observable } from 'rxjs';
import { MediaCombinatorBridge } from '../bridge/media-combinator.bridge';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import { MediaDeleteFlow } from '../flows/media-delete.flow';
import { MediaIngestFlow } from '../flows/media-ingest.flow';
import { MediaViewFlow } from '../flows/media-view.flow';
import { FolderNeuron } from '../neurons/folder.neuron';
import { MediaAssetNeuron } from '../neurons/media-asset.neuron';
import { MediaLibraryNeuron } from '../neurons/media-library.neuron';
import { MediaTopologyNeuron } from '../neurons/media-topology.neuron';
import {
  MediaAsset,
  MediaAssetNeuronState,
  MediaDeleteRequest,
  MediaDeleteResult,
  MediaIngestRequest,
  MediaIngestResult,
  MediaKind,
  MediaViewRequest,
  MediaViewResolved,
  QueryAssetsOptions,
} from '../types/media.types';

export interface MediaLifecycleAxonOptions {
  baseUrl?: string;
  token?: string;
  apiKey?: string;
  combinator?: CoreCombinatorClient;
  profileId?: string;
  basePath?: string;
  folderPath?: string;
  kind?: MediaKind;
  pageSize?: number;
  ingestConcurrency?: number;
  usageBatchWindowMs?: number;
  autoConnectSse?: boolean;
}

/**
 * Unified Reactive Axon for Lemon Media Hub.
 * Analogous to CodingMemoryAxon / DailyTimelineAxon in @lemon/seasons-neurons:
 * wires transport (API + SSE Bus), mirror neurons (Topology + Library + Folder + Asset),
 * Core Combinator composite flows, and the 3 dedicated action streams:
 *  - Add media (`ingestFlow` / `addMedia`)
 *  - Delete media (`deleteFlow` / `deleteMedia`)
 *  - View & play media (`viewFlow` / `viewMedia` / `watchMedia$`)
 */
export class MediaLifecycleAxon {
  public readonly apiClient: MediaHubApiClient;
  public readonly sseBus: MediaSseBus;
  public readonly bridge: MediaCombinatorBridge;
  public readonly topology: MediaTopologyNeuron;
  public readonly library: MediaLibraryNeuron;
  public readonly ingestFlow: MediaIngestFlow;
  public readonly deleteFlow: MediaDeleteFlow;
  public readonly viewFlow: MediaViewFlow;

  private readonly autoConnectSse: boolean;

  constructor(options: MediaLifecycleAxonOptions = {}) {
    this.apiClient = new MediaHubApiClient({
      baseUrl: options.baseUrl,
      token: options.token,
      apiKey: options.apiKey,
    });
    this.sseBus = new MediaSseBus({
      apiClient: this.apiClient,
      folderPath: options.folderPath,
      kind: options.kind,
    });
    this.bridge = new MediaCombinatorBridge({
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      combinator: options.combinator,
      profileId: options.profileId,
      basePath: options.basePath,
    });
    this.topology = new MediaTopologyNeuron({
      apiClient: this.apiClient,
      sseBus: this.sseBus,
    });
    this.library = new MediaLibraryNeuron({
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      pageSize: options.pageSize,
      baseQuery: {
        folderPath: options.folderPath,
        kind: options.kind,
      },
    });
    this.ingestFlow = new MediaIngestFlow({
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      bridge: this.bridge,
      concurrency: options.ingestConcurrency,
    });
    this.deleteFlow = new MediaDeleteFlow({
      apiClient: this.apiClient,
      bridge: this.bridge,
    });
    this.viewFlow = new MediaViewFlow({
      apiClient: this.apiClient,
      sseBus: this.sseBus,
      bridge: this.bridge,
      usageBatchWindowMs: options.usageBatchWindowMs,
    });
    this.autoConnectSse = options.autoConnectSse ?? true;
  }

  async start(options?: { ensureCombinatorTopology?: boolean; loadInitial?: boolean }): Promise<void> {
    if (options?.ensureCombinatorTopology !== false && this.bridge.combinator) {
      await this.bridge.ensureMediaTopology().catch(() => {});
    }
    if (this.autoConnectSse) {
      this.sseBus.connect();
    }
    const loadInitial = options?.loadInitial ?? true;
    await Promise.all([
      loadInitial ? this.topology.initialize() : Promise.resolve([]),
      this.library.connect(loadInitial),
    ]);
  }

  stop(): void {
    this.ingestFlow.destroy();
    this.deleteFlow.destroy();
    this.viewFlow.destroy();
    this.library.disconnect();
    this.topology.disconnect();
    this.sseBus.disconnect();
  }

  addMedia(request: MediaIngestRequest): Promise<MediaIngestResult> {
    return this.ingestFlow.ingest(request);
  }

  deleteMedia(input: string | MediaDeleteRequest): Promise<MediaDeleteResult> {
    return this.deleteFlow.remove(input);
  }

  viewMedia(request: string | MediaViewRequest): Promise<MediaViewResolved> {
    const req: MediaViewRequest =
      typeof request === 'string' ? { assetId: request } : request;
    return this.viewFlow.resolveView(req);
  }

  watchMedia$(
    assetId: string,
    defaultVariant?: string,
  ): Observable<MediaAssetNeuronState<MediaAsset>> {
    return this.viewFlow.watchAsset$(assetId, defaultVariant);
  }

  openFolder(
    folderPath: string,
    filters?: Omit<QueryAssetsOptions, 'folderPath' | 'limit' | 'offset'>,
  ): FolderNeuron<MediaAsset> {
    return this.library.getOrCreateFolderNeuron(folderPath, filters);
  }

  openAsset(assetId: string, defaultVariant?: string): MediaAssetNeuron<MediaAsset> {
    return this.library.getOrCreateAssetNeuron(assetId, defaultVariant);
  }
}
