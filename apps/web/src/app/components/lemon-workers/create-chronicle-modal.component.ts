import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { ProjectChronicleCard } from '../../core/models/chronicle-card.models';
import { LemonCardColor } from '../../core/models/worker.models';

@Component({
  selector: 'app-create-chronicle-modal',
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
      aria-labelledby="create-chronicle-title"
    >
      <div
        class="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden my-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- HEADER -->
        <header class="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
              <span class="material-symbols-rounded text-lg">history_edu</span>
            </div>
            <div>
              <h2 id="create-chronicle-title" class="font-headline-sm text-base font-bold text-on-surface">
                Новая карточка хроники проекта
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Сохраняйте историю сессий, контрольные точки и метрики по нейрону
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
          <!-- Project ID & Name -->
          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Нейрон / Папка проекта:
            </label>
            <input
              type="text"
              [(ngModel)]="projectId"
              placeholder="например: workspace.analytics"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Название проекта:
            </label>
            <input
              type="text"
              [(ngModel)]="projectName"
              placeholder="например: Аналитика и Сбор Метрик"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Описание проекта:
            </label>
            <textarea
              [(ngModel)]="description"
              rows="2"
              placeholder="Краткое описание назначения и ключевых компонентов..."
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            ></textarea>
          </div>

          <!-- Tags -->
          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Теги (через запятую):
            </label>
            <input
              type="text"
              [(ngModel)]="tagsInput"
              placeholder="ANALYTICS, CRON, PROD"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
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
            [disabled]="!projectName.trim() || !projectId.trim()"
            class="px-5 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold shadow-xs transition-all disabled:opacity-40"
          >
            Создать хронику
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class CreateChronicleModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<
    Omit<ProjectChronicleCard, 'id' | 'createdAt' | 'updatedAt'>
  >();

  projectId = '';
  projectName = '';
  description = '';
  tagsInput = '';
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
    if (!this.projectName.trim() || !this.projectId.trim()) return;

    const tags = this.tagsInput
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    this.create.emit({
      projectId: this.projectId.trim(),
      projectName: this.projectName.trim(),
      description: this.description.trim(),
      color: this.selectedColor,
      isPinned: false,
      tags,
      metrics: {
        totalRuns: 0,
        healthyServices: 0,
        activeWorkers: 0,
        lastActivity: 'Только что создана',
      },
      history: [
        {
          id: 'log-init',
          timestamp: new Date().toISOString(),
          type: 'MILESTONE',
          author: 'Developer',
          title: 'Карточка хроники создана',
          details: `Инициализирована хроника для нейрона ${this.projectId.trim()}`,
        },
      ],
    });

    this.resetState();
  }

  private resetState(): void {
    this.projectId = '';
    this.projectName = '';
    this.description = '';
    this.tagsInput = '';
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
