import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LEMON_CARD_PALETTES,
  LemonCardColor,
  LemonWorkerCard,
} from '../../core/models/worker.models';
import { StreamChipComponent } from './stream-chip.component';

@Component({
  selector: 'app-lemon-worker-card',
  standalone: true,
  imports: [CommonModule, StreamChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative flex flex-col justify-between rounded-3xl p-6 border transition-all duration-300 select-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5"
      [ngClass]="[palette.bgClass, palette.borderClass]"
      [class.opacity-60]="worker.status === 'PAUSED'"
      [class.ring-2]="isExecuting"
      [class.ring-primary]="isExecuting"
    >
      <!-- CARD TOP HEADER -->
      <div class="flex items-center justify-between gap-3 mb-4">
        <!-- Neuron Folder Badge -->
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-black/30 border border-black/[0.06] text-xs font-medium text-on-surface-variant truncate max-w-[240px] shadow-2xs backdrop-blur-xs"
          [title]="'Целевой Нейрон: ' + worker.neuronPath"
        >
          <span class="material-symbols-rounded text-sm text-primary/80">folder</span>
          <span class="truncate font-label-code-sm">{{ worker.neuronPath }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- Live Status Indicator -->
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-label-code-sm shadow-2xs"
            [ngClass]="statusBadgeClass"
          >
            <span
              class="w-2 h-2 rounded-full"
              [class.bg-emerald-500]="worker.status === 'LISTENING' || worker.status === 'RUNNING'"
              [class.animate-ping]="isExecuting"
              [class.bg-amber-500]="worker.status === 'CIRCUIT_OPEN'"
              [class.bg-slate-400]="worker.status === 'IDLE' || worker.status === 'PAUSED'"
            ></span>
            <span>{{ isExecuting ? 'Выполняется...' : worker.status }}</span>
          </div>

          <!-- Pin Button (Keep style) -->
          <button
            type="button"
            (click)="pinToggle.emit(worker.id)"
            class="w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            [class.opacity-100]="worker.isPinned"
            [class.text-primary]="worker.isPinned"
            [class.text-on-surface-variant]="!worker.isPinned"
            [title]="worker.isPinned ? 'Открепить карточку' : 'Закрепить карточку вверху'"
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
      <div class="mb-5">
        <h3 class="font-headline-sm text-lg font-bold text-on-surface leading-snug tracking-tight mb-1.5">
          {{ worker.name }}
        </h3>
        @if (worker.description) {
          <p class="font-body-sm text-xs text-on-surface-variant/80 leading-relaxed">
            {{ worker.description }}
          </p>
        }
      </div>

      <!-- TCA PIPELINE (Светлая, воздушная цепочка "Когда -> Если -> Что") -->
      <div class="my-1 flex flex-col gap-2.5 relative">
        <!-- КОГДА (Trigger) -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 w-16 flex-shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500/80"></span>
            <span class="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Когда</span>
          </div>
          <div class="flex-1 min-w-0">
            <app-stream-chip [trigger]="worker.rule.trigger" />
          </div>
        </div>

        <!-- ЕСЛИ (Condition) -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 w-16 flex-shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500/80"></span>
            <span class="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Если</span>
          </div>
          <div class="flex-1 min-w-0">
            @if (worker.rule.condition) {
              <app-stream-chip [condition]="worker.rule.condition" />
            } @else {
              <span class="text-xs text-on-surface-variant/60 font-medium italic">⚡ Без условий (всегда)</span>
            }
          </div>
        </div>

        <!-- ЧТО (Action) -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 w-16 flex-shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-primary/80"></span>
            <span class="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Что</span>
          </div>
          <div class="flex-1 min-w-0">
            <app-stream-chip [action]="worker.rule.action" />
          </div>
        </div>
      </div>

      <!-- EXECUTION CHRONICLE (Минималистичная строчка последнего ответа) -->
      @if (worker.lastExecution; as exec) {
        <div
          class="mt-5 mb-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-black/25 border border-black/[0.05] text-[11px] font-label-code-sm flex items-center justify-between gap-3 shadow-2xs backdrop-blur-xs"
          [title]="exec.outputSummary || 'Нет деталей'"
        >
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              [class.bg-emerald-500]="exec.status === 'SUCCESS'"
              [class.bg-rose-500]="exec.status === 'FAILURE'"
              [class.bg-amber-400]="exec.status === 'SKIPPED'"
            ></span>
            <span class="truncate text-on-surface-variant/90 font-medium">
              {{ exec.outputSummary }}
            </span>
          </div>
          <span class="text-[10px] text-on-surface-variant/70 flex-shrink-0 font-bold">
            {{ exec.durationMs }}ms
          </span>
        </div>
      }

      <!-- CARD FOOTER -->
      <div class="pt-4 mt-3 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08]">
        <!-- Telemetry Stats -->
        <div class="text-[11px] font-label-code-sm text-on-surface-variant/70 flex items-center gap-2">
          <span [title]="'Всего запусков: ' + worker.telemetry.totalRuns">
            ⚡ {{ worker.telemetry.totalRuns }} запусков
          </span>
          @if ((worker.telemetry.averageDurationMs ?? 0) > 0) {
            <span>• ~{{ worker.telemetry.averageDurationMs }}ms</span>
          }
        </div>

        <!-- Action Controls -->
        <div class="flex items-center gap-1.5">
          <!-- Color Palette Picker (Keep Style) -->
          <div class="relative group/color">
            <button
              type="button"
              class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Изменить цвет карточки"
            >
              <span class="material-symbols-rounded text-base">palette</span>
            </button>

            <!-- Palette Dropdown -->
            <div
              class="hidden group-hover/color:flex absolute bottom-8 right-0 p-2 rounded-2xl bg-surface-container-lowest shadow-xl border border-outline-variant/30 gap-1.5 z-30"
            >
              @for (colorName of availableColors; track colorName) {
                <button
                  type="button"
                  (click)="colorChange.emit({ id: worker.id, color: colorName })"
                  class="w-5 h-5 rounded-full border border-black/15 hover:scale-125 transition-transform"
                  [ngClass]="getColorDotBg(colorName)"
                  [title]="colorName"
                ></button>
              }
            </div>
          </div>

          <!-- Pause/Resume Toggle -->
          <button
            type="button"
            (click)="pauseToggle.emit(worker.id)"
            class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            [title]="worker.status === 'PAUSED' ? 'Возобновить воркер' : 'Поставить на паузу'"
          >
            <span class="material-symbols-rounded text-base">
              {{ worker.status === 'PAUSED' ? 'play_arrow' : 'pause' }}
            </span>
          </button>

          <!-- Primary Trigger Button (▶ Запуск) -->
          <button
            type="button"
            (click)="triggerNow.emit(worker.id)"
            [disabled]="isExecuting || worker.status === 'PAUSED'"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold font-headline-sm shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ml-1"
            title="Запустить действие немедленно"
          >
            @if (isExecuting) {
              <span class="material-symbols-rounded text-sm animate-spin">refresh</span>
            } @else {
              <span class="material-symbols-rounded text-sm">play_arrow</span>
            }
            <span>Запуск</span>
          </button>

          <!-- Delete Card -->
          <button
            type="button"
            (click)="deleteCard.emit(worker.id)"
            class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100"
            title="Удалить карточку"
          >
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </div>
    </article>
  `,
})
export class LemonWorkerCardComponent {
  @Input({ required: true }) worker!: LemonWorkerCard;
  @Input() isExecuting = false;

  @Output() pinToggle = new EventEmitter<string>();
  @Output() pauseToggle = new EventEmitter<string>();
  @Output() triggerNow = new EventEmitter<string>();
  @Output() deleteCard = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{ id: string; color: LemonCardColor }>();

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
    return LEMON_CARD_PALETTES[this.worker.color] || LEMON_CARD_PALETTES.default;
  }

  get pinVariation(): string {
    return this.worker.isPinned ? "'FILL' 1" : "'FILL' 0";
  }

  get statusBadgeClass(): string {
    switch (this.worker.status) {
      case 'LISTENING':
      case 'RUNNING':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
      case 'CIRCUIT_OPEN':
      case 'FAILED':
        return 'bg-rose-500/15 text-rose-800 dark:text-rose-300';
      case 'PAUSED':
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-400';
      default:
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
    }
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
