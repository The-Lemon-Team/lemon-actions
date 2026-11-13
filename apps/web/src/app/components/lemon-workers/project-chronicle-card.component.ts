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
  ChronicleEventType,
  ProjectChronicleCard,
  ProjectSessionLogEntry,
} from '../../core/models/chronicle-card.models';
import { LEMON_CARD_PALETTES, LemonCardColor } from '../../core/models/worker.models';

@Component({
  selector: 'app-project-chronicle-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 border shadow-2xs hover:shadow-md"
      [ngClass]="[palette.bgClass, palette.borderClass]"
    >
      <!-- CARD HEADER: NEURON PATH, STATS & ACTIONS -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <!-- Folder / Neuron Pill -->
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide border border-black/5 bg-black/5 dark:bg-white/10 dark:border-white/10 text-on-surface">
            <span class="material-symbols-rounded text-sm text-primary">folder</span>
            <span class="truncate max-w-[170px]">{{ card.projectId }}</span>
          </div>

          <!-- Pin & Controls -->
          <div class="flex items-center gap-1">
            <!-- Pin Button (Keep style) -->
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
            {{ card.projectName }}
          </h3>
          <p class="font-body-sm text-xs text-on-surface-variant/80 leading-relaxed">
            {{ card.description }}
          </p>
        </div>

        <!-- TAGS ROW -->
        @if (card.tags && card.tags.length > 0) {
          <div class="flex flex-wrap gap-1.5 mb-4">
            @for (tag of card.tags; track tag) {
              <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-black/5 dark:bg-white/10 text-on-surface-variant">
                #{{ tag }}
              </span>
            }
          </div>
        }

        <!-- METRICS ROW -->
        <div class="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mb-4 text-center">
          <div class="flex flex-col">
            <span class="font-headline-sm text-sm font-bold text-on-surface">{{ card.metrics.totalRuns }}</span>
            <span class="text-[10px] text-on-surface-variant">Запусков</span>
          </div>
          <div class="flex flex-col border-x border-black/10 dark:border-white/10">
            <span class="font-headline-sm text-sm font-bold text-emerald-600 dark:text-emerald-400">{{ card.metrics.healthyServices }}</span>
            <span class="text-[10px] text-on-surface-variant">Сервисов</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline-sm text-sm font-bold text-primary">{{ card.metrics.activeWorkers }}</span>
            <span class="text-[10px] text-on-surface-variant">Воркеров</span>
          </div>
        </div>

        <!-- CHRONICLE TIMELINE (Latest Session Logs) -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-[11px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
            <span class="flex items-center gap-1">
              <span class="material-symbols-rounded text-sm">history_edu</span>
              <span>Хроника сессий ({{ card.history.length }})</span>
            </span>
            <button
              type="button"
              (click)="showAddLog = !showAddLog"
              class="text-primary hover:underline lowercase font-medium flex items-center gap-0.5 cursor-pointer"
            >
              <span class="material-symbols-rounded text-xs">{{ showAddLog ? 'expand_less' : 'add' }}</span>
              <span>{{ showAddLog ? 'Скрыть' : 'Добавить запись' }}</span>
            </button>
          </div>

          <!-- Inline Add Log Form -->
          @if (showAddLog) {
            <div class="p-3 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-2 shadow-xs my-1 text-xs">
              <input
                type="text"
                [(ngModel)]="newLogTitle"
                placeholder="Заголовок события (например: Выпущен релиз v1.3)..."
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <textarea
                [(ngModel)]="newLogDetails"
                rows="2"
                placeholder="Подробности сессии или действия агента..."
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              ></textarea>
              <div class="flex items-center justify-between gap-2">
                <select
                  [(ngModel)]="newLogType"
                  class="px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                >
                  <option value="NOTE">Заметка (NOTE)</option>
                  <option value="MILESTONE">Веха (MILESTONE)</option>
                  <option value="DEPLOY">Деплой (DEPLOY)</option>
                  <option value="WORKER_RUN">Запуск (WORKER)</option>
                  <option value="SERVICE_EVENT">Сервис (SERVICE)</option>
                </select>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="showAddLog = false"
                    class="px-2 py-1 text-[11px] text-on-surface-variant hover:text-on-surface"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    (click)="submitLog()"
                    [disabled]="!newLogTitle.trim()"
                    class="px-3 py-1 rounded-xl bg-primary-container text-on-primary-container font-bold text-[11px] disabled:opacity-40"
                  >
                    Записать
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Log Items List (max 4 visible, scrollable if more) -->
          <div class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            @for (log of card.history; track log.id) {
              <div class="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-1 transition-all hover:bg-black/10">
                <div class="flex items-center justify-between gap-1 text-[10px]">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="px-1.5 py-0.2 rounded-md font-bold font-mono uppercase text-[9px]"
                      [ngClass]="getLogBadgeClass(log.type)"
                    >
                      {{ log.type }}
                    </span>
                    <span class="font-bold text-on-surface truncate max-w-[120px]">{{ log.author }}</span>
                  </div>
                  <span class="text-on-surface-variant font-mono text-[9px]">
                    {{ formatTimestamp(log.timestamp) }}
                  </span>
                </div>
                <div class="text-xs font-semibold text-on-surface leading-tight">
                  {{ log.title }}
                </div>
                @if (log.details) {
                  <div class="text-[11px] text-on-surface-variant/80 leading-normal">
                    {{ log.details }}
                  </div>
                }
                @if (log.latencyMs) {
                  <div class="text-[10px] text-on-surface-variant/70 font-mono">
                    ⚡ Задержка: {{ log.latencyMs }}ms
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- CARD FOOTER: COLOR PICKER & DELETE -->
      <footer class="mt-5 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-1 text-[11px] text-on-surface-variant">
          <span class="material-symbols-rounded text-xs">update</span>
          <span>{{ card.metrics.lastActivity }}</span>
        </div>

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
            title="Удалить карточку проекта"
          >
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </footer>
    </article>
  `,
})
export class ProjectChronicleCardComponent {
  @Input({ required: true }) card!: ProjectChronicleCard;

  @Output() pinToggle = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{ id: string; color: LemonCardColor }>();
  @Output() deleteCard = new EventEmitter<string>();
  @Output() addLog = new EventEmitter<{
    cardId: string;
    entry: Omit<ProjectSessionLogEntry, 'id' | 'timestamp'>;
  }>();

  showAddLog = false;
  newLogTitle = '';
  newLogDetails = '';
  newLogType: ChronicleEventType = 'NOTE';

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

  submitLog(): void {
    if (!this.newLogTitle.trim()) return;
    this.addLog.emit({
      cardId: this.card.id,
      entry: {
        type: this.newLogType,
        author: 'Developer',
        title: this.newLogTitle.trim(),
        details: this.newLogDetails.trim() || undefined,
      },
    });
    this.newLogTitle = '';
    this.newLogDetails = '';
    this.showAddLog = false;
  }

  getLogBadgeClass(type: ChronicleEventType): string {
    switch (type) {
      case 'DEPLOY':
        return 'bg-purple-500/20 text-purple-800 dark:text-purple-300';
      case 'MILESTONE':
        return 'bg-amber-500/20 text-amber-800 dark:text-amber-300';
      case 'WORKER_RUN':
        return 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300';
      case 'SERVICE_EVENT':
        return 'bg-sky-500/20 text-sky-800 dark:text-sky-300';
      case 'CIRCUIT_BREAKER':
        return 'bg-rose-500/20 text-rose-800 dark:text-rose-300';
      default:
        return 'bg-slate-500/20 text-slate-800 dark:text-slate-300';
    }
  }

  formatTimestamp(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
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
