import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MediaAssetView,
  MediaKind,
  MediaProcessingStatus,
  MediaVisibility,
} from '../../core/models/media.models';

@Component({
  selector: 'app-media-asset-grid',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 w-full">
      <!-- FILTER & MODERATION TOOLBAR -->
      <div class="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-3.5 flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <!-- Kind tabs -->
          <div class="flex items-center gap-1 flex-wrap">
            @for (tab of kindTabs; track tab.value) {
              <button
                type="button"
                (click)="kindChange.emit(tab.value)"
                [class]="kindTabClass(selectedKind === tab.value)"
              >
                <span class="material-symbols-rounded text-sm">{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            }
          </div>

          <!-- Search + Favorites -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative flex-1 md:w-64">
              <span class="material-symbols-rounded text-base text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                [ngModel]="searchQuery"
                (ngModelChange)="searchChange.emit($event)"
                placeholder="Поиск по названию, файлу, тегу..."
                class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="button"
              (click)="onlyFavoritesChange.emit(!onlyFavorites)"
              [class]="favoriteFilterClass(onlyFavorites)"
              title="Только избранные"
            >
              <span class="material-symbols-rounded text-sm">star</span>
              <span>Избранное</span>
            </button>
          </div>
        </div>

        <!-- Secondary moderation filters -->
        <div class="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-outline-variant/20 text-xs">
          <div class="flex items-center gap-2 flex-wrap">
            <label class="inline-flex items-center gap-1.5 text-on-surface-variant">
              <span class="font-semibold">Доступ:</span>
              <select
                [ngModel]="selectedVisibility"
                (ngModelChange)="visibilityChange.emit($event)"
                class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface focus:outline-none"
              >
                <option value="ALL">Все уровни</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="SCOPED">SCOPED (по грантам)</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </label>

            <label class="inline-flex items-center gap-1.5 text-on-surface-variant">
              <span class="font-semibold">Обработка:</span>
              <select
                [ngModel]="selectedStatus"
                (ngModelChange)="statusChange.emit($event)"
                class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/35 text-xs text-on-surface focus:outline-none"
              >
                <option value="ALL">Все статусы</option>
                <option value="READY">READY</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
              </select>
            </label>
          </div>

          <span class="text-[11px] font-mono text-on-surface-variant">
            Показано {{ assets.length }} из {{ totalCount }}
          </span>
        </div>
      </div>

      <!-- LOADING STATE -->
      @if (loading && assets.length === 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (item of [1, 2, 3, 4, 5, 6, 7, 8]; track item) {
            <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 overflow-hidden animate-pulse">
              <div class="h-44 bg-surface-container-high"></div>
              <div class="p-3.5 flex flex-col gap-2">
                <div class="h-4 w-3/4 rounded bg-surface-container-high"></div>
                <div class="h-3 w-1/2 rounded bg-surface-container-high"></div>
              </div>
            </div>
          }
        </div>
      } @else if (assets.length === 0) {
        <div class="rounded-3xl bg-surface-container-low border border-dashed border-outline-variant/50 p-10 text-center flex flex-col items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-rounded text-2xl">perm_media</span>
          </div>
          <div class="text-sm font-bold text-on-surface">Нет медиа-ассетов по выбранным фильтрам</div>
          <p class="text-xs text-on-surface-variant max-w-md">
            Загрузите новый файл в эту папку или сбросьте фильтры модерации, чтобы увидеть весь контент проектов.
          </p>
        </div>
      } @else {
        <!-- ASSET CARDS GRID -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (asset of assets; track asset.id) {
            <article class="group rounded-2xl bg-surface-container-low border border-outline-variant/30 hover:border-primary/50 overflow-hidden flex flex-col transition-all shadow-xs">
              <!-- PREVIEW HEADER -->
              <div
                (click)="inspectAsset.emit(asset)"
                class="relative h-44 bg-surface-container-high flex items-center justify-center overflow-hidden cursor-pointer"
              >
                @if (asset.kind === 'IMAGE' || asset.kind === 'VIDEO') {
                  <img
                    [src]="thumbUrlResolver(asset)"
                    [alt]="asset.title || asset.filename"
                    loading="lazy"
                    class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  @if (asset.kind === 'VIDEO') {
                    <span class="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-mono font-bold">
                      <span class="material-symbols-rounded text-xs">play_arrow</span>
                      <span>{{ formatDuration(asset.durationMs) }}</span>
                    </span>
                  }
                } @else if (asset.kind === 'AUDIO') {
                  <div class="flex flex-col items-center justify-center gap-2 text-primary p-4">
                    <div class="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <span class="material-symbols-rounded text-3xl">graphic_eq</span>
                    </div>
                    <span class="text-[11px] font-mono text-on-surface-variant">
                      AUDIO · {{ formatDuration(asset.durationMs) }}
                    </span>
                  </div>
                } @else {
                  <div class="flex flex-col items-center justify-center gap-2 text-on-surface-variant p-4">
                    <div class="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center">
                      <span class="material-symbols-rounded text-3xl">description</span>
                    </div>
                    <span class="text-[11px] font-mono uppercase">{{ asset.mimeType }}</span>
                  </div>
                }

                <!-- TOP BADGES -->
                <div class="absolute top-2 left-2 flex items-center gap-1.5">
                  <span [class]="visibilityBadgeClass(asset.visibility)">
                    {{ asset.visibility }}
                  </span>
                  @if (asset.processingStatus !== 'READY') {
                    <span [class]="processingBadgeClass(asset.processingStatus)">
                      {{ asset.processingStatus }}
                    </span>
                  }
                </div>

                <!-- FAVORITE TOGGLE -->
                <button
                  type="button"
                  (click)="$event.stopPropagation(); toggleFavorite.emit(asset)"
                  [title]="asset.isFavorite ? 'Убрать из избранного' : 'В избранное'"
                  class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span
                    class="material-symbols-rounded text-base"
                    [class]="asset.isFavorite ? 'text-amber-400' : 'text-white'"
                  >
                    {{ asset.isFavorite ? 'star' : 'star_outline' }}
                  </span>
                </button>
              </div>

              <!-- CARD BODY -->
              <div class="p-3.5 flex flex-col gap-2.5 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3
                      (click)="inspectAsset.emit(asset)"
                      class="text-xs font-bold text-on-surface truncate cursor-pointer hover:text-primary"
                      [title]="asset.title || asset.filename"
                    >
                      {{ asset.title || asset.originalFilename || asset.filename }}
                    </h3>
                    <div class="text-[10px] font-mono text-on-surface-variant truncate mt-0.5">
                      /{{ asset.folderPath }} · {{ formatSize(asset.sizeBytes) }}
                      @if (asset.width && asset.height) {
                        · {{ asset.width }}×{{ asset.height }}
                      }
                    </div>
                  </div>
                </div>

                <!-- Tags & Grants -->
                @if (asset.tags.length > 0 || (asset.grants?.length ?? 0) > 0) {
                  <div class="flex items-center gap-1 flex-wrap">
                    @for (grant of (asset.grants || []).slice(0, 2); track grant.id) {
                      <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold">
                        {{ '@' + (grant.clientSlug || grant.clientId) }}
                      </span>
                    }
                    @for (tag of asset.tags.slice(0, 3); track tag) {
                      <span class="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-mono">
                        #{{ tag }}
                      </span>
                    }
                  </div>
                }

                <!-- ACTIONS FOOTER -->
                <div class="mt-auto pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                  <span class="text-[10px] font-mono text-on-surface-variant">
                    uses: {{ asset.usageCount }}
                  </span>

                  <div class="flex items-center gap-1">
                    @if (asset.processingStatus === 'FAILED') {
                      <button
                        type="button"
                        title="Переобработать"
                        (click)="reprocessAsset.emit(asset)"
                        class="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/15 transition-colors cursor-pointer"
                      >
                        <span class="material-symbols-rounded text-base">refresh</span>
                      </button>
                    }
                    <button
                      type="button"
                      title="Модерировать и настроить доступ"
                      (click)="inspectAsset.emit(asset)"
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-[11px] font-bold text-on-surface transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-rounded text-sm">tune</span>
                      <span>Модерация</span>
                    </button>
                    <button
                      type="button"
                      title="Удалить ассет"
                      (click)="deleteAsset.emit(asset)"
                      class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-rounded text-base">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          }
        </div>

        @if (hasMore) {
          <div class="flex justify-center pt-2">
            <button
              type="button"
              [disabled]="loading"
              (click)="loadMore.emit()"
              class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-xs font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
            >
              <span class="material-symbols-rounded text-base">expand_more</span>
              <span>{{ loading ? 'Загрузка...' : 'Загрузить ещё' }}</span>
            </button>
          </div>
        }
      }
    </section>
  `,
})
export class MediaAssetGridComponent {
  @Input() assets: readonly MediaAssetView[] = [];
  @Input() totalCount = 0;
  @Input() loading = false;
  @Input() hasMore = false;
  @Input() selectedKind: MediaKind | 'ALL' = 'ALL';
  @Input() selectedVisibility: MediaVisibility | 'ALL' = 'ALL';
  @Input() selectedStatus: MediaProcessingStatus | 'ALL' = 'ALL';
  @Input() searchQuery = '';
  @Input() onlyFavorites = false;
  @Input() thumbUrlResolver: (asset: MediaAssetView) => string = (a) => a.thumbnailUrl;

  @Output() kindChange = new EventEmitter<MediaKind | 'ALL'>();
  @Output() visibilityChange = new EventEmitter<MediaVisibility | 'ALL'>();
  @Output() statusChange = new EventEmitter<MediaProcessingStatus | 'ALL'>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() onlyFavoritesChange = new EventEmitter<boolean>();
  @Output() inspectAsset = new EventEmitter<MediaAssetView>();
  @Output() toggleFavorite = new EventEmitter<MediaAssetView>();
  @Output() reprocessAsset = new EventEmitter<MediaAssetView>();
  @Output() deleteAsset = new EventEmitter<MediaAssetView>();
  @Output() loadMore = new EventEmitter<void>();

  readonly kindTabs: Array<{ value: MediaKind | 'ALL'; label: string; icon: string }> = [
    { value: 'ALL', label: 'Все', icon: 'apps' },
    { value: 'IMAGE', label: 'Фото', icon: 'image' },
    { value: 'VIDEO', label: 'Видео', icon: 'movie' },
    { value: 'AUDIO', label: 'Аудио', icon: 'audiotrack' },
    { value: 'DOCUMENT', label: 'Документы', icon: 'description' },
  ];

  kindTabClass(active: boolean): string {
    return active
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold shadow-xs cursor-pointer'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant text-xs font-semibold cursor-pointer';
  }

  favoriteFilterClass(active: boolean): string {
    return active
      ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer'
      : 'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/35 text-on-surface-variant text-xs font-semibold cursor-pointer';
  }

  visibilityBadgeClass(vis: MediaVisibility): string {
    if (vis === 'PUBLIC') {
      return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/90 text-white shadow-xs';
    }
    if (vis === 'SCOPED') {
      return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/90 text-white shadow-xs';
    }
    return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800/85 text-white shadow-xs';
  }

  processingBadgeClass(status: MediaProcessingStatus): string {
    if (status === 'FAILED') {
      return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-600/90 text-white';
    }
    return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-600/90 text-white';
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDuration(ms?: number | null): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
