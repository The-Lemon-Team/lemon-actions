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
import { SeasonsPrivacy } from '../../core/models/seasons.models';

export type SeasonsCreateModalMode = 'stream' | 'feed' | 'note';

export interface SeasonsCreateSubmitPayload {
  mode: SeasonsCreateModalMode;
  slug: string;
  title: string;
  description: string;
  privacy: SeasonsPrivacy;
  icon: string;
  color: string;
  streamSlug?: string;
  feedSlug?: string;
  noteType?: string;
  todoLines?: string[];
}

@Component({
  selector: 'app-seasons-create-modal',
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
        aria-labelledby="seasons-create-modal-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-lg rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
            <h2 id="seasons-create-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
              @switch (mode) {
                @case ('stream') { Новый Stream (Namespace) }
                @case ('feed') { Новый Feed в стриме }
                @case ('note') { Новая Note / TodoList }
              }
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
            @if (mode === 'stream' || mode === 'feed') {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Название *</span>
                  <input
                    type="text"
                    [(ngModel)]="title"
                    (ngModelChange)="syncSlugFromTitle()"
                    placeholder="Например: Projectarium Stories"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Slug *</span>
                  <input
                    type="text"
                    [(ngModel)]="slug"
                    placeholder="projectarium-stories"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
            }

            @if (mode === 'feed' || mode === 'note') {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Stream Slug</span>
                  <input
                    type="text"
                    [(ngModel)]="streamSlug"
                    placeholder="projectarium"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                @if (mode === 'note') {
                  <label class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant">Feed Slug *</span>
                    <input
                      type="text"
                      [(ngModel)]="feedSlug"
                      placeholder="projectarium-todos"
                      class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                }
              </div>
            }

            @if (mode === 'note') {
              <div class="grid grid-cols-3 gap-3">
                <label class="col-span-2 flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Заголовок *</span>
                  <input
                    type="text"
                    [(ngModel)]="title"
                    placeholder="Спринт / Идея / Хронология..."
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Тип</span>
                  <select
                    [(ngModel)]="noteType"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="SINGLE">SINGLE</option>
                    <option value="PERIOD">PERIOD</option>
                    <option value="EVENT">EVENT</option>
                    <option value="DONE">DONE</option>
                  </select>
                </label>
              </div>
            }

            <div class="grid grid-cols-3 gap-3">
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Приватность</span>
                <select
                  [(ngModel)]="privacy"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Иконка</span>
                <input
                  type="text"
                  [(ngModel)]="icon"
                  placeholder="🌊"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Цвет</span>
                <input
                  type="color"
                  [(ngModel)]="color"
                  class="h-9 w-full rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer"
                />
              </label>
            </div>

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">
                {{ mode === 'note' ? 'Текст заметки (Markdown) *' : 'Описание' }}
              </span>
              <textarea
                rows="3"
                [(ngModel)]="description"
                [placeholder]="mode === 'note' ? 'Описание заметки или истории...' : 'Краткое описание потока/фида...'"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              ></textarea>
            </label>

            @if (mode === 'note') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">
                  TodoList пункты (каждый с новой строки, опционально)
                </span>
                <textarea
                  rows="3"
                  [(ngModel)]="todoLinesRaw"
                  placeholder="Настроить приватный стрим&#10;Проверить SSE подписку&#10;Добавить заметку"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                ></textarea>
              </label>
            }

            @if (validationError) {
              <p class="text-xs font-semibold text-error">{{ validationError }}</p>
            }
          </div>

          <!-- FOOTER -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low/60">
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onSubmit()"
              class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {{ isSubmitting ? 'Сохранение...' : 'Создать' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SeasonsCreateModalComponent implements OnChanges {
  @Input() open = false;
  @Input() mode: SeasonsCreateModalMode = 'stream';
  @Input() defaultStreamSlug = '';
  @Input() defaultFeedSlug = '';
  @Input() isSubmitting = false;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<SeasonsCreateSubmitPayload>();

  title = '';
  slug = '';
  description = '';
  privacy: SeasonsPrivacy = 'private';
  icon = '🌊';
  color = '#f59e0b';
  streamSlug = '';
  feedSlug = '';
  noteType = 'SINGLE';
  todoLinesRaw = '';
  validationError = '';
  private slugTouchedManually = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true || changes['mode'] || changes['defaultStreamSlug'] || changes['defaultFeedSlug']) {
      if (this.open) {
        this.resetForm();
      }
    }
  }

  syncSlugFromTitle(): void {
    if (this.slugTouchedManually || this.mode === 'note') return;
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.resetForm();
    this.closed.emit();
  }

  onSubmit(): void {
    const cleanTitle = this.title.trim();
    const cleanSlug = this.slug.trim();

    if (this.mode !== 'note' && (!cleanTitle || !cleanSlug)) {
      this.validationError = 'Укажите название и slug.';
      return;
    }
    if (this.mode === 'note' && (!cleanTitle || !this.feedSlug.trim() || !this.description.trim())) {
      this.validationError = 'Заполните заголовок, Feed Slug и текст заметки.';
      return;
    }

    this.validationError = '';
    const todoLines = this.todoLinesRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    this.submitted.emit({
      mode: this.mode,
      slug: cleanSlug,
      title: cleanTitle,
      description: this.description.trim(),
      privacy: this.privacy,
      icon: this.icon.trim() || (this.mode === 'stream' ? '🌊' : '📌'),
      color: this.color,
      streamSlug: this.streamSlug.trim() || undefined,
      feedSlug: this.feedSlug.trim() || undefined,
      noteType: this.noteType,
      todoLines,
    });
  }

  private resetForm(): void {
    this.title = '';
    this.slug = '';
    this.description = '';
    this.privacy = 'private';
    this.icon = this.mode === 'stream' ? '🌊' : this.mode === 'feed' ? '📌' : '📝';
    this.color = '#f59e0b';
    this.streamSlug = this.defaultStreamSlug || '';
    this.feedSlug = this.defaultFeedSlug || '';
    this.noteType = 'SINGLE';
    this.todoLinesRaw = '';
    this.validationError = '';
    this.slugTouchedManually = false;
  }
}
