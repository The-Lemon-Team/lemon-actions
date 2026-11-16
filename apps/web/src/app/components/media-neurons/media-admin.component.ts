import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import {
  MediaAssetLineageView,
  MediaAssetView,
  MediaFolderView,
  MediaKind,
  MediaProcessingStatus,
  MediaServiceClientView,
  MediaSseImpulseView,
  MediaStatusView,
  MediaVisibility,
} from '../../core/models/media.models';
import { MediaService } from '../../core/services/media.service';
import { MediaAssetGridComponent } from './media-asset-grid.component';
import {
  MediaCreateClientPayload,
  MediaCreateEntityModalComponent,
  MediaCreateEntityMode,
  MediaCreateFolderPayload,
} from './media-create-entity-modal.component';
import { MediaFolderSidebarComponent } from './media-folder-sidebar.component';
import {
  MediaModerationModalComponent,
  MediaSaveAccessPayload,
  MediaSaveMetadataPayload,
} from './media-moderation-modal.component';
import {
  MediaUploadModalComponent,
  MediaUploadSubmitPayload,
} from './media-upload-modal.component';

const PAGE_SIZE = 40;

@Component({
  selector: 'app-media-admin',
  standalone: true,
  imports: [
    FormsModule,
    MediaFolderSidebarComponent,
    MediaAssetGridComponent,
    MediaModerationModalComponent,
    MediaUploadModalComponent,
    MediaCreateEntityModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5 w-full pb-14">
      <!-- TOP COMMAND BAR -->
      <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-rounded text-xl">perm_media</span>
            </div>
            <h1 class="font-headline-sm text-2xl font-bold text-on-surface tracking-tight">
              Media Neurons · Админка модерации
            </h1>

            @if (status(); as st) {
              <span [class]="connectionBadgeClass(st.connected && st.authenticated)">
                <span [class]="connectionDotClass(st.connected && st.authenticated)"></span>
                {{
                  !st.connected
                    ? 'Media Hub Offline'
                    : st.authenticated
                      ? 'Media Hub Online'
                      : 'Auth Required'
                }}
                · {{ st.baseUrl }}
              </span>
              @if (st.sseConnected) {
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-container text-on-primary-container">
                  SSE Live
                </span>
              }
            }
          </div>
          <p class="font-body-sm text-xs text-on-surface-variant mt-1">
            Централизованная модерация медиа-контента проектов через &#64;lemon/media-hub-neurons и потоки Core Combinator.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            (click)="openCreateEntity('folder')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/35 text-xs font-bold text-on-surface transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm text-amber-500">create_new_folder</span>
            <span>+ Папка</span>
          </button>

          <button
            type="button"
            (click)="openCreateEntity('client')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/35 text-xs font-bold text-on-surface transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm text-emerald-500">vpn_key</span>
            <span>+ Проект-клиент</span>
          </button>

          <button
            type="button"
            (click)="uploadModalOpen.set(true)"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">cloud_upload</span>
            <span>Загрузить медиа</span>
          </button>

          <button
            type="button"
            (click)="refreshAll()"
            title="Обновить медиа-библиотеку"
            class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">refresh</span>
          </button>
        </div>
      </header>

      <!-- AUTH FALLBACK BAR (if Media Hub is online but credentials differ) -->
      @if (status(); as st) {
        @if (st.connected && !st.authenticated) {
          <div class="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2 text-on-surface">
              <span class="material-symbols-rounded text-amber-500">lock</span>
              <span>Media Hub требует авторизации администратора для управления ассетами.</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                [(ngModel)]="loginUsername"
                placeholder="admin"
                class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs w-32"
              />
              <input
                type="password"
                [(ngModel)]="loginPassword"
                placeholder="password"
                class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs w-40"
              />
              <button
                type="button"
                [disabled]="busyAction()"
                (click)="onManualLogin()"
                class="px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container font-bold cursor-pointer"
              >
                Войти
              </button>
            </div>
          </div>
        }
      }

      <!-- FEEDBACK / NEW CLIENT API KEY BANNER -->
      @if (issuedApiKeyBanner(); as keyInfo) {
        <div class="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-xs text-on-surface flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="material-symbols-rounded text-emerald-500">key</span>
            <span class="font-bold">Создан клиент {{ keyInfo.slug }} — сохраните X-Media-Api-Key (показывается один раз):</span>
            <code class="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] select-all">
              {{ keyInfo.apiKey }}
            </code>
          </div>
          <button
            type="button"
            (click)="issuedApiKeyBanner.set(null)"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

      @if (feedbackBanner(); as banner) {
        <div class="px-4 py-2.5 rounded-2xl bg-surface-container-low border border-primary/30 text-xs text-on-surface flex items-center justify-between gap-3">
          <span>{{ banner }}</span>
          <button
            type="button"
            (click)="feedbackBanner.set(null)"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

      <!-- MODERATION STATS STRIP -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Всего в выборке</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ totalCount() }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">PUBLIC</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats().publicCount }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">SCOPED</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats().scopedCount }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">PRIVATE</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats().privateCount }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">FAILED</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats().failedCount }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-primary">Последний SSE</div>
          <div class="text-xs font-bold text-on-surface font-mono truncate mt-1">
            {{ lastImpulse()?.type || 'Ожидание...' }}
          </div>
        </div>
      </div>

      <!-- WORKSPACE: SIDEBAR + MODERATION GRID -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div class="xl:col-span-3">
          <app-media-folder-sidebar
            [folders]="folders()"
            [clients]="clients()"
            [neurons]="status()?.combinatorNeurons || []"
            [activeFolderPath]="activeFolderPath()"
            [totalAssets]="totalLibraryCount()"
            [syncingNeurons]="busyAction()"
            (folderSelect)="onSelectFolder($event)"
            (createFolderClick)="openCreateEntity('folder')"
            (deleteFolderClick)="onDeleteFolder($event)"
            (createClientClick)="openCreateEntity('client')"
            (syncNeuronsClick)="onSyncNeurons()"
          />
        </div>

        <div class="xl:col-span-9 min-w-0">
          <app-media-asset-grid
            [assets]="assets()"
            [totalCount]="totalCount()"
            [loading]="loadingAssets()"
            [hasMore]="assets().length < totalCount()"
            [selectedKind]="selectedKind()"
            [selectedVisibility]="selectedVisibility()"
            [selectedStatus]="selectedStatus()"
            [searchQuery]="searchQuery()"
            [onlyFavorites]="onlyFavorites()"
            [thumbUrlResolver]="resolveThumbUrl"
            (kindChange)="onKindChange($event)"
            (visibilityChange)="onVisibilityChange($event)"
            (statusChange)="onStatusChange($event)"
            (searchChange)="onSearchChange($event)"
            (onlyFavoritesChange)="onOnlyFavoritesChange($event)"
            (inspectAsset)="onInspectAsset($event)"
            (toggleFavorite)="onToggleFavorite($event)"
            (reprocessAsset)="onReprocessAsset($event)"
            (deleteAsset)="onDeleteAsset($event)"
            (loadMore)="onLoadMore()"
          />
        </div>
      </div>
    </div>

    <!-- MODERATION & ACCESS INSPECTOR MODAL -->
    <app-media-moderation-modal
      [asset]="inspectedAsset()"
      [lineage]="inspectedLineage()"
      [folders]="folders()"
      [clients]="clients()"
      [isSubmitting]="busyAction()"
      [fileUrlResolver]="resolveFileUrl"
      (closed)="closeInspector()"
      (saveMetadata)="onSaveMetadata($event)"
      (saveAccess)="onSaveAccess($event)"
      (toggleFavorite)="onToggleFavorite($event)"
      (reprocess)="onReprocessAsset($event)"
      (deleteAsset)="onDeleteAsset($event)"
    />

    <!-- UPLOAD MODAL -->
    <app-media-upload-modal
      [open]="uploadModalOpen()"
      [folders]="folders()"
      [clients]="clients()"
      [defaultFolderPath]="activeFolderPath()"
      [isSubmitting]="busyAction()"
      (closed)="uploadModalOpen.set(false)"
      (uploadSubmit)="onUploadSubmit($event)"
    />

    <!-- CREATE FOLDER / CLIENT MODAL -->
    <app-media-create-entity-modal
      [open]="createModalOpen()"
      [mode]="createModalMode()"
      [isSubmitting]="busyAction()"
      (closed)="createModalOpen.set(false)"
      (createFolderSubmit)="onCreateFolder($event)"
      (createClientSubmit)="onCreateClient($event)"
    />
  `,
})
export class MediaAdminComponent implements OnInit {
  private readonly mediaService = inject(MediaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<MediaStatusView | null>(null);
  readonly folders = signal<MediaFolderView[]>([]);
  readonly clients = signal<MediaServiceClientView[]>([]);
  readonly assets = signal<MediaAssetView[]>([]);
  readonly totalCount = signal(0);
  readonly totalLibraryCount = signal(0);
  readonly loadingAssets = signal(false);
  readonly busyAction = signal(false);
  readonly feedbackBanner = signal<string | null>(null);
  readonly issuedApiKeyBanner = signal<{ slug: string; apiKey: string } | null>(null);
  readonly lastImpulse = signal<MediaSseImpulseView | null>(null);

  // Filters
  readonly activeFolderPath = signal<string>('all');
  readonly selectedKind = signal<MediaKind | 'ALL'>('ALL');
  readonly selectedVisibility = signal<MediaVisibility | 'ALL'>('ALL');
  readonly selectedStatus = signal<MediaProcessingStatus | 'ALL'>('ALL');
  readonly searchQuery = signal<string>('');
  readonly onlyFavorites = signal<boolean>(false);

  // Modals
  readonly inspectedAsset = signal<MediaAssetView | null>(null);
  readonly inspectedLineage = signal<MediaAssetLineageView | null>(null);
  readonly uploadModalOpen = signal(false);
  readonly createModalOpen = signal(false);
  readonly createModalMode = signal<MediaCreateEntityMode>('folder');

  loginUsername = 'admin';
  loginPassword = '';

  readonly stats = computed(() => {
    const items = this.assets();
    return {
      publicCount: items.filter((i) => i.visibility === 'PUBLIC').length,
      scopedCount: items.filter((i) => i.visibility === 'SCOPED').length,
      privateCount: items.filter((i) => i.visibility === 'PRIVATE').length,
      failedCount: items.filter((i) => i.processingStatus === 'FAILED').length,
    };
  });

  readonly resolveThumbUrl = (asset: MediaAssetView): string =>
    this.mediaService.assetFileUrl(asset.id, 'thumb');

  readonly resolveFileUrl = (asset: MediaAssetView, variant = 'auto'): string =>
    this.mediaService.assetFileUrl(asset.id, variant);

  ngOnInit(): void {
    this.refreshAll();
    this.subscribeSse();
  }

  refreshAll(): void {
    this.mediaService
      .getStatus()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((st) => this.status.set(st));

    forkJoin({
      folders: this.mediaService.listFolders().pipe(catchError(() => of([]))),
      clients: this.mediaService.listClients().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ folders, clients }) => {
        this.folders.set(folders);
        this.clients.set(clients);
      });

    this.loadAssets(true);
  }

  loadAssets(reset = true): void {
    this.loadingAssets.set(true);
    const offset = reset ? 0 : this.assets().length;
    const folder = this.activeFolderPath();

    this.mediaService
      .listAssets({
        folderPath: folder === 'all' ? undefined : folder,
        kind: this.selectedKind() === 'ALL' ? undefined : (this.selectedKind() as MediaKind),
        visibility:
          this.selectedVisibility() === 'ALL'
            ? undefined
            : (this.selectedVisibility() as MediaVisibility),
        processingStatus:
          this.selectedStatus() === 'ALL'
            ? undefined
            : (this.selectedStatus() as MediaProcessingStatus),
        search: this.searchQuery().trim() || undefined,
        isFavorite: this.onlyFavorites() ? true : undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .pipe(
        catchError((err) => {
          this.feedbackBanner.set(`Ошибка загрузки медиа: ${this.extractError(err)}`);
          return of({ items: [], total: 0 });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (reset) {
          this.assets.set(res.items);
        } else {
          const existing = new Set(this.assets().map((a) => a.id));
          this.assets.set([...this.assets(), ...res.items.filter((i) => !existing.has(i.id))]);
        }
        this.totalCount.set(res.total);
        if (
          folder === 'all' &&
          this.selectedKind() === 'ALL' &&
          this.selectedVisibility() === 'ALL' &&
          this.selectedStatus() === 'ALL' &&
          !this.searchQuery().trim() &&
          !this.onlyFavorites()
        ) {
          this.totalLibraryCount.set(res.total);
        } else if (this.totalLibraryCount() === 0) {
          this.totalLibraryCount.set(res.total);
        }
        this.loadingAssets.set(false);
      });
  }

  onSelectFolder(path: string): void {
    this.activeFolderPath.set(path);
    this.loadAssets(true);
  }

  onKindChange(kind: MediaKind | 'ALL'): void {
    this.selectedKind.set(kind);
    this.loadAssets(true);
  }

  onVisibilityChange(vis: MediaVisibility | 'ALL'): void {
    this.selectedVisibility.set(vis);
    this.loadAssets(true);
  }

  onStatusChange(status: MediaProcessingStatus | 'ALL'): void {
    this.selectedStatus.set(status);
    this.loadAssets(true);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.loadAssets(true);
  }

  onOnlyFavoritesChange(fav: boolean): void {
    this.onlyFavorites.set(fav);
    this.loadAssets(true);
  }

  onLoadMore(): void {
    this.loadAssets(false);
  }

  onManualLogin(): void {
    if (!this.loginUsername.trim() || !this.loginPassword) return;
    this.busyAction.set(true);
    this.mediaService
      .login(this.loginUsername.trim(), this.loginPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyAction.set(false);
          this.loginPassword = '';
          this.feedbackBanner.set('Успешная авторизация в Lemon Media Hub.');
          this.refreshAll();
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка входа: ${this.extractError(err)}`);
        },
      });
  }

  onSyncNeurons(): void {
    this.busyAction.set(true);
    this.mediaService
      .ensureNeurons()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busyAction.set(false);
          const current = this.status();
          if (current) {
            this.status.set({
              ...current,
              neuronsSynced: res.synced,
              combinatorNeurons: res.neurons,
            });
          }
          this.feedbackBanner.set(
            res.synced
              ? `Синхронизировано ${res.neurons.length} композитных нейронов Media Hub в Core Combinator.`
              : 'Не удалось синхронизировать нейроны Core Combinator.',
          );
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка синхронизации нейронов: ${this.extractError(err)}`);
        },
      });
  }

  openCreateEntity(mode: MediaCreateEntityMode): void {
    this.createModalMode.set(mode);
    this.createModalOpen.set(true);
  }

  onCreateFolder(payload: MediaCreateFolderPayload): void {
    this.busyAction.set(true);
    this.mediaService
      .createFolder(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (folder) => {
          this.busyAction.set(false);
          this.createModalOpen.set(false);
          this.upsertFolder(folder);
          this.feedbackBanner.set(`Папка /${folder.path} создана.`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Не удалось создать папку: ${this.extractError(err)}`);
        },
      });
  }

  onDeleteFolder(folder: MediaFolderView): void {
    this.busyAction.set(true);
    this.mediaService
      .deleteFolder(folder.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyAction.set(false);
          this.folders.set(this.folders().filter((f) => f.id !== folder.id));
          if (this.activeFolderPath() === folder.path) {
            this.activeFolderPath.set('all');
            this.loadAssets(true);
          }
          this.feedbackBanner.set(`Папка /${folder.path} удалена.`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка удаления папки: ${this.extractError(err)}`);
        },
      });
  }

  onCreateClient(payload: MediaCreateClientPayload): void {
    this.busyAction.set(true);
    this.mediaService
      .createClient(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          this.busyAction.set(false);
          this.createModalOpen.set(false);
          this.clients.set([...this.clients(), client]);
          if (client.apiKey) {
            this.issuedApiKeyBanner.set({ slug: client.slug, apiKey: client.apiKey });
          }
          this.feedbackBanner.set(`Клиент проекта "${client.name}" (${client.slug}) зарегистрирован.`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Не удалось создать клиента: ${this.extractError(err)}`);
        },
      });
  }

  onUploadSubmit(payload: MediaUploadSubmitPayload): void {
    this.busyAction.set(true);
    this.mediaService
      .uploadAsset(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busyAction.set(false);
          this.uploadModalOpen.set(false);
          this.upsertAsset(res.asset, true);
          this.feedbackBanner.set(
            `Медиа "${res.asset.title || res.asset.filename}" загружено в /${res.asset.folderPath}.`,
          );
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка загрузки файла: ${this.extractError(err)}`);
        },
      });
  }

  onInspectAsset(asset: MediaAssetView): void {
    this.inspectedAsset.set(asset);
    this.inspectedLineage.set(null);

    this.mediaService
      .getAsset(asset.id)
      .pipe(
        catchError(() => of(asset)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((full) => {
        if (this.inspectedAsset()?.id === asset.id) {
          this.inspectedAsset.set(full);
          this.upsertAsset(full, false);
        }
      });

    this.mediaService
      .getAssetLineage(asset.id)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lineage) => {
        if (this.inspectedAsset()?.id === asset.id) {
          this.inspectedLineage.set(lineage);
        }
      });

    this.mediaService
      .trackView(asset.id)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  closeInspector(): void {
    this.inspectedAsset.set(null);
    this.inspectedLineage.set(null);
  }

  onSaveMetadata(payload: MediaSaveMetadataPayload): void {
    this.busyAction.set(true);
    this.mediaService
      .updateMetadata(payload.assetId, {
        title: payload.title,
        description: payload.description,
        folderPath: payload.folderPath,
        tags: payload.tags,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busyAction.set(false);
          this.upsertAsset(updated, false);
          if (this.inspectedAsset()?.id === updated.id) {
            this.inspectedAsset.set(updated);
          }
          this.feedbackBanner.set(`Метаданные "${updated.title || updated.filename}" сохранены.`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка сохранения метаданных: ${this.extractError(err)}`);
        },
      });
  }

  onSaveAccess(payload: MediaSaveAccessPayload): void {
    this.busyAction.set(true);
    this.mediaService
      .updateAccess(payload.assetId, {
        visibility: payload.visibility,
        clients: payload.clients,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busyAction.set(false);
          this.upsertAsset(updated, false);
          if (this.inspectedAsset()?.id === updated.id) {
            this.inspectedAsset.set(updated);
          }
          this.feedbackBanner.set(
            `Доступ обновлён: ${updated.visibility} (${updated.grants?.length || 0} грантов).`,
          );
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка обновления доступа: ${this.extractError(err)}`);
        },
      });
  }

  onToggleFavorite(asset: MediaAssetView): void {
    this.mediaService
      .toggleFavorite(asset.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.upsertAsset(updated, false);
          if (this.inspectedAsset()?.id === updated.id) {
            this.inspectedAsset.set(updated);
          }
        },
        error: (err) => {
          this.feedbackBanner.set(`Не удалось обновить избранное: ${this.extractError(err)}`);
        },
      });
  }

  onReprocessAsset(asset: MediaAssetView): void {
    this.busyAction.set(true);
    this.mediaService
      .reprocessAsset(asset.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busyAction.set(false);
          this.upsertAsset(updated, false);
          if (this.inspectedAsset()?.id === updated.id) {
            this.inspectedAsset.set(updated);
          }
          this.feedbackBanner.set(`Запущена переобработка "${updated.title || updated.filename}".`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка переобработки: ${this.extractError(err)}`);
        },
      });
  }

  onDeleteAsset(asset: MediaAssetView): void {
    this.busyAction.set(true);
    this.mediaService
      .deleteAsset(asset.id, 'admin-moderation')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyAction.set(false);
          this.removeAssetFromState(asset.id);
          if (this.inspectedAsset()?.id === asset.id) {
            this.closeInspector();
          }
          this.feedbackBanner.set(`Ассет "${asset.title || asset.filename}" удалён.`);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка удаления ассета: ${this.extractError(err)}`);
        },
      });
  }

  connectionBadgeClass(online: boolean): string {
    return online
      ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-error-container text-on-error-container';
  }

  connectionDotClass(online: boolean): string {
    return online ? 'w-1.5 h-1.5 rounded-full bg-emerald-500' : 'w-1.5 h-1.5 rounded-full bg-error';
  }

  private subscribeSse(): void {
    this.mediaService
      .connectEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((packet) => {
        const impulse = packet.impulse;
        if (!impulse) return;
        this.lastImpulse.set(impulse);

        if (impulse.type === 'FOLDER_CREATED' && impulse.folder) {
          this.upsertFolder(impulse.folder);
          return;
        }
        if (impulse.type === 'FOLDER_DELETED' && impulse.folderId) {
          this.folders.set(this.folders().filter((f) => f.id !== impulse.folderId));
          return;
        }
        if (impulse.type === 'MEDIA_DELETED' && impulse.assetId) {
          this.removeAssetFromState(impulse.assetId);
          if (this.inspectedAsset()?.id === impulse.assetId) {
            this.closeInspector();
          }
          return;
        }
        if (impulse.asset) {
          this.upsertAsset(impulse.asset, impulse.type === 'MEDIA_ADDED');
          if (this.inspectedAsset()?.id === impulse.asset.id) {
            this.inspectedAsset.set({ ...this.inspectedAsset()!, ...impulse.asset });
          }
        }
      });
  }

  private upsertFolder(folder: MediaFolderView): void {
    const current = this.folders();
    const idx = current.findIndex((f) => f.id === folder.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = folder;
      this.folders.set(next);
    } else {
      this.folders.set([...current, folder]);
    }
  }

  private upsertAsset(asset: MediaAssetView, prependIfNew: boolean): void {
    const current = this.assets();
    const idx = current.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = { ...next[idx], ...asset };
      this.assets.set(next);
      return;
    }

    if (prependIfNew && this.matchesActiveFilters(asset)) {
      this.assets.set([asset, ...current]);
      this.totalCount.set(this.totalCount() + 1);
      this.totalLibraryCount.set(this.totalLibraryCount() + 1);
    }
  }

  private removeAssetFromState(assetId: string): void {
    const current = this.assets();
    const next = current.filter((a) => a.id !== assetId);
    if (next.length < current.length) {
      this.assets.set(next);
      this.totalCount.set(Math.max(0, this.totalCount() - 1));
      this.totalLibraryCount.set(Math.max(0, this.totalLibraryCount() - 1));
    }
  }

  private matchesActiveFilters(asset: MediaAssetView): boolean {
    const folder = this.activeFolderPath();
    if (folder !== 'all' && asset.folderPath !== folder) return false;
    if (this.selectedKind() !== 'ALL' && asset.kind !== this.selectedKind()) return false;
    if (
      this.selectedVisibility() !== 'ALL' &&
      asset.visibility !== this.selectedVisibility()
    ) {
      return false;
    }
    if (
      this.selectedStatus() !== 'ALL' &&
      asset.processingStatus !== this.selectedStatus()
    ) {
      return false;
    }
    if (this.onlyFavorites() && !asset.isFavorite) return false;
    return true;
  }

  private extractError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const inner = (err as { error?: { message?: string } }).error;
      if (inner?.message) return inner.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
