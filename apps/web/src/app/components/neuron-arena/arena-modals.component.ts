import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { ArenaActorCategory } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { IconCatalogItem } from '../icon-picker/icon-catalog';
import { IconPickerComponent } from '../icon-picker/icon-picker.component';

@Component({
  selector: 'app-arena-modals',
  standalone: true,
  imports: [AsyncPipe, FormsModule, ModalOverlayDirective, IconPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- MODAL 1: СОЗДАТЬ НОВУЮ КАРТОЧКУ ЖЕЛАНИЯ В КОЛОДЕ -->
    @if (showNewDesireCardModal) {
      <div
        appModalOverlay
        (overlayClose)="onCloseDesireCardModal()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="new-desire-card-title"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 id="new-desire-card-title" class="font-headline-sm text-lg font-bold text-on-surface">
              Новая Карточка Желания в Колоду
            </h3>
            <button
              type="button"
              (click)="onCloseDesireCardModal()"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              aria-label="Закрыть"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название карточки желания</span>
              <input
                type="text"
                [(ngModel)]="newCardTitle"
                placeholder="Напр.: Поиграть в настольную игру / Поехать на картинг / Сходить в баню"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Категория</span>
                <input
                  type="text"
                  [(ngModel)]="newCardCategory"
                  placeholder="Настолки & Азарт / Бар / Спорт"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                />
                @if (suggestedCategoryNotice) {
                  <span class="text-[10px] text-primary font-medium animate-in fade-in duration-200">
                    {{ suggestedCategoryNotice }}
                  </span>
                }
              </label>

              <app-icon-picker
                [(value)]="newCardIcon"
                (iconSelected)="onCardIconSelected($event)"
              />
            </div>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Описание карточки желания</span>
              <textarea
                [(ngModel)]="newCardDescription"
                rows="2"
                placeholder="В чём кайф этой хотелки для команды..."
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              ></textarea>
            </label>

            <label class="flex items-center gap-2 text-xs font-label-ui text-on-surface cursor-pointer">
              <input type="checkbox" [(ngModel)]="newCardPlayImmediately" class="rounded accent-primary w-4 h-4" />
              <span>Сразу разыграть эту карточку в текущем Поле Спора (Versus Mode)</span>
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="onCloseDesireCardModal()"
              class="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-ui text-xs font-bold"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewDesireCard()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Создать карточку желания
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 2: СОЗДАТЬ НОВОГО ПЕРСОНАЖА -->
    @if (showNewActorModal) {
      <div
        appModalOverlay
        (overlayClose)="onCloseActorModal()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="new-actor-title"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 id="new-actor-title" class="font-headline-sm text-lg font-bold text-on-surface">
              Новая Карточка Персонажа
            </h3>
            <button
              type="button"
              (click)="onCloseActorModal()"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              aria-label="Закрыть"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Имя персонажа</span>
                <input
                  type="text"
                  [(ngModel)]="newActorName"
                  placeholder="Напр.: Один Деплойщик / Аня QA"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Природа персонажа</span>
                <select
                  [(ngModel)]="newActorCategory"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                >
                  <option value="HUMAN">Простой человек</option>
                  <option value="MYTHIC">Мифический персонаж</option>
                  <option value="CYBER">Кибер-Персонаж</option>
                  <option value="SAGE">Философ-Аналитик</option>
                </select>
              </label>
            </div>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Роль / Титул в команде</span>
              <input
                type="text"
                [(ngModel)]="newActorTitle"
                placeholder="Напр.: Повелитель Настолок · Хранитель Релизов"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Любимая карточка желания</span>
              <input
                type="text"
                [(ngModel)]="newActorFavoriteDesire"
                placeholder="Напр.: Поиграть в настольную игру"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Коронная цитата</span>
              <input
                type="text"
                [(ngModel)]="newActorQuote"
                placeholder="«Любой баг меркнет перед хорошей партией в настолку!»"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Оптика на парадоксы и аналитика</span>
              <textarea
                [(ngModel)]="newActorPhilosophy"
                rows="2"
                placeholder="Как этот персонаж комментирует командные споры и парадоксы..."
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              ></textarea>
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="onCloseActorModal()"
              class="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-ui text-xs font-bold"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewActor()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Создать и сделать Главным
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 3: СОЗДАТЬ НОВЫЙ СПОР / ПОЛЕ ПАРАДОКСА -->
    @if (showNewParadoxModal) {
      <div
        appModalOverlay
        (overlayClose)="onCloseParadoxModal()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="new-paradox-title"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 id="new-paradox-title" class="font-headline-sm text-lg font-bold text-on-surface">
              Запустить Новый Спор / Игру Карточек Желаний
            </h3>
            <button
              type="button"
              (click)="onCloseParadoxModal()"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              aria-label="Закрыть"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название спора / повода</span>
              <input
                type="text"
                [(ngModel)]="newParadoxTitle"
                placeholder="Напр.: Вечер после релиза v3.0: Куда идём командой?"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Стартовая Карточка Желания в поле</span>
              <select
                [(ngModel)]="newParadoxStarterCardId"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              >
                @for (c of (arena.desireCards$ | async) ?? []; track c.id) {
                  <option [value]="c.id">
                    «{{ c.title }}» ({{ c.gamesPlayed }} игр · {{ c.winsCount }} побед)
                  </option>
                }
              </select>
            </label>

            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Вопрос парадокса для обсуждения</span>
              <textarea
                [(ngModel)]="newParadoxQuestion"
                rows="2"
                placeholder="Какую дилемму или парадокс обсуждают персонажи в этом раунде?"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              ></textarea>
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="onCloseParadoxModal()"
              class="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-ui text-xs font-bold"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewParadox()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Запустить Игру в Поле
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ArenaModalsComponent {
  protected readonly arena = inject(NeuronArenaService);

  @Input() showNewDesireCardModal = false;
  @Input() showNewActorModal = false;
  @Input() showNewParadoxModal = false;

  @Output() readonly closeNewDesireCardModal = new EventEmitter<void>();
  @Output() readonly closeNewActorModal = new EventEmitter<void>();
  @Output() readonly closeNewParadoxModal = new EventEmitter<void>();

  newCardTitle = '';
  newCardCategory = 'Настолки & Азарт';
  newCardIcon = 'casino';
  newCardDescription = '';
  newCardPlayImmediately = true;
  suggestedCategoryNotice = '';

  onCardIconSelected(item: IconCatalogItem): void {
    // If the category hasn't been heavily customized by user or matches the previous default,
    // smartly adapt the category to match the chosen icon!
    if (!this.newCardCategory.trim() || this.newCardCategory === 'Настолки & Азарт') {
      if (item.suggestedCategory) {
        this.newCardCategory = item.suggestedCategory;
        this.suggestedCategoryNotice = `✨ Категория: «${item.suggestedCategory}»`;
        setTimeout(() => {
          this.suggestedCategoryNotice = '';
        }, 3500);
      }
    }
  }

  newActorName = '';
  newActorTitle = '';
  newActorCategory: ArenaActorCategory = 'MYTHIC';
  newActorFavoriteDesire = 'Поиграть в настольную игру';
  newActorQuote = '';
  newActorPhilosophy = '';

  newParadoxTitle = '';
  newParadoxStarterCardId = 'card-drink-beer';
  newParadoxQuestion = '';

  onCloseDesireCardModal(): void {
    this.newCardTitle = '';
    this.newCardDescription = '';
    this.newCardCategory = 'Настолки & Азарт';
    this.newCardIcon = 'casino';
    this.suggestedCategoryNotice = '';
    this.closeNewDesireCardModal.emit();
  }

  onCloseActorModal(): void {
    this.newActorName = '';
    this.newActorTitle = '';
    this.newActorQuote = '';
    this.newActorPhilosophy = '';
    this.closeNewActorModal.emit();
  }

  onCloseParadoxModal(): void {
    this.newParadoxTitle = '';
    this.newParadoxQuestion = '';
    this.closeNewParadoxModal.emit();
  }

  submitNewDesireCard(): void {
    if (!this.newCardTitle.trim()) return;
    this.arena.createDesireCard({
      title: this.newCardTitle,
      category: this.newCardCategory,
      description: this.newCardDescription,
      icon: this.newCardIcon,
      colorTheme: 'violet',
      playImmediately: this.newCardPlayImmediately,
    });
    this.newCardTitle = '';
    this.newCardDescription = '';
    this.newCardCategory = 'Настолки & Азарт';
    this.newCardIcon = 'casino';
    this.suggestedCategoryNotice = '';
    this.closeNewDesireCardModal.emit();
  }

  submitNewActor(): void {
    if (!this.newActorName.trim()) return;
    this.arena.createActorCard({
      name: this.newActorName,
      title: this.newActorTitle,
      category: this.newActorCategory,
      avatarIcon: this.newActorCategory === 'MYTHIC' ? 'zeus' : 'alexey',
      accentColor: this.newActorCategory === 'MYTHIC' ? 'emerald' : 'amber',
      quote: this.newActorQuote,
      paradoxPhilosophy: this.newActorPhilosophy,
      favoriteDesire: this.newActorFavoriteDesire,
    });
    this.newActorName = '';
    this.newActorTitle = '';
    this.newActorQuote = '';
    this.newActorPhilosophy = '';
    this.closeNewActorModal.emit();
  }

  submitNewParadox(): void {
    if (!this.newParadoxTitle.trim()) return;
    this.arena.createParadoxField({
      title: this.newParadoxTitle,
      occasionTag: 'Тимбилдинг · Битва Карточек Желаний',
      contextStory:
        'Новый раунд командной синхронизации: персонажи выбрасывают карточки желаний из колоды и проверяют, что выйдет вперёд на этот раз!',
      paradoxQuestion:
        this.newParadoxQuestion.trim() ||
        'Какая карточка желания соберёт максимальный резонанс команды в этом периоде?',
      starterDesireCardId: this.newParadoxStarterCardId,
    });
    this.newParadoxTitle = '';
    this.newParadoxQuestion = '';
    this.closeNewParadoxModal.emit();
  }
}
