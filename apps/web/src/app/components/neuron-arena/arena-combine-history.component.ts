import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';

@Component({
  selector: 'app-arena-combine-history',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-sm pt-2">
      <div class="flex items-center gap-2">
        <span class="material-symbols-rounded text-xl text-primary">collections_bookmark</span>
        <h3 class="font-headline-sm text-base font-bold text-on-surface">
          Карточки Истории Времени (Какие занятия закреплялись вместе и чья идея оказалась удачливее)
        </h3>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        @for (hcard of (arena.combineHistoryCards$ | async) ?? []; track hcard.id) {
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border-2 border-emerald-500/40 flex flex-col justify-between gap-3">
            <div class="flex flex-col gap-2.5">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                  <span class="material-symbols-rounded text-xl">{{ hcard.baseIcon }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                      Карточка Истории · Закреплено занятий: {{ hcard.pinnedActivities.length }}
                    </span>
                    <span class="font-label-code-sm text-[10px] text-outline">
                      {{ hcard.durationLabel }}
                    </span>
                  </div>
                  <h4 class="font-headline-sm text-base font-bold text-on-surface mt-0.5">
                    {{ hcard.timeFieldTitle }}
                  </h4>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                @for (pa of hcard.pinnedActivities; track pa.id) {
                  <div class="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-2 text-xs">
                    <span class="material-symbols-rounded text-base text-primary">{{ pa.icon }}</span>
                    <div>
                      <div class="font-label-ui font-bold text-on-surface">
                        {{ pa.title }}
                        @if (pa.outcome === 'HIT') {
                          <span class="text-emerald-600 ml-1">★ Удачно!</span>
                        }
                      </div>
                      <div class="font-label-code-sm text-[10px] text-on-surface-variant">
                        Идея от: {{ pa.actorName }}
                      </div>
                    </div>
                  </div>
                }
              </div>

              <p class="p-2.5 rounded-xl bg-surface-container-low font-body-sm text-xs text-on-surface">
                {{ hcard.synthesisConclusion }}
              </p>
            </div>

            <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label-ui">
              <span class="text-on-surface-variant">Самая удачливая идея:</span>
              <span class="font-bold text-emerald-600">
                🏆 «{{ hcard.mostSuccessfulIdeaTitle }}» ({{ hcard.mostSuccessfulActorName }})
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ArenaCombineHistoryComponent {
  protected readonly arena = inject(NeuronArenaService);
}
