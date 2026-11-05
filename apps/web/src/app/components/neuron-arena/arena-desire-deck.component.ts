import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { NeuralTrainingSample } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses } from './arena-ui.utils';

@Component({
  selector: 'app-arena-desire-deck',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      <!-- 5. КОЛОДА КАРТОЧЕК ЖЕЛАНИЙ И ЛЕТОПИСЬ ИГР -->
      <section id="desire-deck-section" class="flex flex-col gap-space-md pt-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="material-symbols-rounded text-xl text-primary">style</span>
            <h2 class="font-headline-sm text-lg font-bold text-on-surface">
              Колода Карточек Желаний и История их Игр
            </h2>
            <span class="font-label-code-sm text-xs px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
              Можно добавлять сколько угодно карточек и отслеживать, какая выигрывает чаще
            </span>
          </div>

          <button
            type="button"
            (click)="openNewCardModal.emit()"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-container text-on-primary-container font-label-ui text-xs font-bold shadow-xs hover:brightness-95 transition-all self-start sm:self-auto"
          >
            <span class="material-symbols-rounded text-base">add_circle</span>
            <span>+ Добавить карточку желания в колоду</span>
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          <!-- Left 7 Columns: Desire Cards Deck Grid -->
          <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            @for (card of (arena.desireCards$ | async) ?? []; track card.id) {
              <div
                (click)="arena.inspectDesireCard(card.id)"
                class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all cursor-pointer flex flex-col justify-between gap-3"
                [class]="
                  (arena.selectedDesireCardId$ | async) === card.id
                    ? 'border-2 border-primary ring-4 ring-primary/10 shadow-md'
                    : 'border-outline-variant/30 hover:border-primary/50'
                "
              >
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        [class]="getAccentAvatarClasses(card.colorTheme, (arena.selectedDesireCardId$ | async) === card.id)"
                      >
                        <span class="material-symbols-rounded text-xl">{{ card.icon }}</span>
                      </div>
                      <div>
                        <span class="font-label-code-sm text-[10px] uppercase text-on-surface-variant font-bold">
                          {{ card.category }}
                        </span>
                        <h3 class="font-headline-sm text-base font-bold text-on-surface">
                          «{{ card.title }}»
                        </h3>
                      </div>
                    </div>

                    <span
                      class="font-label-code-sm text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                      [class]="
                        card.winRatePercent >= 60
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : card.winRatePercent >= 40
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-surface-container-high text-on-surface-variant'
                      "
                    >
                      {{ card.winRatePercent }}% WR
                    </span>
                  </div>

                  <p class="font-body-sm text-xs text-on-surface-variant">
                    {{ card.description }}
                  </p>

                  <div class="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-surface-container-low text-center font-label-code-sm text-xs">
                    <div>
                      <div class="text-[10px] text-outline">Игр</div>
                      <strong class="text-on-surface">{{ card.gamesPlayed }}</strong>
                    </div>
                    <div>
                      <div class="text-[10px] text-emerald-600">Побед</div>
                      <strong class="text-emerald-600">{{ card.winsCount }}</strong>
                    </div>
                    <div>
                      <div class="text-[10px] text-rose-500">Уступила</div>
                      <strong class="text-rose-500">{{ card.lossesCount }}</strong>
                    </div>
                  </div>

                  <div class="p-2.5 rounded-xl bg-primary-container/20 border border-primary/25 text-[11px] font-body-sm text-on-surface">
                    <strong class="font-bold">Вывод:</strong> {{ card.analyticsInsight }}
                  </div>
                </div>

                <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                  <span class="font-label-code-sm text-[10px] text-outline">
                    {{ card.isInCurrentField ? '● Уже в активном поле' : '○ В колоде резерва' }}
                  </span>

                  <button
                    type="button"
                    (click)="$event.stopPropagation(); arena.playDesireCardToField(card.id)"
                    class="px-3 py-1.5 rounded-xl font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1"
                    [class]="
                      card.isInCurrentField
                        ? 'bg-surface-container-high text-on-surface hover:bg-primary-container'
                        : 'bg-primary text-on-primary shadow-xs hover:opacity-95'
                    "
                  >
                    <span class="material-symbols-rounded text-sm">
                      {{ card.isInCurrentField ? 'thumb_up' : 'play_arrow' }}
                    </span>
                    <span>{{ card.isInCurrentField ? 'Поддержать в поле' : 'Вбросить в Поле' }}</span>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Right 5 Columns: Detailed Match History Inspector -->
          @if (arena.inspectedDesireCard$ | async; as inspected) {
            <div class="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border-2 border-primary/40 flex flex-col gap-space-md sticky top-20">
              <div class="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/20">
                <div class="flex items-center gap-3">
                  <div
                    class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    [class]="getAccentAvatarClasses(inspected.colorTheme, true)"
                  >
                    <span class="material-symbols-rounded text-2xl">{{ inspected.icon }}</span>
                  </div>
                  <div>
                    <span class="font-label-code-sm text-[10px] uppercase px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold">
                      Летопись Карточки Желания
                    </span>
                    <h3 class="font-headline-sm text-lg font-bold text-on-surface mt-1">
                      «{{ inspected.title }}»
                    </h3>
                    <p class="font-label-code-sm text-xs text-on-surface-variant">
                      Добавил в колоду: {{ inspected.createdByActorName }}
                    </p>
                  </div>
                </div>
              </div>

              @if (inspected.nemesisCardTitle) {
                <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                  <span class="material-symbols-rounded text-amber-600 text-lg flex-shrink-0 mt-0.5">compare_arrows</span>
                  <div class="text-xs font-body-sm text-on-surface">
                    <div class="font-bold">Главный конкурент в Versus Mode: «{{ inspected.nemesisCardTitle }}»</div>
                    <div class="text-on-surface-variant mt-0.5">{{ inspected.nemesisScore }}</div>
                  </div>
                </div>
              }

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="font-label-ui text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    В каких играх участвовала ({{ inspected.matchHistory.length }}):
                  </span>
                  <span class="font-label-code-sm text-xs text-on-surface">
                    Всего голосов: <strong>{{ inspected.totalHistoricalVotes }}</strong>
                  </span>
                </div>

                <div class="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                  @for (m of inspected.matchHistory; track m.id) {
                    <div
                      class="p-3 rounded-xl border flex flex-col gap-1.5"
                      [class]="
                        m.outcome === 'WON'
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-surface-container-low border-outline-variant/25'
                      "
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span
                          class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                          [class]="
                            m.outcome === 'WON'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                          "
                        >
                          {{ m.outcome === 'WON' ? '🏆 ПОБЕДА КАРТОЧКИ' : '⚔️ УСТУПИЛА В VERSUS' }}
                        </span>
                        <span class="font-label-code-sm text-[11px] text-outline">
                          {{ m.playedAt | date: 'dd.MM.yyyy' }}
                        </span>
                      </div>

                      <div class="font-label-ui text-xs font-bold text-on-surface">
                        Игра: «{{ m.gameTitle }}»
                      </div>

                      <p class="font-body-sm text-xs text-on-surface-variant">
                        {{ m.note }}
                      </p>

                      <div class="flex items-center justify-between text-[11px] font-label-code-sm text-on-surface-variant pt-1 border-t border-outline-variant/15">
                        <span>Голоса карточки: <strong>{{ m.votesReceived }} из {{ m.totalGameVotes }}</strong></span>
                        <span>Победитель: <strong class="text-on-surface">«{{ m.winnerCardTitle }}»</strong></span>
                      </div>
                    </div>
                  } @empty {
                    <div class="p-6 text-center rounded-xl bg-surface-container-low text-xs text-on-surface-variant">
                      Эта карточка только что создана. Завершите текущий период, чтобы в её летописи появилась первая запись!
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- 6. BOTTOM CHRONICLE: ЛЕНТА ВОЙСОВ vs ДАТАСЕТ НЕЙРОНОВ -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant/25 self-start">
            <button
              type="button"
              (click)="bottomTab.set('voices')"
              class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
              [class]="
                bottomTab() === 'voices'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">Spatial_audio_off</span>
              <span>Хроника Войсов и Аналитика Персонажей ({{ (arena.activeVoices$ | async)?.length || 0 }})</span>
            </button>
            <button
              type="button"
              (click)="bottomTab.set('dataset')"
              class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
              [class]="
                bottomTab() === 'dataset'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">neurology</span>
              <span>Датасет Нейронов для обучения ИИ ({{ (arena.trainingSamples$ | async)?.length || 0 }} сэмплов)</span>
            </button>
          </div>

          @if (bottomTab() === 'dataset') {
            <button
              type="button"
              (click)="exportTrainingJsonl()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              <span class="material-symbols-rounded text-sm">download</span>
              <span>Скачать JSONL-датасет персонажей</span>
            </button>
          }
        </div>

        @if (bottomTab() === 'voices') {
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-3">
            @for (voice of (arena.activeVoices$ | async) ?? []; track voice.id) {
              <div class="p-3.5 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <app-actor-avatar
                    [avatar]="voice.actorIcon"
                    containerClass="w-12 h-12 rounded-2xl shadow-xs flex-shrink-0"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-headline-sm text-sm font-bold text-on-surface">
                        {{ voice.actorName }}
                      </span>
                      <span class="font-label-code-sm text-[10px] text-on-surface-variant">
                        {{ voice.actorTitle }}
                      </span>
                      @if (voice.threadTitle) {
                        <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
                          Карточка: «{{ voice.threadTitle }}»
                        </span>
                      }
                    </div>

                    <p class="font-body-sm text-sm text-on-surface mt-1.5">
                      «{{ voice.text }}»
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
                  <button
                    type="button"
                    (click)="arena.playVoiceAudio(voice)"
                    class="px-3 py-1.5 rounded-xl font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
                    [class]="
                      (arena.speakingVoiceId$ | async) === voice.id
                        ? 'bg-primary text-on-primary animate-pulse'
                        : 'bg-surface-container-high text-on-surface hover:bg-primary-container'
                    "
                  >
                    <span class="material-symbols-rounded text-base">
                      {{ (arena.speakingVoiceId$ | async) === voice.id ? 'stop_circle' : 'play_circle' }}
                    </span>
                    <span>
                      {{ (arena.speakingVoiceId$ | async) === voice.id ? 'Звучит...' : 'Прослушать (' + voice.durationSec + 'с)' }}
                    </span>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (sample of (arena.trainingSamples$ | async) ?? []; track sample.id) {
                <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 font-label-code-sm text-xs flex flex-col gap-1.5">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-bold text-primary">
                      persona: &#64;{{ sample.actorHandle }} ({{ sample.actorName }})
                    </span>
                    <span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {{ sample.intent }}
                    </span>
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    <strong>Контекст поля:</strong> {{ sample.competingDesires.join(' vs ') }}
                  </div>
                  <div class="p-2 rounded bg-surface-container-lowest text-on-surface font-body-sm text-xs">
                    {{ sample.voiceOutput }}
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class ArenaDesireDeckComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;

  @Output() readonly openNewCardModal = new EventEmitter<void>();

  readonly bottomTab = signal<'voices' | 'dataset'>('voices');

  exportTrainingJsonl(): void {
    let samples: NeuralTrainingSample[] = [];
    this.arena.trainingSamples$.subscribe((s) => (samples = s)).unsubscribe();
    const jsonl = samples.map((s) => JSON.stringify(s)).join('\n');
    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuron-arena-persona-dataset-${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
