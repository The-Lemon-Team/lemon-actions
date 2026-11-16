import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import { MediaSseBus } from '../client/media-sse.bus';
import { MediaEventImpulse, MediaFolder } from '../types/media.types';

export interface MediaTopologyNeuronOptions {
  apiClient: MediaHubApiClient;
  sseBus: MediaSseBus;
}

/**
 * Reactive Media Topology Neuron ("Нейрон Каркаса Папок").
 * Direct analogy of TopologyNeuron:
 * 1. Fetches folder catalog from GET /api/folders.
 * 2. Reacts to FOLDER_CREATED, FOLDER_DELETED, MEDIA_ADDED, MEDIA_DELETED, MEDIA_UPDATED impulses.
 */
export class MediaTopologyNeuron {
  private readonly apiClient: MediaHubApiClient;
  private readonly sseBus: MediaSseBus;
  private readonly foldersSubject = new BehaviorSubject<MediaFolder[]>([]);
  private sub: Subscription | null = null;

  constructor(options: MediaTopologyNeuronOptions) {
    this.apiClient = options.apiClient;
    this.sseBus = options.sseBus;
  }

  get folders$(): Observable<MediaFolder[]> {
    return this.foldersSubject.asObservable();
  }

  get folders(): MediaFolder[] {
    return this.foldersSubject.getValue();
  }

  async initialize(): Promise<MediaFolder[]> {
    const folders = await this.refresh();
    if (this.sub) {
      this.sub.unsubscribe();
    }
    this.sub = this.sseBus.impulses$.subscribe((impulse) => {
      this.applyImpulse(impulse);
    });
    return folders;
  }

  disconnect(): void {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
  }

  async refresh(): Promise<MediaFolder[]> {
    const folders = await this.apiClient.listFolders();
    this.foldersSubject.next(folders);
    return folders;
  }

  findByPath(folderPath: string): MediaFolder | undefined {
    const clean = folderPath.trim().replace(/^\/|\/$/g, '').toLowerCase();
    return this.foldersSubject
      .getValue()
      .find((f) => f.path.toLowerCase() === clean);
  }

  private applyImpulse(impulse: MediaEventImpulse): void {
    const current = this.foldersSubject.getValue();
    if (impulse.type === 'FOLDER_CREATED' && impulse.folder) {
      if (current.some((f) => f.id === impulse.folder!.id)) return;
      this.foldersSubject.next([...current, impulse.folder]);
      return;
    }

    if (impulse.type === 'FOLDER_DELETED' && impulse.folderId) {
      this.foldersSubject.next(current.filter((f) => f.id !== impulse.folderId));
      return;
    }

    if (impulse.type === 'MEDIA_ADDED' && impulse.folderPath) {
      this.adjustCount(impulse.folderPath, +1);
      return;
    }

    if (impulse.type === 'MEDIA_DELETED' && impulse.folderPath) {
      this.adjustCount(impulse.folderPath, -1);
      return;
    }

    if (impulse.type === 'MEDIA_UPDATED' && impulse.payload?.previousFolderPath && impulse.folderPath) {
      const prev = String(impulse.payload.previousFolderPath);
      if (prev.toLowerCase() !== impulse.folderPath.toLowerCase()) {
        this.adjustCount(prev, -1);
        this.adjustCount(impulse.folderPath, +1);
      }
    }
  }

  private adjustCount(folderPath: string, delta: number): void {
    const target = folderPath.trim().replace(/^\/|\/$/g, '').toLowerCase();
    const current = this.foldersSubject.getValue();
    let changed = false;
    const next = current.map((folder) => {
      if (folder.path.toLowerCase() === target && typeof folder.assetsCount === 'number') {
        changed = true;
        return {
          ...folder,
          assetsCount: Math.max(0, folder.assetsCount + delta),
        };
      }
      return folder;
    });
    if (changed) {
      this.foldersSubject.next(next);
    }
  }
}
