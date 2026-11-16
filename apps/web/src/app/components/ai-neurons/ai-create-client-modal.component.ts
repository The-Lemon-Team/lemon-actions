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
import { AiTaskType } from '../../core/models/ai.models';

export interface AiCreateClientPayload {
  slug: string;
  name: string;
  allowedTasks: AiTaskType[];
  dailyLimit?: number;
}

const ALL_AI_TASKS: AiTaskType[] = [
  'TEXT_GENERATE',
  'NOTE_GENERATE',
  'QUICK_ADD_PARSE',
  'IMAGE_GENERATE',
  'IMAGE_REMIX',
  'VISION_ANALYZE',
];

@Component({
  selector: 'app-ai-create-client-modal',
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
        aria-labelledby="ai-create-client-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-md rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
            <h2 id="ai-create-client-title" class="font-headline-sm text-base font-bold text-on-surface">
              Новый клиент Umniy Lemon
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
            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Название приложения *</span>
              <input
                type="text"
                [(ngModel)]="name"
                (ngModelChange)="syncSlug()"
                placeholder="Например: Lemon Mantra"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Slug (идентификатор) *</span>
              <input
                type="text"
                [(ngModel)]="slug"
                placeholder="lemon-mantra"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-bold text-on-surface-variant">Дневной лимит запросов (опционально)</span>
              <input
                type="number"
                min="1"
                [(ngModel)]="dailyLimitStr"
                placeholder="Без лимита"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <div class="flex flex-col gap-1.5">
              <span class="font-bold text-on-surface-variant">Разрешённые AI-задачи</span>
              <div class="flex flex-wrap gap-1.5">
                @for (task of allTasks; track task) {
                  <button
                    type="button"
                    (click)="toggleTask(task)"
                    [class]="taskChipClass(selectedTasks.has(task))"
                  >
                    {{ task }}
                  </button>
                }
              </div>
            </div>

            @if (errorMessage) {
              <div class="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                {{ errorMessage }}
              </div>
            }
          </div>

          <!-- FOOTER -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low">
            <button
              type="button"
              [disabled]="isSubmitting"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              [disabled]="isSubmitting || !name.trim() || !slug.trim()"
              (click)="onSubmit()"
              class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {{ isSubmitting ? 'Создание...' : 'Создать и выпустить ключ' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AiCreateClientModalComponent implements OnChanges {
  @Input() open = false;
  @Input() isSubmitting = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() submitClient = new EventEmitter<AiCreateClientPayload>();

  readonly allTasks = ALL_AI_TASKS;

  name = '';
  slug = '';
  slugEditedManually = false;
  dailyLimitStr = '';
  selectedTasks = new Set<AiTaskType>(ALL_AI_TASKS);
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
    }
  }

  syncSlug(): void {
    if (this.slugEditedManually) return;
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  toggleTask(task: AiTaskType): void {
    if (this.selectedTasks.has(task)) {
      if (this.selectedTasks.size > 1) {
        this.selectedTasks.delete(task);
      }
    } else {
      this.selectedTasks.add(task);
    }
  }

  taskChipClass(active: boolean): string {
    return active
      ? 'px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container font-mono text-[10px] font-bold cursor-pointer'
      : 'px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface-variant font-mono text-[10px] cursor-pointer';
  }

  onSubmit(): void {
    const cleanName = this.name.trim();
    const cleanSlug = this.slug.trim().toLowerCase();
    if (!cleanName || !cleanSlug) {
      this.errorMessage = 'Укажите название и slug клиента';
      return;
    }
    const parsedLimit = this.dailyLimitStr ? Number(this.dailyLimitStr) : undefined;
    this.errorMessage = '';
    this.submitClient.emit({
      name: cleanName,
      slug: cleanSlug,
      allowedTasks: Array.from(this.selectedTasks),
      dailyLimit: parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    });
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.resetForm();
    this.closeModal.emit();
  }

  private resetForm(): void {
    this.name = '';
    this.slug = '';
    this.slugEditedManually = false;
    this.dailyLimitStr = '';
    this.selectedTasks = new Set<AiTaskType>(ALL_AI_TASKS);
    this.errorMessage = '';
  }
}
