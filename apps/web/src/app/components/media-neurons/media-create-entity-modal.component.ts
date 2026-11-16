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
import { MediaVisibility } from '../../core/models/media.models';

export type MediaCreateEntityMode = 'folder' | 'client';

export interface MediaCreateFolderPayload {
  name: string;
  path: string;
  icon: string;
  defaultVisibility: MediaVisibility;
}

export interface MediaCreateClientPayload {
  slug: string;
  name: string;
  scopes: string[];
}

@Component({
  selector: 'app-media-create-entity-modal',
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
        aria-labelledby="media-create-entity-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-md rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
            <h2 id="media-create-entity-title" class="font-headline-sm text-base font-bold text-on-surface">
              {{ mode === 'folder' ? 'Новая папка медиа' : 'Новый проект-клиент (ACL)' }}
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
          <div class="px-6 py-4 flex flex-col gap-3.5 text-xs">
            @if (mode === 'folder') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Название папки *</span>
                <input
                  type="text"
                  [(ngModel)]="name"
                  (ngModelChange)="syncSlug()"
                  placeholder="Например: Projectarium Covers"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Путь (path) *</span>
                <input
                  type="text"
                  [(ngModel)]="path"
                  placeholder="projectarium-covers"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Иконка</span>
                  <select
                    [(ngModel)]="icon"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="folder">folder</option>
                    <option value="image">image</option>
                    <option value="movie">movie</option>
                    <option value="audiotrack">audiotrack</option>
                    <option value="palette">palette</option>
                    <option value="auto_awesome">auto_awesome</option>
                  </select>
                </label>

                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Доступ по умолчанию</span>
                  <select
                    [(ngModel)]="defaultVisibility"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="PRIVATE">PRIVATE</option>
                    <option value="SCOPED">SCOPED</option>
                    <option value="PUBLIC">PUBLIC</option>
                  </select>
                </label>
              </div>
            } @else {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Название проекта *</span>
                <input
                  type="text"
                  [(ngModel)]="name"
                  (ngModelChange)="syncSlug()"
                  placeholder="Например: Lemon Projectarium"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Slug клиента *</span>
                <input
                  type="text"
                  [(ngModel)]="path"
                  placeholder="lemon-projectarium"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div class="flex flex-col gap-1.5">
                <span class="font-bold text-on-surface-variant">Разрешённые скоупы</span>
                <div class="flex items-center gap-3 flex-wrap">
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="scopeRead" />
                    <span class="font-mono">media:read</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="scopeWrite" />
                    <span class="font-mono">media:write</span>
                  </label>
                </div>
              </div>
            }

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
              [disabled]="isSubmitting"
              (click)="onSubmit()"
              class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {{ isSubmitting ? 'Сохранение...' : (mode === 'folder' ? 'Создать папку' : 'Создать клиента') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MediaCreateEntityModalComponent implements OnChanges {
  @Input() open = false;
  @Input() mode: MediaCreateEntityMode = 'folder';
  @Input() isSubmitting = false;

  @Output() closed = new EventEmitter<void>();
  @Output() createFolderSubmit = new EventEmitter<MediaCreateFolderPayload>();
  @Output() createClientSubmit = new EventEmitter<MediaCreateClientPayload>();

  name = '';
  path = '';
  icon = 'folder';
  defaultVisibility: MediaVisibility = 'PRIVATE';
  scopeRead = true;
  scopeWrite = false;
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
    }
  }

  syncSlug(): void {
    this.path = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '');
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.resetForm();
    this.closed.emit();
  }

  onSubmit(): void {
    const cleanName = this.name.trim();
    const cleanPath = this.path.trim().toLowerCase();
    if (!cleanName || !cleanPath) {
      this.errorMessage = 'Заполните название и slug/путь.';
      return;
    }

    this.errorMessage = '';
    if (this.mode === 'folder') {
      this.createFolderSubmit.emit({
        name: cleanName,
        path: cleanPath,
        icon: this.icon,
        defaultVisibility: this.defaultVisibility,
      });
      return;
    }

    const scopes: string[] = [];
    if (this.scopeRead) scopes.push('media:read');
    if (this.scopeWrite) scopes.push('media:write');
    if (scopes.length === 0) scopes.push('media:read');

    this.createClientSubmit.emit({
      name: cleanName,
      slug: cleanPath,
      scopes,
    });
  }

  private resetForm(): void {
    this.name = '';
    this.path = '';
    this.icon = 'folder';
    this.defaultVisibility = 'PRIVATE';
    this.scopeRead = true;
    this.scopeWrite = false;
    this.errorMessage = '';
  }
}
