import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ReactiveTodoListCard,
  ReactiveTodoItem,
  ReactiveTriggerType,
} from '../../core/models/todo-card.models';
import { LemonCardColor } from '../../core/models/worker.models';

@Component({
  selector: 'app-create-todo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
      appModalOverlay
      (overlayClose)="onCancel()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-todo-title"
    >
      <div
        class="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden my-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- HEADER -->
        <header class="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
              <span class="material-symbols-rounded text-lg">checklist</span>
            </div>
            <div>
              <h2 id="create-todo-title" class="font-headline-sm text-base font-bold text-on-surface">
                Новый реактивный TodoList
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Создайте карточку задач, автоматически реагирующую на события шины
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="onCancel()"
            aria-label="Закрыть"
            class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </header>

        <!-- FORM BODY -->
        <div class="px-6 py-5 overflow-y-auto flex flex-col gap-4 text-sm">
          <!-- Project ID & Title -->
          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Нейрон / Папка проекта:
            </label>
            <input
              type="text"
              [(ngModel)]="projectId"
              placeholder="например: workspace.core или all"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Название списка задач:
            </label>
            <input
              type="text"
              [(ngModel)]="title"
              placeholder="например: Чек-лист развёртывания сервисов"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Описание списка:
            </label>
            <textarea
              [(ngModel)]="description"
              rows="2"
              placeholder="Краткое описание целей и сценариев выполнения..."
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            ></textarea>
          </div>

          <!-- First Item with Reactive Toggle -->
          <div class="p-3 rounded-2xl bg-surface-container-low/60 border border-outline-variant/30 flex flex-col gap-2">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Первая задача:
            </label>
            <input
              type="text"
              [(ngModel)]="initialItemText"
              placeholder="например: Зарегистрировать сервис в Port Shield"
              class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-on-surface mt-1">
              <input
                type="checkbox"
                [(ngModel)]="initialItemIsReactive"
                class="rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span class="flex items-center gap-1">
                <span class="material-symbols-rounded text-xs text-amber-500">bolt</span>
                <span>Реактивный триггер авто-завершения</span>
              </span>
            </label>

            @if (initialItemIsReactive) {
              <select
                [(ngModel)]="initialItemTriggerType"
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface"
              >
                <option value="SERVICE_REGISTERED">SERVICE_REGISTERED (Регистрация в Port Shield)</option>
                <option value="HEALTHCHECK_PING">HEALTHCHECK_PING (Опрос здоровья PROJECTION)</option>
                <option value="WORKER_TRIGGERED">WORKER_TRIGGERED (Запуск воркера)</option>
                <option value="CIRCUIT_BREAKER">CIRCUIT_BREAKER (Срабатывание вытеснения)</option>
                <option value="PORT_SHIELD">PORT_SHIELD (Валидация пула портов)</option>
              </select>
            }
          </div>

          <!-- Color -->
          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Цвет карточки (Google Keep):
            </label>
            <div class="flex items-center gap-2">
              @for (c of availableColors; track c) {
                <button
                  type="button"
                  (click)="selectedColor = c"
                  class="w-6 h-6 rounded-full border border-black/20 dark:border-white/20 transition-transform hover:scale-125"
                  [class.ring-2]="selectedColor === c"
                  [class.ring-primary]="selectedColor === c"
                  [ngClass]="getColorDotBg(c)"
                  [title]="c"
                ></button>
              }
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <footer class="px-6 py-4 border-t border-outline-variant/20 flex items-center justify-end gap-2 bg-surface-container-low/30">
          <button
            type="button"
            (click)="onCancel()"
            class="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
          >
            Отмена
          </button>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!title.trim() || !projectId.trim()"
            class="px-5 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold shadow-xs transition-all disabled:opacity-40"
          >
            Создать TodoList
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class CreateTodoModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<
    Omit<ReactiveTodoListCard, 'id' | 'createdAt' | 'updatedAt'>
  >();

  projectId = 'workspace.core';
  title = '';
  description = '';
  initialItemText = 'Проверить готовность узлов и сервисов';
  initialItemIsReactive = true;
  initialItemTriggerType: ReactiveTriggerType = 'SERVICE_REGISTERED';
  selectedColor: LemonCardColor = 'lemon';

  readonly availableColors: LemonCardColor[] = [
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  onCancel(): void {
    this.resetState();
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.title.trim() || !this.projectId.trim()) return;

    const initialItems: ReactiveTodoItem[] = [];
    if (this.initialItemText.trim()) {
      initialItems.push({
        id: 'item-' + Math.random().toString(36).substring(2, 8),
        text: this.initialItemText.trim(),
        completed: false,
        isReactive: this.initialItemIsReactive,
        triggerType: this.initialItemIsReactive ? this.initialItemTriggerType : 'MANUAL',
        triggerDescription: this.initialItemIsReactive
          ? `Авто-триггер: ${this.initialItemTriggerType}`
          : undefined,
      });
    }

    this.create.emit({
      projectId: this.projectId.trim(),
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      color: this.selectedColor,
      isPinned: false,
      items: initialItems,
    });

    this.resetState();
  }

  private resetState(): void {
    this.projectId = 'workspace.core';
    this.title = '';
    this.description = '';
    this.initialItemText = 'Проверить готовность узлов и сервисов';
    this.initialItemIsReactive = true;
    this.initialItemTriggerType = 'SERVICE_REGISTERED';
    this.selectedColor = 'lemon';
  }

  getColorDotBg(color: LemonCardColor): string {
    switch (color) {
      case 'lemon':
        return 'bg-[#ffe176]';
      case 'amber':
        return 'bg-[#ffb74d]';
      case 'sage':
        return 'bg-[#a5d6a7]';
      case 'lavender':
        return 'bg-[#ce93d8]';
      case 'sky':
        return 'bg-[#81d4fa]';
      case 'rose':
        return 'bg-[#ef9a9a]';
      case 'slate':
        return 'bg-[#b0bec5]';
      default:
        return 'bg-[#ffffff]';
    }
  }
}
