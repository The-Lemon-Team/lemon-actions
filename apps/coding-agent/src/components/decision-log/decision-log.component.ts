import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-decision-log',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
            <span class="material-symbols-rounded text-lg">psychology_alt</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              Архитектурные Решения (Coding Memory)
            </h2>
            <p class="font-body-sm text-[11px] text-on-surface-variant">
              Зафиксированные решения агента, аргументация и проектные паттерны
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="openDecisionModal.emit()"
          class="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-all flex items-center gap-1"
        >
          <span class="material-symbols-rounded text-base">add</span>
          <span>Новое решение</span>
        </button>
      </div>

      <div class="space-y-3">
        @if ((facade.decisions$ | async); as decisions) {
          @if (decisions.length === 0) {
            <div class="p-6 text-center text-xs text-on-surface-variant italic rounded-2xl bg-surface-container-low border border-outline-variant/15">
              Архитектурных решений пока не сохранено.
            </div>
          }
          @for (d of decisions; track d.decisionId) {
            <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-base">💡</span>
                  <span class="font-bold text-xs text-on-surface">{{ d.title }}</span>
                </div>
                <span class="font-mono text-[10px] text-on-surface-variant">
                  {{ d.timestamp | date:'dd.MM.yyyy HH:mm' }}
                </span>
              </div>

              <p class="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                {{ d.rationaleMarkdown }}
              </p>

              @if (d.tags && d.tags.length > 0) {
                <div class="flex flex-wrap gap-1.5 mt-1">
                  @for (t of d.tags; track t) {
                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant font-medium">
                      #{{ t }}
                    </span>
                  }
                </div>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class DecisionLogComponent {
  protected readonly facade = inject(CodingAgentFacade);
  @Output() readonly openDecisionModal = new EventEmitter<void>();
}
