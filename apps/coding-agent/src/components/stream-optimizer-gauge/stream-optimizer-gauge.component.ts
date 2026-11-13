import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-stream-optimizer-gauge',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
            <span class="material-symbols-rounded text-lg">tune</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              Core Combinator · Оптимизация Потоков
            </h2>
            <p class="font-body-sm text-[11px] text-on-surface-variant">
              Коалесцирование импульсов, отсечение шума и распределение нагрузки на шину
            </p>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-tertiary-container text-on-tertiary-container font-bold">
          <span class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          Engine Active
        </span>
      </div>

      <!-- Metrics KPI Grid -->
      @if (facade.streamMetrics$ | async; as m) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">Снижение нагрузки</span>
            <div class="mt-2 flex items-baseline gap-1.5">
              <span class="text-3xl font-bold font-display-lg text-primary">{{ m.overallReductionRate }}%</span>
              <span class="text-xs text-on-surface-variant">сэкономлено</span>
            </div>
            <div class="w-full bg-surface-container-highest rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                class="bg-primary h-1.5 rounded-full transition-all duration-500"
                [style.width.%]="m.overallReductionRate"
              ></div>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">Импульсов подавлено</span>
            <div class="mt-2 text-3xl font-bold font-display-lg text-tertiary">
              {{ m.totalImpulsesSuppressed }}
            </div>
            <span class="text-[11px] text-on-surface-variant mt-1">объединено в буферах</span>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">Эфемерный трафик</span>
            <div class="mt-2 text-3xl font-bold font-display-lg text-secondary">
              {{ m.ephemeralPulsesRatio }}%
            </div>
            <span class="text-[11px] text-on-surface-variant mt-1">только SSE (без записи в БД)</span>
          </div>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col justify-between">
            <span class="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">Всего импульсов</span>
            <div class="mt-2 text-3xl font-bold font-display-lg text-on-surface">
              {{ m.totalImpulsesReceived }}
            </div>
            <span class="text-[11px] text-on-surface-variant mt-1">эмитировано: {{ m.totalImpulsesEmitted }}</span>
          </div>
        </div>
      }

      <!-- Live Stream Impulse Ticker -->
      <div class="flex flex-col gap-2 mt-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Живой поток импульсов (Optimized Stream Feed)
          </span>
          <span class="text-[11px] text-on-surface-variant">последние 20 пакетов</span>
        </div>

        <div class="bg-surface-container-high/60 rounded-2xl p-3 max-h-48 overflow-y-auto space-y-1.5 border border-outline-variant/15">
          @if ((facade.livePulses$ | async); as pulses) {
            @if (pulses.length === 0) {
              <div class="py-6 text-center text-xs text-on-surface-variant italic">
                Ожидание импульсов от Core Combinator...
              </div>
            }
            @for (p of pulses; track p.id) {
              <div class="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/10 shadow-2xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                  <span class="font-mono font-bold text-primary text-[11px]">{{ p.type }}</span>
                  <span class="text-on-surface-variant truncate text-[11px]">[{{ p.flowName }}]</span>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                  @if (p.coalescedCount && p.coalescedCount > 1) {
                    <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary-container text-on-primary-container">
                      x{{ p.coalescedCount }} merged
                    </span>
                  }
                  <span class="font-mono text-[10px] text-on-surface-variant">
                    {{ p.timestamp | date:'HH:mm:ss' }}
                  </span>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class StreamOptimizerGaugeComponent {
  protected readonly facade = inject(CodingAgentFacade);
}
