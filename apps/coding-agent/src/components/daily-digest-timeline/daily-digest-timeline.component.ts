import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { DailyDigestSnapshot } from '../../core/models/agent.models';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-daily-digest-timeline',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
            <span class="material-symbols-rounded text-lg">calendar_month</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              Выжимки за День · EOD Commits
            </h2>
            <p class="font-body-sm text-[11px] text-on-surface-variant">
              Зафиксированные срезы работы агента, списки решенных задач и коммиты в конце рабочего дня
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="openCommitModal.emit()"
          class="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-95 transition-all shadow-xs flex items-center gap-1"
        >
          <span class="material-symbols-rounded text-base">add_task</span>
          <span>Создать срез за день</span>
        </button>
      </div>

      <!-- Today's Digest Spotlight -->
      @if (facade.todayDigest$ | async; as today) {
        <div class="p-5 rounded-2xl bg-surface-container-low border border-primary/30 relative overflow-hidden">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-on-primary">
                Сегодня: {{ today.date }}
              </span>
              @if (today.commitHash) {
                <span class="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant font-semibold">
                  commit: {{ today.commitHash }}
                </span>
              }
            </div>

            <div class="flex items-center gap-3 text-xs text-on-surface-variant">
              <span>Задач выполнено: <strong class="text-on-surface">{{ today.tasksCompleted.length }}</strong></span>
              <span>Решений: <strong class="text-on-surface">{{ today.decisions.length }}</strong></span>
            </div>
          </div>

          <div class="mt-3">
            <div class="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono bg-surface-container-lowest/80 p-3.5 rounded-xl border border-outline-variant/15">
              {{ today.markdownSummary }}
            </div>
          </div>
        </div>
      }

      <!-- Past Digests Timeline -->
      <div class="flex flex-col gap-3 mt-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          История прошлых выжимок (Timeline History)
        </h3>

        @if ((facade.dailyDigests$ | async); as digests) {
          @if (digests.length === 0) {
            <div class="p-6 text-center text-xs text-on-surface-variant italic rounded-2xl bg-surface-container-low border border-outline-variant/15">
              История выжимок пока пуста. Зафиксируйте первый срез дня кнопкой "Создать срез за день".
            </div>
          }
          @for (d of digests; track d.digestId) {
            <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-3 transition-all hover:border-primary/40">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-rounded text-primary text-lg">verified</span>
                  <span class="font-bold text-xs text-on-surface">{{ d.date }}</span>
                  <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                    {{ d.commitHash || 'snapshot' }}
                  </span>
                </div>

                <button
                  type="button"
                  (click)="toggleExpand(d.digestId)"
                  class="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <span>{{ isExpanded(d.digestId) ? 'Свернуть' : 'Подробнее' }}</span>
                  <span class="material-symbols-rounded text-sm">
                    {{ isExpanded(d.digestId) ? 'expand_less' : 'expand_more' }}
                  </span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                <span>Задач: <strong class="text-on-surface">{{ d.tasksCompleted.length }}</strong></span>
                <span>•</span>
                <span>Архитектурных решений: <strong class="text-on-surface">{{ d.decisions.length }}</strong></span>
                <span>•</span>
                <span>Зафиксировано: {{ d.generatedAt | date:'HH:mm' }}</span>
              </div>

              @if (isExpanded(d.digestId)) {
                <div class="mt-1 pt-3 border-t border-outline-variant/15 text-xs font-mono whitespace-pre-wrap bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                  {{ d.markdownSummary }}
                </div>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class DailyDigestTimelineComponent {
  protected readonly facade = inject(CodingAgentFacade);
  @Output() readonly openCommitModal = new EventEmitter<void>();

  private readonly expandedIds = signal<Set<string>>(new Set<string>());

  toggleExpand(id: string): void {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expandedIds.set(s);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }
}
