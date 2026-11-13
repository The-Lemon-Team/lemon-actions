import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReactiveTodoListCard,
  ReactiveTriggerType,
} from '../../core/models/todo-card.models';
import { LEMON_CARD_PALETTES, LemonCardColor } from '../../core/models/worker.models';

@Component({
  selector: 'app-reactive-todo-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 border shadow-2xs hover:shadow-md"
      [ngClass]="[palette.bgClass, palette.borderClass]"
    >
      <div>
        <!-- CARD HEADER: PROJECT PILL & PIN -->
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide border border-black/5 bg-black/5 dark:bg-white/10 dark:border-white/10 text-on-surface">
            <span class="material-symbols-rounded text-sm text-primary">checklist</span>
            <span class="truncate max-w-[170px]">{{ card.projectId }}</span>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="pinToggle.emit(card.id)"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
              [class.opacity-100]="card.isPinned"
              [class.text-primary]="card.isPinned"
              [class.text-on-surface-variant]="!card.isPinned"
              [title]="card.isPinned ? 'Открепить карточку' : 'Закрепить карточку вверху'"
            >
              <span
                class="material-symbols-rounded text-lg"
                [style.font-variation-settings]="pinVariation"
              >
                push_pin
              </span>
            </button>
          </div>
        </div>

        <!-- TITLE & DESCRIPTION -->
        <div class="mb-4">
          <h3 class="font-headline-sm text-lg font-bold text-on-surface leading-snug tracking-tight mb-1">
            {{ card.title }}
          </h3>
          @if (card.description) {
            <p class="font-body-sm text-xs text-on-surface-variant/80 leading-relaxed">
              {{ card.description }}
            </p>
          }
        </div>

        <!-- PROGRESS BAR -->
        <div class="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mb-4 flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs font-bold text-on-surface">
            <span class="flex items-center gap-1.5">
              <span class="material-symbols-rounded text-sm text-emerald-600 dark:text-emerald-400">task_alt</span>
              <span>{{ completedCount }} из {{ totalCount }} выполнено</span>
            </span>
            <span class="font-mono text-xs">{{ completionPercentage }}%</span>
          </div>
          <!-- Progress Track -->
          <div class="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500 ease-out bg-emerald-500"
              [style.width.%]="completionPercentage"
            ></div>
          </div>
        </div>

        <!-- TODO ITEMS LIST -->
        <div class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          @for (item of card.items; track item.id) {
            <div
              class="group/item p-2.5 rounded-2xl transition-all border flex items-start gap-2.5"
              [class]="getItemContainerClass(item.completed)"
            >
              <!-- Checkbox button -->
              <button
                type="button"
                (click)="toggleItem.emit({ cardId: card.id, itemId: item.id })"
                class="w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                [class]="getCheckboxClass(item.completed)"
              >
                @if (item.completed) {
                  <span class="material-symbols-rounded text-sm font-bold">check</span>
                }
              </button>

              <!-- Text & Meta -->
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div
                  class="text-xs font-medium leading-snug transition-all"
                  [class.line-through]="item.completed"
                  [class.text-on-surface-variant]="item.completed"
                  [class.text-on-surface]="!item.completed"
                >
                  {{ item.text }}
                </div>

                <!-- Reactive Badge / Details -->
                <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                  @if (item.isReactive) {
                    <span
                      class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold font-mono text-[9px] bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      [title]="item.triggerDescription || 'Автоматический триггер'"
                    >
                      <span class="material-symbols-rounded text-[11px] animate-pulse">bolt</span>
                      <span>{{ item.triggerType }}</span>
                    </span>
                  }

                  @if (item.completed && item.completedBy) {
                    <span class="text-on-surface-variant/70 text-[9px] font-mono">
                      ✓ {{ item.completedBy }}
                    </span>
                  }
                </div>
              </div>

              <!-- Delete item button (hover) -->
              <button
                type="button"
                (click)="deleteItem.emit({ cardId: card.id, itemId: item.id })"
                class="w-5 h-5 rounded-md flex items-center justify-center text-on-surface-variant/50 hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover/item:opacity-100 flex-shrink-0"
                title="Удалить задачу"
              >
                <span class="material-symbols-rounded text-sm">close</span>
              </button>
            </div>
          }
        </div>

        <!-- INLINE ADD TASK FORM -->
        <div class="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between text-[11px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
            <span>Добавить задачу</span>
            <button
              type="button"
              (click)="showAddForm = !showAddForm"
              class="text-primary hover:underline lowercase font-medium flex items-center gap-0.5 cursor-pointer"
            >
              <span class="material-symbols-rounded text-xs">{{ showAddForm ? 'expand_less' : 'add' }}</span>
              <span>{{ showAddForm ? 'Скрыть' : 'Новая задача' }}</span>
            </button>
          </div>

          @if (showAddForm) {
            <div class="p-3 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-2 shadow-xs text-xs">
              <input
                type="text"
                [(ngModel)]="newItemText"
                placeholder="Текст задачи (например: Зарегистрировать аналитический сервис)..."
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div class="flex flex-col gap-1.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    [(ngModel)]="newItemIsReactive"
                    class="rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-rounded text-xs text-amber-500">bolt</span>
                    <span>Реактивный авто-триггер</span>
                  </span>
                </label>

                @if (newItemIsReactive) {
                  <select
                    [(ngModel)]="newItemTriggerType"
                    class="mt-1 px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                  >
                    <option value="SERVICE_REGISTERED">SERVICE_REGISTERED (Регистрация в Port Shield)</option>
                    <option value="HEALTHCHECK_PING">HEALTHCHECK_PING (Раунд опроса сервисов)</option>
                    <option value="WORKER_TRIGGERED">WORKER_TRIGGERED (Запуск воркера)</option>
                    <option value="CIRCUIT_BREAKER">CIRCUIT_BREAKER (Срабатывание вытеснения)</option>
                    <option value="PORT_SHIELD">PORT_SHIELD (Валидация пула портов)</option>
                  </select>
                }
              </div>

              <div class="flex items-center justify-end gap-1.5 mt-1">
                <button
                  type="button"
                  (click)="showAddForm = false"
                  class="px-2.5 py-1 text-[11px] text-on-surface-variant hover:text-on-surface"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  (click)="submitItem()"
                  [disabled]="!newItemText.trim()"
                  class="px-3 py-1 rounded-xl bg-primary-container text-on-primary-container font-bold text-[11px] disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- CARD FOOTER: SIMULATE IMPULSE, COLOR PICKER & DELETE -->
      <footer class="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
        <!-- Quick impulse test button -->
        <button
          type="button"
          (click)="onSimulateImpulse()"
          class="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-all active:scale-95"
          title="Сгенерировать реактивный импульс для тестирования авто-завершения"
        >
          <span class="material-symbols-rounded text-xs">bolt</span>
          <span>Импульс</span>
        </button>

        <div class="flex items-center gap-2">
          <!-- Color Palette Picker -->
          <div class="flex items-center gap-1">
            @for (color of availableColors; track color) {
              <button
                type="button"
                (click)="colorChange.emit({ id: card.id, color })"
                class="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 transition-transform hover:scale-125 focus:scale-125"
                [class.ring-2]="card.color === color"
                [class.ring-primary]="card.color === color"
                [ngClass]="getColorDotBg(color)"
                [title]="color"
              ></button>
            }
          </div>

          <!-- Delete Card Button -->
          <button
            type="button"
            (click)="deleteCard.emit(card.id)"
            class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Удалить карточку задач"
          >
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </footer>
    </article>
  `,
})
export class ReactiveTodoCardComponent {
  @Input({ required: true }) card!: ReactiveTodoListCard;

  @Output() pinToggle = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{ id: string; color: LemonCardColor }>();
  @Output() deleteCard = new EventEmitter<string>();
  @Output() toggleItem = new EventEmitter<{ cardId: string; itemId: string }>();
  @Output() deleteItem = new EventEmitter<{ cardId: string; itemId: string }>();
  @Output() addItem = new EventEmitter<{
    cardId: string;
    item: {
      text: string;
      isReactive: boolean;
      triggerType?: ReactiveTriggerType;
      triggerDescription?: string;
    };
  }>();
  @Output() simulateImpulse = new EventEmitter<ReactiveTriggerType>();

  showAddForm = false;
  newItemText = '';
  newItemIsReactive = true;
  newItemTriggerType: ReactiveTriggerType = 'SERVICE_REGISTERED';

  readonly availableColors: LemonCardColor[] = [
    'default',
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  get palette() {
    return LEMON_CARD_PALETTES[this.card.color] || LEMON_CARD_PALETTES.default;
  }

  get pinVariation(): string {
    return this.card.isPinned ? "'FILL' 1" : "'FILL' 0";
  }

  get totalCount(): number {
    return this.card.items.length;
  }

  get completedCount(): number {
    return this.card.items.filter((i) => i.completed).length;
  }

  get completionPercentage(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  submitItem(): void {
    if (!this.newItemText.trim()) return;
    this.addItem.emit({
      cardId: this.card.id,
      item: {
        text: this.newItemText.trim(),
        isReactive: this.newItemIsReactive,
        triggerType: this.newItemIsReactive ? this.newItemTriggerType : undefined,
        triggerDescription: this.newItemIsReactive
          ? `Авто-триггер: ${this.newItemTriggerType}`
          : undefined,
      },
    });
    this.newItemText = '';
    this.showAddForm = false;
  }

  onSimulateImpulse(): void {
    // Pick first uncompleted reactive trigger if available, else WORKER_TRIGGERED
    const pendingReactive = this.card.items.find((i) => !i.completed && i.isReactive);
    const trigger = pendingReactive?.triggerType || 'WORKER_TRIGGERED';
    this.simulateImpulse.emit(trigger);
  }

  getItemContainerClass(completed: boolean): string {
    return completed
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5';
  }

  getCheckboxClass(completed: boolean): string {
    return completed
      ? 'border-primary bg-primary text-on-primary'
      : 'border-black/30 dark:border-white/30 hover:border-primary';
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
