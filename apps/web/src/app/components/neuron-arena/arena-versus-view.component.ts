import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses, getAccentPillClasses, getBarBgClass } from './arena-ui.utils';

@Component({
  selector: 'app-arena-versus-view',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (arena.activeParadox$ | async; as paradox) {
      <section class="flex flex-col gap-space-md">
        <!-- Paradox Selector Tabs + Finish Period CTA -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-ui text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Активный Спор / Поле:
            </span>
            @for (p of (arena.paradoxes$ | async) ?? []; track p.id) {
              <button
                type="button"
                (click)="arena.selectParadoxField(p.id)"
                class="px-3 py-1.5 rounded-xl font-label-ui text-xs font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                [class]="
                  p.id === paradox.id
                    ? 'bg-inverse-surface text-inverse-on-surface border-inverse-surface shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                "
              >
                {{ p.title }}
              </button>
            }
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            @if (paradox.status === 'ACTIVE_BATTLE') {
              <button
                type="button"
                (click)="arena.resolvePeriodWithSummary()"
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-label-ui text-xs font-bold shadow-sm hover:bg-emerald-700 transition-all"
              >
                <span class="material-symbols-rounded text-base">emoji_events</span>
                <span>Завершить период и подвести Резюме</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="arena.reopenPeriod()"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-ui text-xs font-bold hover:bg-primary-container transition-all"
              >
                <span class="material-symbols-rounded text-base">replay</span>
                <span>Продолжить раунд (Открыть поле)</span>
              </button>
            }
          </div>
        </div>

        <!-- Paradox Context Banner & Tug-of-War Versus Spectrum -->
        <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
                {{ paradox.occasionTag }}
              </span>
              <span class="font-label-code-sm text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Нейрон: {{ paradox.folderPath }}
              </span>
              <span
                class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full font-bold"
                [class]="
                  paradox.status === 'RESOLVED'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                "
              >
                {{ paradox.periodLabel }}
              </span>
            </div>
            <h2 class="font-headline-sm text-xl font-bold text-on-surface mt-1">
              {{ paradox.title }}
            </h2>
            <p class="font-body-sm text-xs text-on-surface-variant max-w-4xl">
              {{ paradox.contextStory }}
            </p>
          </div>

          <div class="p-3 rounded-xl bg-surface-container-low border-l-4 border-primary flex items-start gap-2.5">
            <span class="material-symbols-rounded text-primary text-xl flex-shrink-0 mt-0.5">help_clinic</span>
            <div class="text-xs font-body-sm text-on-surface">
              <strong class="font-bold">Главный вопрос парадокса для персонажей:</strong>
              {{ paradox.paradoxQuestion }}
            </div>
          </div>

          @if ((arena.activeThreads$ | async) ?? []; as threads) {
            @if (threads.length > 0) {
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span class="font-label-ui font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span class="material-symbols-rounded text-base text-primary">swords</span>
                    Баланс сил Карточек Желаний в Поле (Versus Mode):
                  </span>
                  <div class="flex items-center gap-3 flex-wrap font-label-code-sm">
                    @for (th of threads; track th.id) {
                      <span class="inline-flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full" [class]="getBarBgClass(th.colorTheme)"></span>
                        <strong>{{ th.title }}:</strong>
                        <span>{{ th.votesCount }} чел. ({{ th.sharePercent }}%)</span>
                      </span>
                    }
                  </div>
                </div>

                <div class="w-full h-3.5 bg-surface-container rounded-full overflow-hidden flex shadow-inner p-0.5 gap-0.5">
                  @for (th of threads; track th.id) {
                    <div
                      [style.width.%]="th.sharePercent || 5"
                      class="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                      [class]="getBarBgClass(th.colorTheme)"
                      [title]="th.title + ': ' + th.votesCount + ' голосов (' + th.sharePercent + '%)'"
                    ></div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- РЕЗЮМЕ ПЕРИОДА -->
        @if (paradox.resolvedSummary; as summary) {
          <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-md border-2 border-emerald-500/60 flex flex-col gap-space-md">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-outline-variant/25">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <span class="material-symbols-rounded text-2xl">emoji_events</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-label-code-sm text-[11px] font-bold uppercase">
                      Итоговое Резюме Периода · Записано в историю карточек
                    </span>
                    <span class="font-label-code-sm text-xs text-outline">
                      {{ summary.resolvedAt | date: 'HH:mm:ss' }}
                    </span>
                  </div>
                  <h3 class="font-headline-sm text-xl font-bold text-on-surface mt-0.5">
                    Вперёд вышла карточка желания: «{{ summary.winnerTitle }}»!
                  </h3>
                </div>
              </div>

              <div class="flex items-center gap-3 font-label-code-sm text-xs">
                <span class="px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface">
                  Всего голосов: <strong>{{ summary.totalVotes }}</strong>
                </span>
                <span class="px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface">
                  Войсов в поле: <strong>{{ summary.totalVoices }}</strong>
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
              <div class="lg:col-span-7 flex flex-col gap-3">
                <div class="p-3.5 rounded-xl bg-surface-container-low">
                  <div class="font-label-ui text-xs font-bold uppercase text-on-surface-variant mb-1">
                    Что было предложено и кто вышел вперёд:
                  </div>
                  <p class="font-body-sm text-sm text-on-surface">
                    {{ summary.teamSynthesis }}
                  </p>
                </div>

                <div class="p-3.5 rounded-xl bg-primary-container/25 border border-primary/30">
                  <div class="font-label-ui text-xs font-bold uppercase text-on-primary-container mb-1">
                    Вердикт Нейрона и Командный Синтез:
                  </div>
                  <p class="font-body-sm text-xs text-on-surface">
                    {{ summary.paradoxVerdict }}
                  </p>
                </div>
              </div>

              <div class="lg:col-span-5 flex flex-col gap-2">
                <span class="font-label-ui text-xs font-bold uppercase text-on-surface-variant">
                  Итоговый расклад карточек в периоде:
                </span>
                @for (c of summary.competingThreads; track c.id; let idx = $index) {
                  <div
                    class="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                    [class]="
                      idx === 0
                        ? 'bg-emerald-500/10 border-emerald-500/40 font-bold'
                        : 'bg-surface-container-low border-outline-variant/20'
                    "
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="material-symbols-rounded text-base">{{ c.icon }}</span>
                      <span class="font-label-ui text-xs text-on-surface truncate">
                        #{{ idx + 1 }} {{ c.title }}
                      </span>
                    </div>
                    <span class="font-label-code-sm text-xs text-on-surface flex-shrink-0">
                      {{ c.votes }} гол. ({{ c.sharePercent }}%)
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- КАРТОЧКИ ЖЕЛАНИЙ (ТРЕДЫ) В АКТИВНОМ ПОЛЕ (VERSUS GRID) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          @for (thread of (arena.activeThreads$ | async) ?? []; track thread.id) {
            <div
              class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all flex flex-col justify-between gap-space-md relative"
              [class]="
                thread.isWinner
                  ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/10'
                  : thread.isLeading
                    ? 'border-2 border-primary'
                    : 'border-outline-variant/30'
              "
            >
              <div class="flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-3 min-w-0">
                    <div
                      class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      [class]="getAccentAvatarClasses(thread.colorTheme, thread.isLeading)"
                    >
                      <span class="material-symbols-rounded text-xl">{{ thread.icon }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        @if (thread.isWinner) {
                          <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-label-code-sm text-[10px] font-bold uppercase">
                            🏆 Победитель раунда
                          </span>
                        } @else if (thread.isLeading) {
                          <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-code-sm text-[10px] font-bold uppercase">
                            🔥 Лидер в поле
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-code-sm text-[10px] font-bold uppercase">
                            ⚔️ Versus-Претендент
                          </span>
                        }
                        <span class="font-label-code-sm text-[11px] font-bold text-on-surface">
                          {{ thread.sharePercent }}% ({{ thread.votesCount }} чел.)
                        </span>
                      </div>
                      <h3 class="font-headline-sm text-lg font-bold text-on-surface mt-1">
                        «{{ thread.title }}»
                      </h3>
                      <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                        {{ thread.subtitle }}
                      </p>
                    </div>
                  </div>
                </div>

                @if (thread.cardStats; as cs) {
                  <div
                    (click)="thread.desireCardId && inspectCardHistory.emit(thread.desireCardId)"
                    class="p-2.5 rounded-xl bg-surface-container-low/90 border border-outline-variant/25 cursor-pointer hover:border-primary transition-colors flex flex-col gap-1"
                  >
                    <div class="flex items-center justify-between text-[11px] font-label-code-sm">
                      <span class="font-bold text-on-surface flex items-center gap-1">
                        <span class="material-symbols-rounded text-xs text-primary">history</span>
                        История карточки: {{ cs.gamesPlayed }} игр · {{ cs.winsCount }} побед ({{ cs.winRatePercent }}% WR)
                      </span>
                      <span class="text-primary underline">Летопись →</span>
                    </div>
                    <p class="font-body-sm text-[11px] text-on-surface-variant line-clamp-2">
                      {{ cs.analyticsInsight }}
                    </p>
                  </div>
                }

                <div class="flex flex-col gap-1.5 pt-1">
                  <div class="flex items-center justify-between text-[11px] font-label-ui text-on-surface-variant">
                    <span>Вбросил в поле: <strong class="text-on-surface">{{ thread.proposerName }}</strong></span>
                    <span>Поддержали ({{ thread.supporters.length }}):</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    @for (sup of thread.supporters; track sup.id) {
                      <span
                        class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-[11px] font-label-ui font-semibold border"
                        [class]="getAccentPillClasses(sup.accentColor)"
                      >
                        <app-actor-avatar [avatar]="sup.icon" containerClass="w-5 h-5 rounded-full" />
                        <span>{{ sup.name }}</span>
                      </span>
                    }
                  </div>
                </div>

                @if (thread.voices.length > 0) {
                  <div class="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/20">
                    <span class="font-label-code-sm text-[10px] uppercase text-outline font-bold">
                      Войсы персонажей в этом треде ({{ thread.voices.length }}):
                    </span>
                    @for (v of thread.voices.slice(0, 2); track v.id) {
                      <div class="p-2 rounded-xl bg-surface-container-low text-xs flex flex-col gap-1">
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-label-ui font-bold text-on-surface flex items-center gap-1.5">
                            <app-actor-avatar [avatar]="v.actorIcon" containerClass="w-5 h-5 rounded-lg" />
                            {{ v.actorName }}
                          </span>
                          <button
                            type="button"
                            (click)="arena.playVoiceAudio(v)"
                            class="px-1.5 py-0.5 rounded bg-surface-container-high hover:bg-primary-container text-[10px] font-label-code-sm font-bold inline-flex items-center gap-0.5"
                          >
                            <span class="material-symbols-rounded text-xs">
                              {{ (arena.speakingVoiceId$ | async) === v.id ? 'stop' : 'volume_up' }}
                            </span>
                            <span>{{ (arena.speakingVoiceId$ | async) === v.id ? 'Стоп' : 'Войс' }}</span>
                          </button>
                        </div>
                        <p class="font-body-sm text-[11px] text-on-surface-variant">
                          «{{ v.text }}»
                        </p>
                      </div>
                    }
                  </div>
                }
              </div>

              @if (arena.leadActor$ | async; as lead) {
                <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    (click)="arena.supportThread(thread.id)"
                    class="w-full py-2 px-3 rounded-xl font-label-ui text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
                    [class]="
                      thread.supporterActorIds.includes(lead.id)
                        ? 'bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary-container'
                        : 'bg-primary text-on-primary hover:opacity-95'
                    "
                  >
                    <span class="material-symbols-rounded text-base">
                      {{ thread.supporterActorIds.includes(lead.id) ? 'campaign' : 'how_to_vote' }}
                    </span>
                    <span>
                      {{
                        thread.supporterActorIds.includes(lead.id)
                          ? 'Добавить ещё войс от «' + lead.name + '»'
                          : 'Поддержать как «' + lead.name + '» (+1 и Войс)'
                      }}
                    </span>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </section>
    } @else {
      <div class="p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-rounded text-2xl animate-spin">progress_activity</span>
        </div>
        <div class="font-headline-sm text-sm font-bold text-on-surface">
          Инициализация Versus-поединка...
        </div>
        <p class="font-body-sm text-xs text-on-surface-variant max-w-md">
          Загружаются активные споры и карточки поединка.
        </p>
        <button
          type="button"
          (click)="arena.resetDemoArena()"
          class="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-90 transition-all shadow-xs"
        >
          Перезагрузить демо-состояние
        </button>
      </div>
    }
  `,
})
export class ArenaVersusViewComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;
  protected readonly getBarBgClass = getBarBgClass;

  @Output() readonly inspectCardHistory = new EventEmitter<string>();
}
