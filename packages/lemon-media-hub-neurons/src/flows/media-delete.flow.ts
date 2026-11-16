import { Observable, Subject, Subscription } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { MediaCombinatorBridge } from '../bridge/media-combinator.bridge';
import { MediaHubApiClient } from '../client/media-hub-api.client';
import {
  MediaDeleteRequest,
  MediaDeleteResult,
} from '../types/media.types';

export interface MediaDeleteFlowOptions {
  apiClient: MediaHubApiClient;
  bridge?: MediaCombinatorBridge;
}

export interface MediaDeleteError {
  request: MediaDeleteRequest;
  error: Error;
}

/**
 * Поток удаления медиа (Media Deletion Reactive Flow).
 *
 * Serializes deletion requests through a mutex-like RxJS pipeline (with optional
 * Core Combinator lease/chronicle integration), deletes the asset from Lemon Media Hub
 * (which cleans local disk files + triggers MEDIA_DELETED SSE impulse), and notifies observers.
 */
export class MediaDeleteFlow {
  private readonly apiClient: MediaHubApiClient;
  private readonly bridge?: MediaCombinatorBridge;

  private readonly queueSubject = new Subject<{
    request: MediaDeleteRequest;
    resolve?: (res: MediaDeleteResult) => void;
    reject?: (err: Error) => void;
  }>();
  private readonly deletingSubject = new Subject<MediaDeleteRequest>();
  private readonly deletedSubject = new Subject<MediaDeleteResult>();
  private readonly errorsSubject = new Subject<MediaDeleteError>();

  private readonly sourceSubs: Subscription[] = [];
  private workerSub: Subscription | null = null;

  constructor(options: MediaDeleteFlowOptions) {
    this.apiClient = options.apiClient;
    this.bridge = options.bridge;
    this.startWorker();
  }

  get deleting$(): Observable<MediaDeleteRequest> {
    return this.deletingSubject.asObservable();
  }

  get deleted$(): Observable<MediaDeleteResult> {
    return this.deletedSubject.asObservable();
  }

  get errors$(): Observable<MediaDeleteError> {
    return this.errorsSubject.asObservable();
  }

  connectSource(source$: Observable<MediaDeleteRequest>): Subscription {
    const sub = source$.subscribe({
      next: (req) => {
        void this.remove(req).catch(() => {});
      },
    });
    this.sourceSubs.push(sub);
    return sub;
  }

  remove(input: string | MediaDeleteRequest): Promise<MediaDeleteResult> {
    const request: MediaDeleteRequest =
      typeof input === 'string' ? { assetId: input } : input;

    return new Promise<MediaDeleteResult>((resolve, reject) => {
      this.queueSubject.next({ request, resolve, reject });
    });
  }

  async removeMany(
    assetIds: string[],
    reason?: string,
  ): Promise<MediaDeleteResult[]> {
    const results: MediaDeleteResult[] = [];
    for (const assetId of assetIds) {
      results.push(await this.remove({ assetId, reason }));
    }
    return results;
  }

  destroy(): void {
    for (const sub of this.sourceSubs) sub.unsubscribe();
    this.sourceSubs.length = 0;
    if (this.workerSub) {
      this.workerSub.unsubscribe();
      this.workerSub = null;
    }
  }

  private startWorker(): void {
    if (this.workerSub) return;

    this.workerSub = this.queueSubject
      .pipe(
        concatMap(async (entry) => {
          const { request } = entry;
          this.deletingSubject.next(request);
          try {
            const res = await this.apiClient.deleteAsset(request.assetId);
            const result: MediaDeleteResult = {
              assetId: request.assetId,
              success: Boolean(res.success),
              deletedAt: new Date().toISOString(),
              reason: request.reason,
            };
            this.deletedSubject.next(result);

            if (this.bridge) {
              await this.bridge.emitChronicle(
                'delete',
                'MEDIA_DELETED',
                {
                  assetId: request.assetId,
                  reason: request.reason,
                },
                request.combinatorFlowId,
              );
            }

            entry.resolve?.(result);
          } catch (rawErr: any) {
            const error = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
            this.errorsSubject.next({ request, error });
            if (this.bridge) {
              await this.bridge.emitChronicle(
                'delete',
                'FAILURE',
                {
                  assetId: request.assetId,
                  reason: request.reason,
                  error: error.message,
                },
                request.combinatorFlowId,
              );
            }
            entry.reject?.(error);
          }
        }),
      )
      .subscribe();
  }
}
