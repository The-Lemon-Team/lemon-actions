import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  MediaFolderView,
  MediaServiceClientView,
  MediaVisibility,
} from '../../core/models/media.models';

export interface MediaUploadSubmitPayload {
  file: File;
  folderPath: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility: MediaVisibility;
  allowedClients?: string[];
  waitForReady: boolean;
}

@Component({
  selector: 'app-media-upload-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="!isSubmitting"
        (overlayClose)="onClose()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="media-upload-modal-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-xl rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
            <h2 id="media-upload-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
              Загрузить медиа в библиотеку
            </h2>
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          <!-- BODY -->
          <div class="px-6 py-4 flex flex-col gap-3.5 text-xs overflow-y-auto">
            <!-- DROPZONE -->
            <label
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave()"
              (drop)="onDrop($event)"
              [class]="dropzoneClass()"
            >
              <input
                type="file"
                class="hidden"
                accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json"
                (change)="onFileSelected($event)"
              />
              @if (selectedFile; as file) {
                <div class="flex items-center gap-3 w-full">
                  @if (previewDataUrl) {
                    <img
                      [src]="previewDataUrl"
                      alt="Preview"
                      class="w-16 h-16 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0"
                    />
                  } @else {
                    <div class="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0">
                      <span class="material-symbols-rounded text-2xl">attach_file</span>
                    </div>
                  }
                  <div class="min-w-0 flex-1 text-left">
                    <div class="font-bold text-on-surface truncate">{{ file.name }}</div>
                    <div class="text-[11px] font-mono text-on-surface-variant">
                      {{ file.type || 'application/octet-stream' }} · {{ formatBytes(file.size) }}
                    </div>
                    <div class="text-[11px] text-primary mt-0.5">Нажмите, чтобы выбрать другой файл</div>
                  </div>
                </div>
              } @else {
                <span class="material-symbols-rounded text-3xl text-primary">cloud_upload</span>
                <div class="font-bold text-on-surface">
                  Перетащите файл сюда, выберите с диска или вставьте через Ctrl+V
                </div>
                <div class="text-[11px] text-on-surface-variant">
                  Поддерживаются изображения, видео, аудио и документы
                </div>
              }
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Целевая папка</span>
                <select
                  [(ngModel)]="folderPath"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  @for (folder of folders; track folder.id) {
                    <option [value]="folder.path">/{{ folder.path }} ({{ folder.name }})</option>
                  }
                  @if (folders.length === 0) {
                    <option value="covers">/covers</option>
                  }
                </select>
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Уровень доступа</span>
                <select
                  [(ngModel)]="visibility"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PRIVATE">PRIVATE (только админка)</option>
                  <option value="SCOPED">SCOPED (выбранные проекты)</option>
                  <option value="PUBLIC">PUBLIC (публичный CDN)</option>
                </select>
              </label>
            </div>

            @if (visibility === 'SCOPED' && clients.length > 0) {
              <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/25">
                <span class="font-bold text-on-surface-variant">Разрешённые проекты-клиенты</span>
                <div class="flex items-center gap-3 flex-wrap">
                  @for (client of clients; track client.id) {
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        [checked]="selectedClients.has(client.slug)"
                        (change)="toggleClient(client.slug)"
                      />
                      <span>{{ client.name }}</span>
                      <span class="font-mono text-[10px] text-on-surface-variant">({{ client.slug }})</span>
                    </label>
                  }
                </div>
              </div>
            }

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Заголовок (опционально)</span>
              <input
                type="text"
                [(ngModel)]="title"
                placeholder="Название медиа-ассета для модерации"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Описание / заметка модератора</span>
              <textarea
                rows="2"
                [(ngModel)]="description"
                placeholder="Контекст использования в проекте..."
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              ></textarea>
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Теги (через запятую)</span>
              <input
                type="text"
                [(ngModel)]="tagsText"
                placeholder="banner, hero, season-2026"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="inline-flex items-center gap-2 cursor-pointer text-on-surface-variant">
              <input type="checkbox" [(ngModel)]="waitForReady" />
              <span>Дождаться завершения обработки (MEDIA_READY через MediaIngestFlow)</span>
            </label>

            @if (errorMessage) {
              <div class="px-3 py-2 rounded-xl bg-error-container text-on-error-container text-xs">
                {{ errorMessage }}
              </div>
            }
          </div>

          <!-- FOOTER -->
          <div class="px-6 py-4 border-t border-outline-variant/20 flex items-center justify-end gap-2">
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              [disabled]="isSubmitting || !selectedFile"
              (click)="onSubmit()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <span class="material-symbols-rounded text-sm">upload</span>
              <span>{{ isSubmitting ? 'Загрузка...' : 'Загрузить' }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MediaUploadModalComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() folders: readonly MediaFolderView[] = [];
  @Input() clients: readonly MediaServiceClientView[] = [];
  @Input() defaultFolderPath = 'covers';
  @Input() isSubmitting = false;

  @Output() closed = new EventEmitter<void>();
  @Output() uploadSubmit = new EventEmitter<MediaUploadSubmitPayload>();

  selectedFile: File | null = null;
  previewDataUrl: string | null = null;
  isDragging = false;
  folderPath = 'covers';
  title = '';
  description = '';
  tagsText = '';
  visibility: MediaVisibility = 'PRIVATE';
  selectedClients = new Set<string>();
  waitForReady = false;
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
    }
  }

  @HostListener('document:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!this.open || this.isSubmitting) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          this.attachFile(file);
          break;
        }
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.attachFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.attachFile(file);
    }
  }

  toggleClient(slug: string): void {
    if (this.selectedClients.has(slug)) {
      this.selectedClients.delete(slug);
    } else {
      this.selectedClients.add(slug);
    }
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.resetForm();
    this.closed.emit();
  }

  onSubmit(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Выберите файл для загрузки.';
      return;
    }

    const tags = this.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    this.errorMessage = '';
    this.uploadSubmit.emit({
      file: this.selectedFile,
      folderPath: this.folderPath || 'covers',
      title: this.title.trim() || undefined,
      description: this.description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      visibility: this.visibility,
      allowedClients:
        this.visibility === 'SCOPED' ? Array.from(this.selectedClients) : undefined,
      waitForReady: this.waitForReady,
    });
  }

  dropzoneClass(): string {
    return this.isDragging
      ? 'rounded-2xl border-2 border-dashed border-primary bg-primary-container/20 p-5 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors'
      : 'rounded-2xl border-2 border-dashed border-outline-variant/50 hover:border-primary/60 bg-surface-container-low p-5 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors';
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private attachFile(file: File): void {
    this.selectedFile = file;
    this.errorMessage = '';
    if (!this.title) {
      this.title = file.name.replace(/\.[^.]+$/, '');
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.previewDataUrl = typeof reader.result === 'string' ? reader.result : null;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    } else {
      this.previewDataUrl = null;
    }
  }

  private resetForm(): void {
    this.selectedFile = null;
    this.previewDataUrl = null;
    this.isDragging = false;
    this.folderPath =
      this.defaultFolderPath && this.defaultFolderPath !== 'all'
        ? this.defaultFolderPath
        : this.folders[0]?.path || 'covers';
    this.title = '';
    this.description = '';
    this.tagsText = '';
    this.visibility = 'PRIVATE';
    this.selectedClients = new Set<string>();
    this.waitForReady = false;
    this.errorMessage = '';
  }
}
