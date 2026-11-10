import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaActorCard,
  CloudDayNote,
  CloudItemType,
  NoteVisibility,
} from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ProfileService } from '../../core/services/profile.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses, getAccentPillClasses } from './arena-ui.utils';

export type HeroNoteFilterTab = 'ALL' | 'PINNED' | 'PRIVATE' | 'PUBLIC' | 'GM_ONLY';

@Component({
  selector: 'app-arena-hero-notes-modal',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, ModalOverlayDirective, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen && actor) {
      <div
        appModalOverlay
        (overlayClose)="onDismiss()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        aria-labelledby="hero-notes-modal-title"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-4 sm:p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20 flex-shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <app-actor-avatar
                [avatar]="actor.avatarIcon"
                [containerClass]="'w-12 h-12 rounded-xl shadow-xs ring-2 ring-primary/20 flex-shrink-0'"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 id="hero-notes-modal-title" class="font-headline-sm text-base font-bold text-on-surface truncate">
                    {{ actor.name }}
                  </h3>
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
                <p class="font-body-sm text-xs text-on-surface-variant truncate">
                  Блокнот заметок персонажа & личные связи
                </p>
              </div>
            </div>

            <button
              type="button"
              (click)="onDismiss()"
              class="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              aria-label="Закрыть модальное окно"
            >
              <span class="material-symbols-rounded text-xl">close</span>
            </button>
          </div>

          <!-- ACTIVE PROFILE BANNER & RELATIONSHIP EXPLANATION -->
          <div class="p-2.5 rounded-xl bg-primary-container/20 border border-primary/20 flex items-center justify-between gap-2 text-xs flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-primary text-base">connect_without_contact</span>
              <span class="text-on-surface">
                Вы в роли: <strong class="font-semibold">{{ (profile.activeProfile$ | async)?.displayName || 'Игрок' }}</strong>
              </span>
            </div>
            <span class="font-label-code-sm text-[11px] text-on-surface-variant hidden sm:inline">
              Гибридная модель: личные заметки изолированы, публичные синхронизируются в хаб
            </span>
          </div>

          <!-- CREATE NOTE FORM -->
          <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2.5 flex-shrink-0">
            <div class="flex items-center justify-between">
              <span class="font-label-ui text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm text-primary">edit_note</span>
                <span>Добавить заметку к персонажу</span>
              </span>

              <!-- Note Type Buttons -->
              <div class="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
                <button
                  type="button"
                  (click)="newNoteType.set('thought')"
                  class="px-2 py-0.5 rounded text-[11px] font-label-ui font-semibold transition-colors"
                  [class]="newNoteType() === 'thought' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  💭 Мысль
                </button>
                <button
                  type="button"
                  (click)="newNoteType.set('proposal')"
                  class="px-2 py-0.5 rounded text-[11px] font-label-ui font-semibold transition-colors"
                  [class]="newNoteType() === 'proposal' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  💡 Идея
                </button>
                <button
                  type="button"
                  (click)="newNoteType.set('action')"
                  class="px-2 py-0.5 rounded text-[11px] font-label-ui font-semibold transition-colors"
                  [class]="newNoteType() === 'action' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  ⚡ Действие
                </button>
              </div>
            </div>

            <textarea
              [(ngModel)]="newNoteText"
              rows="2"
              placeholder="Что вы хотите отметить про этого персонажа? (личная мысль, план, обещание или идея для партии)..."
              class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
            ></textarea>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-outline-variant/20">
              <!-- Visibility Switcher: 3 Tiers (Public, Archaic GM Lore, Admin Personal) -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-label-ui text-[11px] text-on-surface-variant">Уровень доступа:</span>
                <button
                  type="button"
                  (click)="newNoteVisibility.set('PUBLIC')"
                  class="px-2 py-1 rounded-lg text-[11px] font-label-ui font-bold border transition-colors inline-flex items-center gap-1"
                  [class]="
                    newNoteVisibility() === 'PUBLIC'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                  "
                  title="Заметку увидят все игроки в общем хабе персонажа"
                >
                  <span class="material-symbols-rounded text-xs">public</span>
                  <span>🌐 Общий Хаб</span>
                </button>

                <button
                  type="button"
                  (click)="newNoteVisibility.set('GM_ONLY')"
                  class="px-2 py-1 rounded-lg text-[11px] font-label-ui font-bold border transition-colors inline-flex items-center gap-1"
                  [class]="
                    newNoteVisibility() === 'GM_ONLY'
                      ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                  "
                  title="Архаичный лор / Секрет мастера (GM Only) — виден только администратору"
                >
                  <span class="material-symbols-rounded text-xs">auto_awesome</span>
                  <span>📜 Архаичный лор (GM)</span>
                </button>

                <button
                  type="button"
                  (click)="newNoteVisibility.set('PRIVATE')"
                  class="px-2 py-1 rounded-lg text-[11px] font-label-ui font-bold border transition-colors inline-flex items-center gap-1"
                  [class]="
                    newNoteVisibility() === 'PRIVATE'
                      ? 'bg-primary-container text-on-primary-container border-primary/40'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                  "
                  title="Личный админ: заметка видна только вам для личной игры"
                >
                  <span class="material-symbols-rounded text-xs">lock</span>
                  <span>🔒 Личный админ</span>
                </button>
              </div>

              <!-- Pin Options & Submit -->
              <div class="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <label class="inline-flex items-center gap-1 cursor-pointer text-[11px] font-label-ui text-on-surface">
                  <input
                    type="checkbox"
                    [(ngModel)]="newNotePinToHero"
                    class="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>📌 Запинить в герое</span>
                </label>

                <label class="inline-flex items-center gap-1 cursor-pointer text-[11px] font-label-ui text-on-surface">
                  <input
                    type="checkbox"
                    [(ngModel)]="newNotePinToCloud"
                    class="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>☁️ В облака</span>
                </label>

                <button
                  type="button"
                  (click)="submitNote()"
                  [disabled]="!newNoteText.trim()"
                  class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 shadow-xs"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>

          <!-- TABS FILTER -->
          <div class="flex items-center gap-1.5 border-b border-outline-variant/20 pb-2 flex-shrink-0 flex-wrap">
            <button
              type="button"
              (click)="activeTab.set('ALL')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-colors"
              [class]="
                activeTab() === 'ALL'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              Все ({{ getTabCount('ALL', (heroNotes$ | async) ?? []) }})
            </button>

            <button
              type="button"
              (click)="activeTab.set('PINNED')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-colors inline-flex items-center gap-1"
              [class]="
                activeTab() === 'PINNED'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>📌 Закрепленные</span>
              <span>({{ getTabCount('PINNED', (heroNotes$ | async) ?? []) }})</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('PRIVATE')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-colors inline-flex items-center gap-1"
              [class]="
                activeTab() === 'PRIVATE'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>🔒 Мои личные</span>
              <span>({{ getTabCount('PRIVATE', (heroNotes$ | async) ?? []) }})</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('PUBLIC')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-colors inline-flex items-center gap-1"
              [class]="
                activeTab() === 'PUBLIC'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>🌐 Общие из Хаба</span>
              <span>({{ getTabCount('PUBLIC', (heroNotes$ | async) ?? []) }})</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('GM_ONLY')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-colors inline-flex items-center gap-1"
              [class]="
                activeTab() === 'GM_ONLY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-700 dark:text-purple-300 hover:bg-purple-500/10'
              "
            >
              <span class="material-symbols-rounded text-xs">auto_awesome</span>
              <span>📜 Архаичный лор (GM)</span>
              <span>({{ getTabCount('GM_ONLY', (heroNotes$ | async) ?? []) }})</span>
            </button>
          </div>

          <!-- NOTES LIST -->
          <div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-[160px]">
            @for (note of filterNotes((heroNotes$ | async) ?? []); track note.id) {
              <div
                class="p-3 rounded-xl border transition-all flex flex-col gap-2"
                [class]="
                  note.isPinnedToHero
                    ? 'bg-surface-container-lowest border-primary/50 shadow-xs ring-1 ring-primary/20'
                    : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant/60'
                "
              >
                <!-- Note Top Row -->
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    @if (note.isPinnedToHero) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-label-code-sm text-[10px] font-bold">
                        <span class="material-symbols-rounded text-xs">push_pin</span>
                        <span>В герое</span>
                      </span>
                    }

                    @if (note.isPinnedToCloud) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-label-code-sm text-[10px] font-bold">
                        <span class="material-symbols-rounded text-xs">cloud</span>
                        <span>В облаках</span>
                      </span>
                    }

                    <!-- Visibility Badge: 3 Tiers (Public, Archaic GM Lore, Admin Personal) -->
                    @if (note.visibility === 'GM_ONLY') {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-800 dark:text-purple-300 font-label-code-sm text-[10px] font-bold border border-purple-500/30">
                        <span class="material-symbols-rounded text-xs">auto_awesome</span>
                        <span>Архаичный лор (GM)</span>
                      </span>
                    } @else if (note.visibility === 'PRIVATE') {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-code-sm text-[10px] font-bold">
                        <span class="material-symbols-rounded text-xs">lock</span>
                        <span>Личный админ</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-label-code-sm text-[10px] font-semibold">
                        <span class="material-symbols-rounded text-xs">public</span>
                        <span>Общий Хаб</span>
                      </span>
                    }

                    <span class="text-[11px] font-label-code-sm text-outline">
                      {{ note.time }} · {{ note.dateKey }}
                    </span>
                  </div>

                  <!-- Author Pill -->
                  <div class="text-[11px] font-label-ui text-on-surface-variant flex items-center gap-1">
                    <span class="material-symbols-rounded text-xs">person</span>
                    <span>{{ isMyNote(note) ? 'Вы' : note.authorProfileName || 'Хаб' }}</span>
                  </div>
                </div>

                <!-- Fork info if adopted -->
                @if (note.forkedFromNoteId) {
                  <div class="px-2 py-1 rounded-lg bg-surface-container-low text-[10px] font-label-code-sm text-primary flex items-center gap-1 border border-primary/20">
                    <span class="material-symbols-rounded text-xs">download_done</span>
                    <span>Забрано из Общего облака себе в личные заметки (оригинал: {{ note.forkedFromAuthorName }})</span>
                  </div>
                }

                <!-- Note Text -->
                <p class="font-body-sm text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                  {{ note.text }}
                </p>

                <!-- Actions Bar -->
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 flex-wrap">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <!-- Toggle Pin to Hero -->
                    <button
                      type="button"
                      (click)="arena.togglePinToHero(note.id)"
                      class="px-2 py-1 rounded-lg font-label-ui text-[11px] border transition-colors inline-flex items-center gap-1"
                      [class]="
                        note.isPinnedToHero
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                      "
                      title="Закрепить или открепить в карточке этого персонажа"
                    >
                      <span class="material-symbols-rounded text-xs">push_pin</span>
                      <span>{{ note.isPinnedToHero ? 'Открепить' : '📌 В героя' }}</span>
                    </button>

                    <!-- Toggle Pin to Cloud -->
                    <button
                      type="button"
                      (click)="arena.togglePinToCloud(note.id)"
                      class="px-2 py-1 rounded-lg font-label-ui text-[11px] border transition-colors inline-flex items-center gap-1"
                      [class]="
                        note.isPinnedToCloud
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                      "
                      title="Закрепить или открепить в летающих облачках"
                    >
                      <span class="material-symbols-rounded text-xs">cloud</span>
                      <span>{{ note.isPinnedToCloud ? 'Убрать из облаков' : '☁️ В облака' }}</span>
                    </button>

                    <!-- Adopt to My Private Notes (if public and not mine) -->
                    @if (note.visibility !== 'PRIVATE' && !isMyNote(note)) {
                      <button
                        type="button"
                        (click)="adoptToPrivate(note.id)"
                        class="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-[11px] font-bold border border-outline-variant/30 transition-colors inline-flex items-center gap-1"
                        title="Создать личную копию этой мысли для себя в своем отношении с героем"
                      >
                        <span class="material-symbols-rounded text-xs">file_download</span>
                        <span>Забрать себе</span>
                      </button>
                    }
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- Vote count -->
                    <button
                      type="button"
                      (click)="arena.voteForNote(note.id)"
                      class="px-2 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-[11px] font-label-code-sm inline-flex items-center gap-1 transition-colors"
                      title="Поддержать мысль"
                    >
                      <span class="material-symbols-rounded text-xs text-rose-500">favorite</span>
                      <span>{{ note.votesCount || 0 }}</span>
                    </button>

                    <!-- Delete button (for my notes) -->
                    @if (isMyNote(note) || note.visibility === 'PRIVATE') {
                      <button
                        type="button"
                        (click)="arena.deleteNote(note.id)"
                        class="p-1 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                        title="Удалить заметку"
                      >
                        <span class="material-symbols-rounded text-sm">delete</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
                <span class="material-symbols-rounded text-3xl opacity-40">note_alt</span>
                <span class="font-body-sm text-xs">
                  @if (activeTab() === 'PINNED') {
                    У героя пока нет закрепленных заметок.
                  } @else if (activeTab() === 'PRIVATE') {
                    У вас пока нет личных заметок по этому герою.
                  } @else {
                    Заметок пока нет. Напишите первую выше!
                  }
                </span>
              </div>
            }
          </div>

          <!-- FOOTER -->
          <div class="pt-3 border-t border-outline-variant/20 flex items-center justify-between flex-shrink-0">
            <span class="font-label-code-sm text-[11px] text-outline">
              💡 Заметки синхронизируются в реальном времени с Полем Облачков
            </span>
            <button
              type="button"
              (click)="onDismiss()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ArenaHeroNotesModalComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly profile = inject(ProfileService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  @Input() actor: ArenaActorCard | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  readonly activeTab = signal<HeroNoteFilterTab>('ALL');

  newNoteText = '';
  readonly newNoteType = signal<CloudItemType>('thought');
  readonly newNoteVisibility = signal<NoteVisibility>('PUBLIC');
  newNotePinToHero = true;
  newNotePinToCloud = false;

  get heroNotes$() {
    return this.actor ? this.arena.getHeroNotes(this.actor.id) : null;
  }

  onDismiss(): void {
    this.resetForm();
    this.close.emit();
  }

  resetForm(): void {
    this.newNoteText = '';
    this.newNoteType.set('thought');
    this.newNoteVisibility.set('PUBLIC');
    this.newNotePinToHero = true;
    this.newNotePinToCloud = false;
  }

  isMyNote(note: CloudDayNote): boolean {
    return note.authorProfileId === this.profile.currentProfileId;
  }

  submitNote(): void {
    if (!this.actor || !this.newNoteText.trim()) return;

    this.arena.addHeroNote({
      actorId: this.actor.id,
      text: this.newNoteText,
      type: this.newNoteType(),
      visibility: this.newNoteVisibility(),
      isPinnedToHero: this.newNotePinToHero,
      isPinnedToCloud: this.newNotePinToCloud,
    });

    this.resetForm();
  }

  adoptToPrivate(noteId: string): void {
    this.arena.adoptNoteToPrivate(noteId);
  }

  filterNotes(notes: CloudDayNote[]): CloudDayNote[] {
    const tab = this.activeTab();
    if (tab === 'PINNED') {
      return notes.filter((n) => Boolean(n.isPinnedToHero));
    }
    if (tab === 'PRIVATE') {
      return notes.filter((n) => n.visibility === 'PRIVATE');
    }
    if (tab === 'PUBLIC') {
      return notes.filter((n) => n.visibility === 'PUBLIC' || !n.visibility);
    }
    if (tab === 'GM_ONLY') {
      return notes.filter((n) => n.visibility === 'GM_ONLY');
    }
    return notes;
  }

  getTabCount(tab: HeroNoteFilterTab, notes: CloudDayNote[]): number {
    return this.filterNotes(notes).length;
  }
}
