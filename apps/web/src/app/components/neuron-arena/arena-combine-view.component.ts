import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombineActivitySuggestion } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaCombineHistoryComponent } from './arena-combine-history.component';
import { getAccentAvatarClasses, getAccentPillClasses } from './arena-ui.utils';

@Component({
  selector: 'app-arena-combine-view',
  standalone: true,
  imports: [AsyncPipe, FormsModule, ActorAvatarComponent, ArenaCombineHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (arena.activeCombineField$ | async; as timeField) {
      <section class="flex flex-col gap-space-md">
        <!-- Шапка Поля Времени и слотов -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-ui text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Поле Времени:
            </span>
            @for (tf of (arena.combineTimeFields$ | async) ?? []; track tf.id) {
              <button
                type="button"
                (click)="arena.selectCombineTimeField(tf.id)"
                class="px-3 py-1.5 rounded-xl font-label-ui text-xs font-bold transition-all border inline-flex items-center gap-1.5"
                [class]="
                  tf.id === timeField.id
                    ? 'bg-inverse-surface text-inverse-on-surface border-inverse-surface shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                "
              >
                <span class="material-symbols-rounded text-sm">{{ tf.baseIcon }}</span>
                <span>{{ tf.baseActivity }} ({{ tf.durationLabel }})</span>
              </button>
            }
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              (click)="arena.saveActiveCombineFieldToHistory()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-label-ui text-xs font-bold shadow-sm hover:bg-emerald-700 transition-all"
            >
              <span class="material-symbols-rounded text-base">bookmark_added</span>
              <span>Сохранить в Карточку Истории (Оценить чья идея удачливее)</span>
            </button>
          </div>
        </div>

        <!-- Описание текущего Поля Времени + Добавление новой идеи от Главного Персонажа -->
        <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-rounded text-2xl">{{ timeField.baseIcon }}</span>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
                    Базовое занятие: {{ timeField.baseActivity }}
                  </span>
                  <span class="font-label-code-sm text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    {{ timeField.durationLabel }} · {{ timeField.folderPath }}
                  </span>
                </div>
                <h2 class="font-headline-sm text-xl font-bold text-on-surface mt-1">
                  {{ timeField.title }}
                </h2>
                <p class="font-body-sm text-xs text-on-surface-variant mt-0.5 max-w-4xl">
                  {{ timeField.contextDescription }}
                </p>
              </div>
            </div>
          </div>

          @if (arena.leadActor$ | async; as lead) {
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col md:flex-row md:items-center gap-2.5">
              <div class="flex items-center gap-2 flex-shrink-0">
                <app-actor-avatar
                  [avatar]="lead.avatarIcon"
                  containerClass="w-8 h-8 rounded-xl shadow-xs flex-shrink-0"
                />
                <span class="font-label-ui text-xs font-bold text-on-surface">
                  Идея в это время от «{{ lead.name }}»:
                </span>
              </div>
              <input
                type="text"
                [(ngModel)]="combineNewIdeaTitle"
                (keyup.enter)="submitCombineIdea()"
                placeholder="Напр.: Слушать подкаст / Смотреть YouTube / Пить пиво / Особая идея..."
                class="flex-1 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
              />
              <button
                type="button"
                (click)="submitCombineIdea()"
                class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-95 flex-shrink-0 inline-flex items-center gap-1"
              >
                <span class="material-symbols-rounded text-sm">push_pin</span>
                <span>Предложить и Закрепить</span>
              </button>
            </div>
          }
        </div>

        <!-- АКТИВНАЯ ЗОНА ПРИЛОЖЕНИЯ (ЗАПИНЕННЫЕ КАРТОЧКИ) -->
        <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border-2 border-primary flex flex-col gap-space-md">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="material-symbols-rounded text-primary text-xl" style="font-variation-settings: 'FILL' 1">
                push_pin
              </span>
              <h3 class="font-headline-sm text-base font-bold text-on-surface">
                Активная Зона Приложения (Запиненные занятия во время «{{ timeField.baseActivity }}»)
              </h3>
              <span class="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-label-code-sm text-[11px] font-bold">
                Закреплено одновременно: {{ (arena.pinnedCombineActivities$ | async)?.length || 0 }}
              </span>
            </div>
            <span class="font-label-code-sm text-xs text-on-surface-variant">
              Если занятие наскучило — замените его на лету, а в конце оцените, чья идея оказалась удачливее!
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            @for (pinned of (arena.pinnedCombineActivities$ | async) ?? []; track pinned.id) {
              <div
                class="p-space-md rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 relative"
                [class]="
                  pinned.outcome === 'HIT'
                    ? 'bg-emerald-500/5 border-emerald-500/50'
                    : 'bg-surface-container-low/70 border-primary/50'
                "
              >
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <div
                        class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        [class]="getAccentAvatarClasses(pinned.colorTheme, true)"
                      >
                        <span class="material-symbols-rounded text-xl">{{ pinned.icon }}</span>
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-code-sm text-[10px] font-bold uppercase flex items-center gap-1">
                            <span class="material-symbols-rounded text-xs">push_pin</span>
                            В Активной Зоне
                          </span>
                          @if (pinned.replacesTitle) {
                            <span class="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 font-label-code-sm text-[10px] font-bold">
                              🔄 Заменила наскучившее: «{{ pinned.replacesTitle }}»
                            </span>
                          }
                        </div>
                        <h4 class="font-headline-sm text-lg font-bold text-on-surface mt-1">
                          «{{ pinned.title }}» + «{{ timeField.baseActivity }}»
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="arena.togglePinCombineSuggestion(pinned.id)"
                      title="Открепить из Активной Зоны"
                      class="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                    >
                      <span class="material-symbols-rounded text-base">keep_off</span>
                    </button>
                  </div>

                  <p class="font-body-sm text-xs text-on-surface-variant">
                    {{ pinned.subtitle }}
                  </p>

                  <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex items-start gap-2.5">
                    <app-actor-avatar
                      [avatar]="pinned.actorIcon"
                      containerClass="w-9 h-9 rounded-xl shadow-xs flex-shrink-0"
                    />
                    <div class="text-xs">
                      <div class="font-label-ui font-bold text-on-surface">
                        Предложил персонаж: {{ pinned.actorName }}
                      </div>
                      <div class="font-body-sm text-on-surface-variant italic mt-0.5">
                        «{{ pinned.pitchVoice }}»
                      </div>
                    </div>
                  </div>
                </div>

                <div class="pt-2.5 border-t border-outline-variant/20 flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="font-label-ui text-[11px] font-bold text-on-surface-variant">
                      Как показала себя идея?
                    </span>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        (click)="arena.rateCombineSuggestion(pinned.id, 'HIT')"
                        class="px-2.5 py-1 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1"
                        [class]="
                          pinned.outcome === 'HIT'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-surface-container-high text-on-surface hover:bg-emerald-500/20'
                        "
                      >
                        <span class="material-symbols-rounded text-xs">star</span>
                        <span>Удачная идея!</span>
                      </button>

                      <button
                        type="button"
                        (click)="arena.rateCombineSuggestion(pinned.id, 'SO_SO')"
                        class="px-2.5 py-1 rounded-lg font-label-ui text-xs font-bold transition-all"
                        [class]="
                          pinned.outcome === 'SO_SO'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-surface-container-high text-on-surface hover:bg-amber-500/20'
                        "
                      >
                        Нормально
                      </button>
                    </div>
                  </div>

                  <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span class="font-body-sm text-[11px] text-on-surface">
                      Наскучило <strong>«{{ pinned.title }}»</strong>?
                    </span>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="text"
                        [(ngModel)]="replacementInputByCardId[pinned.id]"
                        placeholder="Слушать подкаст"
                        class="w-36 px-2 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[11px] text-on-surface"
                      />
                      <button
                        type="button"
                        (click)="triggerBoredReplacement(pinned)"
                        class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-label-ui text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <span class="material-symbols-rounded text-xs">swap_horiz</span>
                        <span>Наскучило → Заменить</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="col-span-2 p-6 text-center rounded-xl bg-surface-container-low text-xs text-on-surface-variant">
                В Активной Зоне пока не закреплено ни одного занятия. Нажмите «Закрепить (Pin)» на любом предложении персонажей ниже!
              </div>
            }
          </div>
        </div>

        <!-- ПРЕДЛОЖЕНИЯ ПЕРСОНАЖЕЙ И ЗАМЕНЁННЫЕ КАРТОЧКИ -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div class="lg:col-span-7 flex flex-col gap-2.5">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-lg text-primary">lightbulb</span>
              <h4 class="font-headline-sm text-sm font-bold text-on-surface">
                Предложения персонажей в это Поле Времени (Нажмите Pin, чтобы закрепить)
              </h4>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (sug of (arena.proposedCombineActivities$ | async) ?? []; track sug.id) {
                <div class="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between gap-2.5">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-label-code-sm text-[10px] pl-1 pr-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1.5" [class]="getAccentPillClasses(sug.actorAccent)">
                        <app-actor-avatar [avatar]="sug.actorIcon" containerClass="w-5 h-5 rounded-full" />
                        <span>От: {{ sug.actorName }}</span>
                      </span>
                      <span class="material-symbols-rounded text-base text-primary">{{ sug.icon }}</span>
                    </div>
                    <h5 class="font-headline-sm text-sm font-bold text-on-surface mt-1.5">
                      «{{ sug.title }}»
                    </h5>
                    <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                      {{ sug.subtitle }}
                    </p>
                    <p class="font-body-sm text-[11px] italic text-on-surface mt-1.5 p-2 rounded-lg bg-surface-container-low">
                      «{{ sug.pitchVoice }}»
                    </p>
                  </div>

                  <button
                    type="button"
                    (click)="arena.togglePinCombineSuggestion(sug.id)"
                    class="w-full py-1.5 px-3 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-label-ui text-xs font-bold transition-all inline-flex items-center justify-center gap-1"
                  >
                    <span class="material-symbols-rounded text-sm">push_pin</span>
                    <span>Закрепить в Активную Зону (Pin)</span>
                  </button>
                </div>
              }
            </div>
          </div>

          <div class="lg:col-span-5 flex flex-col gap-2.5">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-lg text-amber-600">history_toggle_off</span>
              <h4 class="font-headline-sm text-sm font-bold text-on-surface">
                Наскучило по ходу времени (Заменено на более важное)
              </h4>
            </div>

            <div class="flex flex-col gap-2.5">
              @for (rep of (arena.replacedCombineActivities$ | async) ?? []; track rep.id) {
                <div class="p-3.5 rounded-2xl bg-surface-container-lowest border border-amber-500/40 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold">
                      💤 Наскучило в процессе
                    </span>
                    <span class="font-label-code-sm text-[11px] text-outline">
                      Идея от: {{ rep.actorName }}
                    </span>
                  </div>
                  <div class="font-headline-sm text-sm font-bold text-on-surface line-through opacity-75">
                    «{{ rep.title }}»
                  </div>
                  <p class="font-body-sm text-xs text-on-surface-variant">
                    {{ rep.unpinnedReason }}
                  </p>
                  <div class="pt-1.5 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label-ui">
                    <span class="text-emerald-600 font-bold flex items-center gap-1">
                      <span class="material-symbols-rounded text-sm">trending_flat</span>
                      Заменено на карточку: «{{ rep.replacedByTitle }}»
                    </span>
                    <button
                      type="button"
                      (click)="arena.togglePinCombineSuggestion(rep.id)"
                      class="text-[11px] text-primary hover:underline"
                    >
                      Вернуть в Pin
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 text-xs text-on-surface-variant">
                  Пока ни одна закреплённая карточка не отвалилась.
                </div>
              }
            </div>
          </div>
        </div>

        <!-- КАРТОЧКИ ИСТОРИИ СОВМЕЩЕНИЙ -->
        <app-arena-combine-history />
      </section>
    }
  `,
})
export class ArenaCombineViewComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  combineNewIdeaTitle = '';
  replacementInputByCardId: Record<string, string> = {};

  submitCombineIdea(): void {
    const cleanTitle = this.combineNewIdeaTitle.trim();
    if (!cleanTitle) return;
    this.arena.proposeNewCombineSuggestion({
      title: cleanTitle,
      pinImmediately: true,
    });
    this.combineNewIdeaTitle = '';
  }

  triggerBoredReplacement(pinned: CombineActivitySuggestion): void {
    const replacementTitle = (this.replacementInputByCardId[pinned.id] || 'Слушать подкаст').trim();
    this.arena.replaceBoredSuggestionWithNewCard(pinned.id, replacementTitle || 'Слушать подкаст');
    delete this.replacementInputByCardId[pinned.id];
  }
}
