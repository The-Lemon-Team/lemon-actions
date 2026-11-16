import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  MediaAssetLineageView,
  MediaAssetView,
  MediaFolderView,
  MediaServiceClientView,
  MediaVisibility,
} from '../../core/models/media.models';

export interface MediaSaveMetadataPayload {
  assetId: string;
  title: string;
  description: string;
  folderPath: string;
  tags: string[];
}

export interface MediaSaveAccessPayload {
  assetId: string;
  visibility: MediaVisibility;
  clients: Array<{ clientSlug: string; permission: 'READ' | 'WRITE' }>;
}

@Component({
  selector: 'app-media-moderation-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (asset; as item) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="!isSubmitting"
        (overlayClose)="onClose()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="media-moderation-modal-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-4xl rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 id="media-moderation-modal-title" class="font-headline-sm text-base font-bold text-on-surface truncate">
                  {{ item.title || item.originalFilename || item.filename }}
                </h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                  {{ item.kind }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-container text-on-primary-container">
                  {{ item.processingStatus }}
                </span>
              </div>
              <div class="text-[11px] font-mono text-on-surface-variant truncate mt-0.5">
                ID: {{ item.id }} · /{{ item.folderPath }} · {{ item.mimeType }}
              </div>
            </div>

            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex-shrink-0"
            >
              <span class="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          <!-- BODY -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 overflow-y-auto text-xs">
            <!-- LEFT: MEDIA PREVIEW & TECHNICAL SPECS -->
            <div class="lg:col-span-5 flex flex-col gap-4">
              <div class="rounded-2xl bg-surface-container-high border border-outline-variant/30 overflow-hidden flex items-center justify-center min-h-[240px] max-h-[340px]">
                @switch (item.kind) {
                  @case ('IMAGE') {
                    <img
                      [src]="fileUrlResolver(item, 'full')"
                      [alt]="item.title || item.filename"
                      class="w-full h-full max-h-[340px] object-contain"
                    />
                  }
                  @case ('VIDEO') {
                    <video
                      [src]="fileUrlResolver(item, 'auto')"
                      controls
                      class="w-full max-h-[340px] bg-black"
                    ></video>
                  }
                  @case ('AUDIO') {
                    <div class="w-full p-6 flex flex-col items-center gap-3">
                      <div class="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                        <span class="material-symbols-rounded text-3xl">graphic_eq</span>
                      </div>
                      <audio [src]="fileUrlResolver(item, 'auto')" controls class="w-full"></audio>
                    </div>
                  }
                  @default {
                    <div class="p-6 flex flex-col items-center gap-3 text-center">
                      <span class="material-symbols-rounded text-4xl text-on-surface-variant">description</span>
                      <a
                        [href]="fileUrlResolver(item, 'original')"
                        target="_blank"
                        rel="noopener"
                        class="px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container font-bold no-underline"
                      >
                        Открыть документ
                      </a>
                    </div>
                  }
                }
              </div>

              <!-- TECHNICAL STATS -->
              <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3.5 grid grid-cols-2 gap-2.5 font-mono text-[11px]">
                <div>
                  <div class="text-on-surface-variant text-[10px]">Размер</div>
                  <div class="font-bold text-on-surface">{{ formatSize(item.sizeBytes) }}</div>
                </div>
                <div>
                  <div class="text-on-surface-variant text-[10px]">Разрешение</div>
                  <div class="font-bold text-on-surface">
                    {{ item.width && item.height ? item.width + '×' + item.height : '—' }}
                  </div>
                </div>
                <div>
                  <div class="text-on-surface-variant text-[10px]">Использований</div>
                  <div class="font-bold text-on-surface">{{ item.usageCount }}</div>
                </div>
                <div>
                  <div class="text-on-surface-variant text-[10px]">Источник</div>
                  <div class="font-bold text-on-surface truncate">{{ item.sourceApp || item.model }}</div>
                </div>
              </div>

              @if (item.processingError) {
                <div class="px-3 py-2 rounded-xl bg-error-container text-on-error-container text-[11px] font-mono">
                  Ошибка обработки: {{ item.processingError }}
                </div>
              }

              <!-- LINEAGE SUMMARY -->
              @if (lineage; as lin) {
                <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3.5 flex flex-col gap-2">
                  <div class="font-bold text-on-surface flex items-center gap-1.5">
                    <span class="material-symbols-rounded text-sm text-primary">account_tree</span>
                    <span>Lineage (связи)</span>
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    Parent: {{ lin.parent ? (lin.parent.title || lin.parent.filename) : 'Оригинал' }} ·
                    Дети/ремиксы: {{ lin.children.length }} ·
                    Сиблинги: {{ lin.siblings.length }}
                  </div>
                </div>
              }

              <div class="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  [disabled]="isSubmitting"
                  (click)="reprocess.emit(item)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span class="material-symbols-rounded text-sm">refresh</span>
                  <span>Переобработать</span>
                </button>
                <button
                  type="button"
                  [disabled]="isSubmitting"
                  (click)="toggleFavorite.emit(item)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span class="material-symbols-rounded text-sm text-amber-500">
                    {{ item.isFavorite ? 'star' : 'star_outline' }}
                  </span>
                  <span>{{ item.isFavorite ? 'В избранном' : 'В избранное' }}</span>
                </button>
              </div>
            </div>

            <!-- RIGHT: MODERATION METADATA & PROJECT ACL GRANTS -->
            <div class="lg:col-span-7 flex flex-col gap-4">
              <!-- METADATA FORM -->
              <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="font-bold text-on-surface text-xs uppercase tracking-wider">
                    Метаданные и расположение
                  </h3>
                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="onSaveMetadata()"
                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span class="material-symbols-rounded text-sm">save</span>
                    <span>Сохранить метаданные</span>
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant">Название</span>
                    <input
                      type="text"
                      [(ngModel)]="title"
                      class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>

                  <label class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant">Папка</span>
                    <select
                      [(ngModel)]="folderPath"
                      class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      @for (folder of folders; track folder.id) {
                        <option [value]="folder.path">/{{ folder.path }} ({{ folder.name }})</option>
                      }
                    </select>
                  </label>
                </div>

                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Описание / комментарий модератора</span>
                  <textarea
                    rows="2"
                    [(ngModel)]="description"
                    class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  ></textarea>
                </label>

                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Теги (через запятую)</span>
                  <input
                    type="text"
                    [(ngModel)]="tagsText"
                    placeholder="approved, cover, projectarium"
                    class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <!-- ACCESS CONTROL & PROJECT GRANTS -->
              <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="font-bold text-on-surface text-xs uppercase tracking-wider">
                    Права доступа (ACL) и проекты
                  </h3>
                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="onSaveAccess()"
                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span class="material-symbols-rounded text-sm">verified_user</span>
                    <span>Применить доступ</span>
                  </button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  @for (opt of visibilityOptions; track opt.value) {
                    <button
                      type="button"
                      (click)="visibility = opt.value"
                      [class]="visibilityBtnClass(visibility === opt.value)"
                    >
                      <span class="font-mono font-bold">{{ opt.value }}</span>
                      <span class="text-[10px] opacity-80">{{ opt.desc }}</span>
                    </button>
                  }
                </div>

                @if (visibility === 'SCOPED') {
                  <div class="flex flex-col gap-2 pt-1">
                    <span class="font-bold text-on-surface-variant">Гранты для проектов-клиентов:</span>
                    @for (client of clients; track client.id) {
                      <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/25">
                        <label class="inline-flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            [checked]="isClientGranted(client.slug)"
                            (change)="toggleClientGrant(client.slug)"
                          />
                          <span class="font-semibold text-on-surface truncate">{{ client.name }}</span>
                          <span class="font-mono text-[10px] text-on-surface-variant">({{ client.slug }})</span>
                        </label>

                        @if (isClientGranted(client.slug)) {
                          <select
                            [ngModel]="getClientPermission(client.slug)"
                            (ngModelChange)="setClientPermission(client.slug, $event)"
                            class="px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant/30 font-mono text-[11px]"
                          >
                            <option value="READ">READ</option>
                            <option value="WRITE">WRITE</option>
                          </select>
                        }
                      </div>
                    } @empty {
                      <p class="text-on-surface-variant">
                        Нет зарегистрированных клиентов. Добавьте проект в левой панели.
                      </p>
                    }
                  </div>
                }
              </div>

              <!-- DANGER ZONE -->
              <div class="rounded-2xl bg-error-container/20 border border-error/30 p-3.5 flex items-center justify-between gap-3">
                <div class="text-on-surface">
                  <div class="font-bold">Удалить медиа из хранилища</div>
                  <div class="text-[11px] text-on-surface-variant">
                    Удалит файл с диска, варианты и разошлёт импульс MEDIA_DELETED через MediaDeleteFlow.
                  </div>
                </div>

                @if (!confirmingDelete) {
                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="confirmingDelete = true"
                    class="px-3 py-1.5 rounded-xl bg-error text-on-error text-xs font-bold cursor-pointer flex-shrink-0"
                  >
                    Удалить
                  </button>
                } @else {
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      [disabled]="isSubmitting"
                      (click)="confirmingDelete = false"
                      class="px-2.5 py-1.5 rounded-xl bg-surface-container text-xs font-bold cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      [disabled]="isSubmitting"
                      (click)="deleteAsset.emit(item)"
                      class="px-3 py-1.5 rounded-xl bg-error text-on-error text-xs font-bold cursor-pointer"
                    >
                      Подтвердить
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- FOOTER -->
          <div class="px-6 py-3.5 border-t border-outline-variant/20 flex items-center justify-end">
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MediaModerationModalComponent implements OnChanges {
  @Input() asset: MediaAssetView | null = null;
  @Input() lineage: MediaAssetLineageView | null = null;
  @Input() folders: readonly MediaFolderView[] = [];
  @Input() clients: readonly MediaServiceClientView[] = [];
  @Input() isSubmitting = false;
  @Input() fileUrlResolver: (asset: MediaAssetView, variant?: string) => string = (a) => a.url;

  @Output() closed = new EventEmitter<void>();
  @Output() saveMetadata = new EventEmitter<MediaSaveMetadataPayload>();
  @Output() saveAccess = new EventEmitter<MediaSaveAccessPayload>();
  @Output() toggleFavorite = new EventEmitter<MediaAssetView>();
  @Output() reprocess = new EventEmitter<MediaAssetView>();
  @Output() deleteAsset = new EventEmitter<MediaAssetView>();

  title = '';
  description = '';
  folderPath = 'covers';
  tagsText = '';
  visibility: MediaVisibility = 'PRIVATE';
  grantPermissions = new Map<string, 'READ' | 'WRITE'>();
  confirmingDelete = false;

  readonly visibilityOptions: Array<{ value: MediaVisibility; desc: string }> = [
    { value: 'PRIVATE', desc: 'Только админка' },
    { value: 'SCOPED', desc: 'Выбранные проекты' },
    { value: 'PUBLIC', desc: 'Публичный доступ' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset']) {
      this.syncFromAsset();
    }
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.syncFromAsset();
    this.closed.emit();
  }

  onSaveMetadata(): void {
    if (!this.asset) return;
    const tags = this.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    this.saveMetadata.emit({
      assetId: this.asset.id,
      title: this.title.trim(),
      description: this.description.trim(),
      folderPath: this.folderPath,
      tags,
    });
  }

  onSaveAccess(): void {
    if (!this.asset) return;
    const clients =
      this.visibility === 'SCOPED'
        ? Array.from(this.grantPermissions.entries()).map(([clientSlug, permission]) => ({
            clientSlug,
            permission,
          }))
        : [];
    this.saveAccess.emit({
      assetId: this.asset.id,
      visibility: this.visibility,
      clients,
    });
  }

  isClientGranted(slug: string): boolean {
    return this.grantPermissions.has(slug);
  }

  toggleClientGrant(slug: string): void {
    if (this.grantPermissions.has(slug)) {
      this.grantPermissions.delete(slug);
    } else {
      this.grantPermissions.set(slug, 'READ');
    }
  }

  getClientPermission(slug: string): 'READ' | 'WRITE' {
    return this.grantPermissions.get(slug) || 'READ';
  }

  setClientPermission(slug: string, permission: 'READ' | 'WRITE'): void {
    this.grantPermissions.set(slug, permission);
  }

  visibilityBtnClass(active: boolean): string {
    return active
      ? 'p-2.5 rounded-xl bg-primary-container text-on-primary-container border border-primary/50 flex flex-col items-start gap-0.5 text-left cursor-pointer'
      : 'p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-outline-variant/30 flex flex-col items-start gap-0.5 text-left cursor-pointer';
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private syncFromAsset(): void {
    this.confirmingDelete = false;
    if (!this.asset) {
      this.title = '';
      this.description = '';
      this.folderPath = 'covers';
      this.tagsText = '';
      this.visibility = 'PRIVATE';
      this.grantPermissions = new Map();
      return;
    }

    this.title = this.asset.title || '';
    this.description = this.asset.description || '';
    this.folderPath = this.asset.folderPath || 'covers';
    this.tagsText = (this.asset.tags || []).join(', ');
    this.visibility = this.asset.visibility;
    const map = new Map<string, 'READ' | 'WRITE'>();
    for (const grant of this.asset.grants || []) {
      const slug = grant.clientSlug || grant.clientId;
      if (slug) {
        map.set(slug, grant.permission || 'READ');
      }
    }
    this.grantPermissions = map;
  }
}
