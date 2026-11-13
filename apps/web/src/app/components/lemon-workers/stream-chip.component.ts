import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActionCondition,
  ActionEffect,
  ActionTrigger,
} from '../../core/models/worker.models';

@Component({
  selector: 'app-stream-chip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (trigger) {
      <!-- TRIGGER CHIP (КОГДА) -->
      @switch (trigger.kind) {
        @case ('TIMER') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs font-medium shadow-2xs transition-all hover:bg-amber-500/15"
            [title]="trigger.cron ? 'Cron: ' + trigger.cron : 'Интервал: ' + trigger.intervalMs + 'ms'"
          >
            <span class="material-symbols-rounded text-base text-amber-600 dark:text-amber-400">schedule</span>
            <span class="font-semibold text-xs tracking-tight">{{ trigger.label || (trigger.cron ? trigger.cron : trigger.intervalMs + 'ms') }}</span>
          </div>
        }
        @case ('WATCHER') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-950 dark:text-sky-200 text-xs font-medium shadow-2xs transition-all hover:bg-sky-500/15"
            [title]="'Наблюдение за папкой: ' + (trigger.targetNeuronPath || trigger.targetNeuronId)"
          >
            <span class="material-symbols-rounded text-base text-sky-600 dark:text-sky-400">folder_eye</span>
            <span class="font-semibold text-xs">Наблюдатель ({{ trigger.events.join(', ') }})</span>
          </div>
        }
        @case ('IMPULSE') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-950 dark:text-purple-200 text-xs font-medium shadow-2xs transition-all hover:bg-purple-500/15"
          >
            <span class="material-symbols-rounded text-base text-purple-600 dark:text-purple-400">bolt</span>
            <span class="font-semibold text-xs">Импульс: {{ trigger.impulseType }}</span>
          </div>
        }
        @case ('MANUAL') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-800 dark:text-slate-200 text-xs font-medium shadow-2xs"
          >
            <span class="material-symbols-rounded text-base text-slate-600">touch_app</span>
            <span class="font-semibold text-xs">{{ trigger.buttonLabel || 'Ручной пуск' }}</span>
          </div>
        }
      }
    }

    @if (condition) {
      <!-- CONDITION CHIP (ЕСЛИ) -->
      @switch (condition.kind) {
        @case ('MUTEX') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-950 dark:text-rose-200 text-xs font-medium shadow-2xs transition-all hover:bg-rose-500/15"
            [title]="'Мьютекс: ' + condition.lockKey + ' (' + condition.onConflict + ')'"
          >
            <span class="material-symbols-rounded text-base text-rose-600 dark:text-rose-400">lock</span>
            <span class="text-xs">Мьютекс: <strong class="font-semibold">{{ condition.lockKey }}</strong></span>
          </div>
        }
        @case ('COOLDOWN') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-xs font-medium shadow-2xs transition-all hover:bg-emerald-500/15"
          >
            <span class="material-symbols-rounded text-base text-emerald-600 dark:text-emerald-400">hourglass_top</span>
            <span class="text-xs">Кулдаун: <strong class="font-semibold">{{ condition.cooldownMs / 1000 }}с</strong></span>
          </div>
        }
        @case ('CIRCUIT_BREAKER') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs font-medium shadow-2xs transition-all hover:bg-amber-500/15"
          >
            <span class="material-symbols-rounded text-base text-amber-600 dark:text-amber-400">shield</span>
            <span class="text-xs">Предохранитель (макс {{ condition.maxConsecutiveFailures }})</span>
          </div>
        }
        @case ('FSM') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-950 dark:text-indigo-200 text-xs font-medium shadow-2xs transition-all hover:bg-indigo-500/15"
          >
            <span class="material-symbols-rounded text-base text-indigo-600 dark:text-indigo-400">alt_route</span>
            <span class="text-xs">Фаза: <strong class="font-semibold">{{ condition.requiredState }}</strong></span>
          </div>
        }
      }
    }

    @if (action) {
      <!-- ACTION CHIP (ЧТО) -->
      @switch (action.kind) {
        @case ('HTTP_REQUEST') {
          <div
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-container/20 border border-primary-container/30 text-on-surface text-xs font-medium shadow-2xs max-w-full overflow-hidden transition-all hover:bg-primary-container/30"
            [title]="action.method + ' ' + action.url"
          >
            <span class="px-1.5 py-0.5 rounded-md bg-primary-container text-on-primary-container text-[10px] font-extrabold uppercase font-label-code-sm">
              {{ action.method }}
            </span>
            <span class="material-symbols-rounded text-sm text-primary">webhook</span>
            <span class="truncate max-w-[220px] font-label-code-sm text-xs font-medium text-on-surface/90">{{ action.url }}</span>
          </div>
        }
        @case ('DIGEST') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-950 dark:text-teal-200 text-xs font-medium shadow-2xs"
          >
            <span class="material-symbols-rounded text-base text-teal-600">auto_stories</span>
            <span class="text-xs">Дайджест заметок ({{ action.format }})</span>
          </div>
        }
        @case ('SCRIPT') {
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-2xs"
          >
            <span class="material-symbols-rounded text-base text-slate-600">terminal</span>
            <span class="text-xs">Скрипт: {{ action.runtime }}</span>
          </div>
        }
      }
    }
  `,
})
export class StreamChipComponent {
  @Input() trigger?: ActionTrigger;
  @Input() condition?: ActionCondition;
  @Input() action?: ActionEffect;
}
