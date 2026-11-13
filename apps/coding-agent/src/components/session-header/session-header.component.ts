import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-session-header',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="flex items-start sm:items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 shadow-sm relative">
          <span class="material-symbols-rounded text-3xl" style="font-variation-settings: 'FILL' 1">psychology</span>
          @if ((facade.activeSession$ | async); as s) {
            <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary"></span>
            </span>
          }
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="font-headline-sm text-xl font-bold text-on-surface">
              Lemon Antigravity · Монитор Кодинг-Агента
            </h1>
            @if (facade.activeSession$ | async; as s) {
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-container text-on-success-container">
                <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                <span>Сессия: {{ s.sessionId.slice(-8) }}</span>
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-surface-container-high text-on-surface-variant font-medium">
                {{ s.repoName }}
              </span>
            } @else {
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">
                Ожидание сессии
              </span>
            }
          </div>

          <p class="font-body-sm text-xs text-on-surface-variant mt-1.5 max-w-2xl">
            Выделенное рабочее место кодинг-агента. Управление сессиями, фиксация выжимок за день (EOD коммит),
            запись архитектурных решений и оптимизация нагрузки реактивных потоков Core Combinator.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
        <button
          type="button"
          (click)="facade.startSession()"
          [disabled]="(facade.isLoading$ | async) ?? false"
          class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-all shadow-xs"
        >
          <span class="material-symbols-rounded text-base">play_arrow</span>
          <span>Запустить сессию</span>
        </button>

        <button
          type="button"
          (click)="openCommitModal.emit()"
          [disabled]="(facade.isLoading$ | async) ?? false"
          class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-xs hover:opacity-90 transition-all shadow-xs"
        >
          <span class="material-symbols-rounded text-base">fact_check</span>
          <span>Коммит в конце дня</span>
        </button>

        <button
          type="button"
          (click)="openDecisionModal.emit()"
          class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs hover:bg-surface-container-highest transition-all"
        >
          <span class="material-symbols-rounded text-base">lightbulb</span>
          <span>Записать решение</span>
        </button>

        <button
          type="button"
          (click)="facade.runDataMigration()"
          title="Запустить миграцию и сжатие старых логов"
          class="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all text-xs"
        >
          <span class="material-symbols-rounded text-base">auto_fix_high</span>
          <span>Миграция</span>
        </button>

        <button
          type="button"
          (click)="facade.refresh()"
          title="Обновить данные"
          class="p-2.5 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
        >
          <span class="material-symbols-rounded text-base">refresh</span>
        </button>
      </div>
    </header>
  `,
})
export class SessionHeaderComponent {
  protected readonly facade = inject(CodingAgentFacade);
  @Output() readonly openCommitModal = new EventEmitter<void>();
  @Output() readonly openDecisionModal = new EventEmitter<void>();
}
