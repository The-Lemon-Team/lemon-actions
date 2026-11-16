import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AppRunEndReason,
  MachineRunStats,
  ProjectariumAnalytics,
} from '../../core/models/project-stand.models';

/**
 * Presentational view for multi-machine Projectarium run telemetry (PC-1, PC-2, Production).
 */
@Component({
  selector: 'app-projectarium-analytics',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-5" data-testid="projectarium-analytics-panel">
      <!-- HEADER & WINDOW CONTROLS -->
      <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-rounded text-xl">monitoring</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Статистика запусков по компьютерам и стендам
            </h2>
            <p class="text-xs text-on-surface-variant">
              Сводная телеметрия с ПК-1, ПК-2 и Production-кластера без раскрытия чужих localhost-ссылок
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          @for (days of windowOptions; track days) {
            <button
              type="button"
              (click)="daysChange.emit(days)"
              class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer"
              [class]="getWindowBtnClass(selectedDays === days)"
            >
              {{ days }} дн.
            </button>
          }

          <button
            type="button"
            (click)="refresh.emit()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">refresh</span>
            <span>Обновить</span>
          </button>
        </div>
      </div>

      @if (analytics) {
        <!-- TOP KPI CARDS -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
            <span class="text-[11px] font-mono text-on-surface-variant">Всего запусков</span>
            <span class="text-2xl font-bold font-mono text-on-surface">{{ analytics.totalRuns }}</span>
            <span class="text-[10px] text-on-surface-variant">за {{ analytics.windowDays }} дней</span>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
            <span class="text-[11px] font-mono text-on-surface-variant">Активно сейчас</span>
            <span class="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {{ analytics.activeRuns }}
            </span>
            <span class="text-[10px] text-on-surface-variant">живых сессий</span>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
            <span class="text-[11px] font-mono text-on-surface-variant">Суммарное время</span>
            <span class="text-2xl font-bold font-mono text-primary">
              {{ formatDuration(analytics.totalDurationSec) }}
            </span>
            <span class="text-[10px] text-on-surface-variant">аптайм всех запусков</span>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
            <span class="text-[11px] font-mono text-on-surface-variant">Компьютеры / Хосты</span>
            <span class="text-2xl font-bold font-mono text-on-surface">{{ analytics.machines.length }}</span>
            <span class="text-[10px] text-on-surface-variant">учтено в статистике</span>
          </div>
        </div>

        <!-- PER-MACHINE BREAKDOWN -->
        <div class="flex flex-col gap-3">
          <h3 class="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-primary">devices</span>
            <span>Активность по компьютерам (ПК-1 / ПК-2 / Серверы)</span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (machine of analytics.machines; track machine.machineId) {
              <article class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
                      <span class="material-symbols-rounded text-lg">{{ getMachineIcon(machine) }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-sm text-on-surface truncate">{{ machine.machineName }}</div>
                      <div class="font-mono text-[10px] text-on-surface-variant truncate">{{ machine.machineId }}</div>
                    </div>
                  </div>

                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0"
                    [class]="getActiveBadgeClass(machine.activeCount)"
                  >
                    {{ machine.activeCount }} онлайн
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-xs font-mono">
                  <div>
                    <div class="text-[10px] text-on-surface-variant">Запусков</div>
                    <div class="font-bold text-on-surface">{{ machine.totalRuns }}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-on-surface-variant">Время работы</div>
                    <div class="font-bold text-primary">{{ formatDuration(machine.totalDurationSec) }}</div>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="text-[10px] font-bold uppercase text-on-surface-variant">Топ приложений на машине</span>
                  @for (app of machine.topApps; track app.standSlug + ':' + app.appName) {
                    <div class="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                      <div class="flex flex-col min-w-0">
                        <span class="font-semibold text-on-surface truncate">{{ app.appName }}</span>
                        <span class="text-[10px] font-mono text-on-surface-variant truncate">{{ app.standName }}</span>
                      </div>
                      <div class="flex items-center gap-2 font-mono text-[10px] flex-shrink-0">
                        <span class="font-bold text-on-surface">{{ app.runs }}x</span>
                        <span class="text-on-surface-variant">{{ formatDuration(app.totalDurationSec) }}</span>
                      </div>
                    </div>
                  } @empty {
                    <div class="text-[11px] text-on-surface-variant">Нет запусков за период</div>
                  }
                </div>

                @if (machine.lastActiveAt) {
                  <div class="text-[10px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/20">
                    Последняя активность: {{ formatTimestamp(machine.lastActiveAt) }}
                  </div>
                }
              </article>
            } @empty {
              <div class="col-span-full p-8 text-center rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/40 text-xs text-on-surface-variant">
                Пока нет зарегистрированных запусков за выбранный период
              </div>
            }
          </div>
        </div>

        <!-- TOP APPS & RECENT RUNS -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- TOP APPS -->
          <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <h3 class="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-rounded text-base text-primary">leaderboard</span>
              <span>Популярные приложения (все машины)</span>
            </h3>
            <div class="flex flex-col gap-2">
              @for (item of analytics.topApps; track item.standSlug + ':' + item.appName) {
                <div class="p-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between gap-2 text-xs">
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-on-surface truncate">{{ item.appName }}</span>
                    <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-on-surface-variant">
                      <span>{{ item.standName }}</span>
                      <span>·</span>
                      <span>{{ item.machines.join(', ') }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 font-mono text-[11px] flex-shrink-0">
                    @if (item.activeCount > 0) {
                      <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        {{ item.activeCount }} live
                      </span>
                    }
                    <span class="font-bold text-on-surface">{{ item.totalRuns }} запусков</span>
                    <span class="text-on-surface-variant">{{ formatDuration(item.totalDurationSec) }}</span>
                  </div>
                </div>
              } @empty {
                <div class="text-xs text-on-surface-variant p-3 text-center">Данных пока нет</div>
              }
            </div>
          </div>

          <!-- RECENT RUNS -->
          <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <h3 class="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-rounded text-base text-primary">history</span>
              <span>Последние сессии запусков</span>
            </h3>
            <div class="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1">
              @for (run of analytics.recentRuns; track run.id) {
                <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between gap-2 text-xs">
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-on-surface truncate">{{ run.appName }}</span>
                      <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface-container text-on-surface-variant">
                        {{ run.machineName }}
                      </span>
                    </div>
                    <span class="text-[10px] font-mono text-on-surface-variant truncate">
                      {{ run.standName }} · :{{ run.port }} · {{ run.networkMode }} · {{ formatTimestamp(run.startedAt) }}
                    </span>
                  </div>
                  <div class="flex flex-col items-end gap-0.5 font-mono text-[10px] flex-shrink-0">
                    <span class="px-1.5 py-0.5 rounded font-bold" [class]="getRunStatusClass(run.endReason)">
                      {{ run.endReason }}
                    </span>
                    <span class="text-on-surface-variant">{{ formatDuration(run.durationSec) }}</span>
                  </div>
                </div>
              } @empty {
                <div class="text-xs text-on-surface-variant p-3 text-center">Сессий пока нет</div>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="p-10 text-center rounded-2xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant">
          Загрузка статистики запусков...
        </div>
      }
    </section>
  `,
})
export class ProjectariumAnalyticsComponent {
  @Input() analytics: ProjectariumAnalytics | null = null;
  @Input() selectedDays = 30;

  @Output() daysChange = new EventEmitter<number>();
  @Output() refresh = new EventEmitter<void>();

  readonly windowOptions = [7, 30, 90];

  getWindowBtnClass(active: boolean): string {
    return active
      ? 'bg-primary-container text-on-primary-container border-primary'
      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface';
  }

  getMachineIcon(machine: MachineRunStats): string {
    if (machine.machineId.startsWith('host-')) {
      return 'dns';
    }
    return 'computer';
  }

  getActiveBadgeClass(activeCount: number): string {
    return activeCount > 0
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : 'bg-surface-container text-on-surface-variant';
  }

  getRunStatusClass(reason: AppRunEndReason): string {
    switch (reason) {
      case 'ACTIVE':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
      case 'RELEASED':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
      case 'TTL_EXPIRED':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
      default:
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
    }
  }

  formatDuration(totalSec: number): string {
    if (!totalSec || totalSec < 60) {
      return `${Math.max(0, totalSec || 0)}с`;
    }
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  }

  formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
