import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ArenaActorCard, ArenaActorCategory } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaHeroNotesModalComponent } from './arena-hero-notes-modal.component';
import { getAccentPillClasses } from './arena-ui.utils';
import { ArenaVoiceStudioComponent } from './arena-voice-studio.component';

@Component({
  selector: 'app-arena-actor-deck',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    ActorAvatarComponent,
    ArenaVoiceStudioComponent,
    ArenaHeroNotesModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      <!-- 2. CHARACTER DECK -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="material-symbols-rounded text-lg text-primary">badge</span>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Колода Наших Персонажей (30 мультяшных героев · Нажмите на карточку, чтобы сделать её Главной)
            </h2>
            <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              Активный голос определяет, от чьего имени идут войсы и поддержка
            </span>
          </div>
          <div class="flex items-center gap-2 self-start lg:self-auto">
            <input
              type="text"
              [(ngModel)]="actorSearchQuery"
              placeholder="Поиск персонажа (Алексей, Аид, Берховен...)"
              class="px-3 py-1 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface w-56"
            />
            <button
              type="button"
              (click)="arena.resetDemoArena()"
              class="font-label-ui text-xs text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-container-low"
              title="Сбросить демо-состояние арены к начальному"
            >
              <span class="material-symbols-rounded text-sm">restart_alt</span>
              <span>Сбросить демо</span>
            </button>
          </div>
        </div>

        <!-- Быстрые фильтры категорий персонажей -->
        <div class="flex items-center gap-1.5 flex-wrap">
          @for (cat of categoryFilters; track cat.id) {
            <button
              type="button"
              (click)="selectedActorCategory.set(cat.id)"
              class="px-3 py-1 rounded-xl font-label-ui text-xs font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                selectedActorCategory() === cat.id
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
              "
            >
              {{ cat.label }}
              @if (cat.id === 'ALL') {
                ({{ ((arena.actors$ | async) ?? []).length }})
              }
            </button>
          }
        </div>

        <!-- Character Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          @for (actor of filterActors((arena.actors$ | async) ?? []); track actor.id) {
            <div
              (click)="selectMainActor(actor)"
              class="rounded-2xl p-space-md transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden group"
              [class]="
                actor.isLead
                  ? 'bg-surface-container-lowest border-2 border-primary shadow-md ring-4 ring-primary/15'
                  : 'bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/60 shadow-xs'
              "
            >
              @if (actor.isLead) {
                <div
                  class="px-3 py-1 rounded-bl-xl bg-primary text-on-primary font-label-code-sm text-[10px] font-bold uppercase tracking-wider absolute top-0 right-0 flex items-center gap-1.5 shadow-xs"
                >
                  <span class="w-2 h-2 rounded-full bg-on-primary animate-pulse"></span>
                  <span>ГЛАВНЫЙ ПЕРСОНАЖ · МИКРОФОН АКТИВЕН</span>
                </div>
              } @else {
                <div
                  class="px-2.5 py-1 rounded-bl-xl bg-surface-container-high text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary-container font-label-code-sm text-[10px] font-bold uppercase absolute top-0 right-0 transition-colors"
                >
                  Сделать главным
                </div>
              }

              <div class="flex flex-col gap-2.5 pt-2">
                <div class="flex items-start gap-3">
                  <app-actor-avatar
                    [avatar]="actor.avatarIcon"
                    [containerClass]="
                      actor.isLead
                        ? 'w-16 h-16 rounded-2xl shadow-sm ring-2 ring-primary flex-shrink-0'
                        : 'w-16 h-16 rounded-2xl shadow-xs border border-outline-variant/30 flex-shrink-0 group-hover:scale-105 transition-transform'
                    "
                  />
                  <div class="min-w-0 flex-1 pr-16">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span
                        class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                        [class]="getAccentPillClasses(actor.accentColor)"
                      >
                        {{ actor.categoryLabel }}
                      </span>
                      <span class="font-label-code-sm text-[10px] text-outline">
                        {{ actor.rankLabel }}
                      </span>
                    </div>
                    <h3 class="font-headline-sm text-base font-bold text-on-surface mt-1 truncate">
                      {{ actor.name }}
                    </h3>
                    <p class="font-label-ui text-xs text-on-surface-variant truncate">
                      {{ actor.title }}
                    </p>
                  </div>
                </div>

                <blockquote
                  class="p-2.5 rounded-xl bg-surface-container-low/80 border-l-2 border-primary font-body-sm text-xs italic text-on-surface"
                >
                  {{ actor.quote }}
                </blockquote>

                <div class="text-xs font-body-sm text-on-surface-variant">
                  <strong class="text-on-surface font-semibold">Взгляд на парадоксы:</strong>
                  {{ actor.paradoxPhilosophy }}
                </div>

                <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-surface-container-low text-xs">
                  <span class="text-on-surface-variant font-label-ui">Любимая карточка:</span>
                  <span class="font-label-ui font-bold text-primary flex items-center gap-1">
                    <span class="material-symbols-rounded text-sm">style</span>
                    {{ actor.favoriteDesire }}
                  </span>
                </div>

                <!-- PINNED NOTES PREVIEW (HERO PINS & PERSONAL PERSPECTIVE) -->
                @if ((arena.getPinnedHeroNotes(actor.id) | async); as pinnedNotes) {
                  @if (pinnedNotes.length > 0) {
                    <div class="p-2 rounded-xl bg-primary-container/20 border border-primary/25 flex flex-col gap-1 text-[11px]">
                      <div class="flex items-center justify-between text-primary font-label-code-sm font-bold text-[10px]">
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-rounded text-xs">push_pin</span>
                          <span>Заметки героя ({{ pinnedNotes.length }}):</span>
                        </span>
                        <span class="text-[9px] uppercase tracking-wider opacity-75">Закреплено</span>
                      </div>
                      @for (pn of pinnedNotes.slice(0, 2); track pn.id) {
                        <div class="truncate text-on-surface flex items-center gap-1 font-body-sm">
                          <span>{{ pn.visibility === 'PRIVATE' ? '🔒' : '🌐' }}</span>
                          <span class="truncate">{{ pn.text }}</span>
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              <div class="pt-2 border-t border-outline-variant/20 flex flex-col gap-2">
                <div class="grid grid-cols-3 gap-2 text-[10px] font-label-code-sm">
                  <div>
                    <div class="flex justify-between text-on-surface-variant">
                      <span>Харизма</span>
                      <strong>{{ actor.traits.charisma }}</strong>
                    </div>
                    <div class="h-1 bg-surface-container-high rounded-full overflow-hidden mt-0.5">
                      <div class="h-full bg-amber-500" [style.width.%]="actor.traits.charisma"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-on-surface-variant">
                      <span>Аналитика</span>
                      <strong>{{ actor.traits.analytical }}</strong>
                    </div>
                    <div class="h-1 bg-surface-container-high rounded-full overflow-hidden mt-0.5">
                      <div class="h-full bg-emerald-500" [style.width.%]="actor.traits.analytical"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-on-surface-variant">
                      <span>Versus-Дух</span>
                      <strong>{{ actor.traits.rebelVersus }}</strong>
                    </div>
                    <div class="h-1 bg-surface-container-high rounded-full overflow-hidden mt-0.5">
                      <div class="h-full bg-indigo-500" [style.width.%]="actor.traits.rebelVersus"></div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-1">
                  <div class="flex flex-wrap gap-1">
                    @for (tag of actor.affinities.slice(0, 3); track tag) {
                      <span class="font-label-code-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                        {{ tag }}
                      </span>
                    }
                  </div>
                  <span class="font-label-code-sm text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
                    <span class="material-symbols-rounded text-xs">graphic_eq</span>
                    {{ actor.voicesCount }} войсов
                  </span>
                </div>

                <!-- HERO NOTES ACTION BAR -->
                <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-outline-variant/15">
                  <button
                    type="button"
                    (click)="openHeroNotes(actor, $event)"
                    class="px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    title="Открыть блокнот заметок и личные связи"
                  >
                    <span class="material-symbols-rounded text-sm text-primary">edit_note</span>
                    <span>Заметки</span>
                    @if ((arena.getHeroNotes(actor.id) | async); as heroNotes) {
                      @if (heroNotes.length > 0) {
                        <span class="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-mono">
                          {{ heroNotes.length }}
                        </span>
                      }
                    }
                  </button>

                  <button
                    type="button"
                    (click)="openHeroNotes(actor, $event)"
                    class="px-2 py-1 rounded-xl bg-primary/10 hover:bg-primary hover:text-on-primary text-primary font-label-ui text-xs font-semibold transition-all inline-flex items-center gap-1"
                    title="Прикрепить заметку к персонажу"
                  >
                    <span class="material-symbols-rounded text-sm">add</span>
                    <span>Note</span>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <app-arena-voice-studio />

      <!-- HERO NOTES & HYBRID RELATIONSHIP MODAL -->
      <app-arena-hero-notes-modal
        [actor]="selectedActorForNotes()"
        [isOpen]="selectedActorForNotes() !== null"
        (close)="selectedActorForNotes.set(null)"
      />
    </div>
  `,
})
export class ArenaActorDeckComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly selectedActorCategory = signal<'ALL' | ArenaActorCategory>('ALL');
  readonly selectedActorForNotes = signal<ArenaActorCard | null>(null);
  actorSearchQuery = '';

  readonly categoryFilters: { id: 'ALL' | ArenaActorCategory; label: string }[] = [
    { id: 'ALL', label: 'Все персонажи' },
    { id: 'HUMAN', label: '🏠 Главные герои, Друзья и Звёзды' },
    { id: 'MYTHIC', label: '⚡ Боги, Легенды и Религия' },
    { id: 'SAGE', label: '🧠 Учёные, Мудрецы и Тайная Ложа' },
    { id: 'CYBER', label: '💻 Программисты, Аниме и Антагонисты' },
  ];

  selectMainActor(actor: ArenaActorCard): void {
    this.arena.selectLeadActor(actor.id);
  }

  openHeroNotes(actor: ArenaActorCard, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedActorForNotes.set(actor);
  }

  filterActors(actors: ArenaActorCard[]): ArenaActorCard[] {
    const cat = this.selectedActorCategory();
    const q = this.actorSearchQuery.trim().toLowerCase();
    return actors.filter((a) => {
      if (cat !== 'ALL' && a.category !== cat) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.categoryLabel.toLowerCase().includes(q) ||
        a.affinities.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }
}
