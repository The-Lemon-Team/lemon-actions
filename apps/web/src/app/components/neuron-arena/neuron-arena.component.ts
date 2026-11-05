import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ArenaGameSubMode } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ArenaActorDeckComponent } from './arena-actor-deck.component';
import { ArenaCombineViewComponent } from './arena-combine-view.component';
import { ArenaDesireDeckComponent } from './arena-desire-deck.component';
import { ArenaModalsComponent } from './arena-modals.component';
import { ArenaVersusViewComponent } from './arena-versus-view.component';

@Component({
  selector: 'app-neuron-arena',
  standalone: true,
  imports: [
    AsyncPipe,
    ArenaActorDeckComponent,
    ArenaCombineViewComponent,
    ArenaVersusViewComponent,
    ArenaDesireDeckComponent,
    ArenaModalsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      <!-- 1. TOP HERO & NEURON SCOPE BAR -->
      <section
        class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-space-md"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div class="flex items-start sm:items-center gap-space-md">
            <div
              class="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 shadow-xs"
            >
              <span class="material-symbols-rounded text-2xl" style="font-variation-settings: 'FILL' 1">
                diversity_3
              </span>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="font-headline-sm text-lg font-bold text-on-surface">
                  Neuron Arena · Карточки Желаний, Персонажи и Versus-Тимбилдинг
                </h1>
                <span
                  class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold"
                >
                  ltree scope: arena.*
                </span>
                <span
                  class="inline-flex items-center gap-1 font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-primary-container/70 text-on-primary-container font-bold"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                  Versus Mode + Летопись Карточек
                </span>
              </div>
              <p class="font-body-sm text-xs text-on-surface-variant mt-1 max-w-4xl">
                Игровое реактивное пространство тимбилдинга. Меняйте <strong>Главного Персонажа</strong> на ходу,
                оставляйте от его имени <strong>Войсы</strong> и разыгрывайте <strong>Карточки Желаний</strong>.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              type="button"
              (click)="showNewDesireCardModal.set(true)"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-xs font-bold transition-all"
            >
              <span class="material-symbols-rounded text-base">style</span>
              <span>+ Карточка Желания</span>
            </button>
            <button
              type="button"
              (click)="showNewActorModal.set(true)"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-xs font-bold transition-all"
            >
              <span class="material-symbols-rounded text-base">person_add</span>
              <span>+ Персонаж</span>
            </button>
            <button
              type="button"
              (click)="showNewParadoxModal.set(true)"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-95 transition-all shadow-xs"
            >
              <span class="material-symbols-rounded text-base">flare</span>
              <span>+ Новый Спор / Игра</span>
            </button>
          </div>
        </div>

        @if (arena.deckAnalytics$ | async; as deckStats) {
          <div
            class="p-3.5 rounded-xl bg-primary-container/25 border border-primary/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <span class="material-symbols-rounded text-lg">insights</span>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-label-ui text-xs font-bold uppercase tracking-wider text-on-surface">
                    Глобальный вывод из истории Карточек Желаний:
                  </span>
                  @if (deckStats.topWinnerCard; as champ) {
                    <span
                      class="font-label-code-sm text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                    >
                      Лидер побед: «{{ champ.title }}» ({{ champ.winRatePercent }}% WR)
                    </span>
                  }
                </div>
                <p class="font-body-sm text-xs text-on-surface mt-1 font-medium">
                  {{ deckStats.headlineConclusion }}
                </p>
              </div>
            </div>

            <button
              type="button"
              (click)="scrollToSection('desire-deck-section')"
              class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:border-primary font-label-ui text-xs font-bold transition-all flex-shrink-0 self-start lg:self-center inline-flex items-center gap-1.5 shadow-xs"
            >
              <span class="material-symbols-rounded text-sm">history_edu</span>
              <span>Открыть Летопись Карточек ({{ (arena.desireCards$ | async)?.length || 0 }})</span>
            </button>
          </div>
        }
      </section>

      <!-- 2 & 3. CHARACTER DECK + LEAD VOICE STUDIO -->
      <app-arena-actor-deck />

      <!-- ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ПОЛЯ: COMBINE MODE vs VERSUS MODE -->
      <section
        class="bg-surface-container-lowest rounded-2xl p-3 shadow-xs border-2 border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-rounded text-primary text-2xl">tune</span>
          <div>
            <div class="font-headline-sm text-sm font-bold text-on-surface">
              Режим работы Реактивного Поля:
            </div>
            <div class="font-body-sm text-xs text-on-surface-variant">
              Переключайтесь между совмещением занятий в одном слоте времени (<strong>Combine Mode</strong>) и битвой альтернатив (<strong>Versus Mode</strong>)
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/30">
          <button
            type="button"
            (click)="gameSubMode.set('COMBINE')"
            class="px-3.5 py-2 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
            [class]="
              gameSubMode() === 'COMBINE'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            "
          >
            <span class="material-symbols-rounded text-base">push_pin</span>
            <span>🧩 Combine Mode (Поле Времени + Активная Зона Pin)</span>
          </button>

          <button
            type="button"
            (click)="gameSubMode.set('VERSUS')"
            class="px-3.5 py-2 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
            [class]="
              gameSubMode() === 'VERSUS'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            "
          >
            <span class="material-symbols-rounded text-base">swords</span>
            <span>⚔️ Versus Mode (Спор Карточек Желаний)</span>
          </button>
        </div>
      </section>

      <!-- 4A / 4B. COMBINE OR VERSUS MODE VIEW -->
      @if (gameSubMode() === 'COMBINE') {
        <app-arena-combine-view />
      } @else {
        <app-arena-versus-view (inspectCardHistory)="openCardHistory($event)" />
      }

      <!-- 5 & 6. DESIRE CARDS DECK & BOTTOM CHRONICLE -->
      <app-arena-desire-deck (openNewCardModal)="showNewDesireCardModal.set(true)" />
    </div>

    <!-- MODALS -->
    <app-arena-modals
      [showNewDesireCardModal]="showNewDesireCardModal()"
      [showNewActorModal]="showNewActorModal()"
      [showNewParadoxModal]="showNewParadoxModal()"
      (closeNewDesireCardModal)="showNewDesireCardModal.set(false)"
      (closeNewActorModal)="showNewActorModal.set(false)"
      (closeNewParadoxModal)="showNewParadoxModal.set(false)"
    />
  `,
})
export class NeuronArenaComponent {
  protected readonly arena = inject(NeuronArenaService);

  readonly gameSubMode = signal<ArenaGameSubMode>('COMBINE');
  readonly showNewDesireCardModal = signal(false);
  readonly showNewActorModal = signal(false);
  readonly showNewParadoxModal = signal(false);

  openCardHistory(cardId: string): void {
    this.arena.inspectDesireCard(cardId);
    this.scrollToSection('desire-deck-section');
  }

  scrollToSection(elementId: string): void {
    if (typeof document !== 'undefined') {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
