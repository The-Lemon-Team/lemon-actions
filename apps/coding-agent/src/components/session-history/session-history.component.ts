import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
            <span class="material-symbols-rounded text-lg">history</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              История Сессий Кодинга
            </h2>
            <p class="font-body-sm text-[11px] text-on-surface-variant">
              Хроника запусков клиентов, жизненный цикл и метрики работы
            </p>
          </div>
        </div>

        <span class="text-xs font-semibold text-on-surface-variant">
          Всего событий: {{ (facade.history$ | async)?.length || 0 }}
        </span>
      </div>

      <!-- Active Sessions & Event Log -->
      <div class="space-y-2">
        @if ((facade.history$ | async); as events) {
          @if (events.length === 0) {
            <div class="p-6 text-center text-xs text-on-surface-variant italic rounded-2xl bg-surface-container-low border border-outline-variant/15">
              Сессий пока не зафиксировано. Нажмите «Запустить сессию» в шапке.
            </div>
          }
          @for (e of events; track e.id) {
            <div class="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  [class.bg-primary]="e.eventType === 'DAILY_DIGEST_COMMITTED'"
                  [class.bg-tertiary]="e.eventType === 'AGENT_SESSION_INIT'"
                  [class.bg-secondary]="e.eventType === 'AGENT_DECISION'"
                ></span>

                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-on-surface font-mono">{{ e.eventType }}</span>
                    @if (e.payload?.sessionId) {
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                        {{ e.payload.sessionId.slice(-8) }}
                      </span>
                    }
                  </div>
                  <p class="text-[11px] text-on-surface-variant truncate mt-0.5">
                    {{ e.payload?.title || e.payload?.agentRole || e.payload?.commitMessage || 'Событие агента' }}
                  </p>
                </div>
              </div>

              <div class="text-[11px] font-mono text-on-surface-variant flex-shrink-0">
                {{ e.createdAt | date:'dd.MM.yyyy HH:mm:ss' }}
              </div>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class SessionHistoryComponent {
  protected readonly facade = inject(CodingAgentFacade);
}
