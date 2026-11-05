import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HomeTrackerService } from '../../core/services/home-tracker.service';
import { ProfileService } from '../../core/services/profile.service';
import { HomeModalsComponent } from './home-modals.component';
import { HomeSupplyCardComponent } from './home-supply-card.component';
import { HomeTasksAndRoutinesComponent } from './home-tasks-and-routines.component';

@Component({
  selector: 'app-home-tracker',
  standalone: true,
  imports: [AsyncPipe, HomeTasksAndRoutinesComponent, HomeModalsComponent, HomeSupplyCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      <!-- Top Profile & Scope Bar -->
      <section
        class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md"
      >
        <div class="flex items-start sm:items-center gap-space-md">
          <div
            class="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 shadow-xs"
          >
            <span class="material-symbols-rounded text-2xl" style="font-variation-settings: 'FILL' 1">
              {{ (profileService.activeProfile$ | async)?.avatarIcon || 'home' }}
            </span>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="font-headline-sm text-lg font-bold text-on-surface">
                {{ (profileService.activeProfile$ | async)?.displayName }}
              </h1>
              <span
                class="font-label-code-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant"
              >
                &#64;{{ (profileService.activeProfile$ | async)?.handle }}
              </span>
              <span
                class="inline-flex items-center gap-1 font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-success-container text-on-success-container font-semibold"
              >
                <span class="material-symbols-rounded text-xs">verified_user</span>
                ltree scope: home.*
              </span>
            </div>
            <p class="font-body-sm text-xs text-on-surface-variant mt-1">
              Первое императивное приложение поверх реактивной шины Core Combinator. Каждый бытовой запас — это
              поток-мьютекс в контейнере <code class="font-label-code-sm">home.supplies</code>, а домашние дела —
              Scheduled Mutex в <code class="font-label-code-sm">home.routines</code>.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @for (prof of (profileService.profiles$ | async) ?? []; track prof.id) {
            <button
              type="button"
              (click)="profileService.selectProfile(prof.id)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-ui text-xs font-semibold transition-all border"
              [class]="
                (profileService.activeProfile$ | async)?.id === prof.id
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface hover:bg-surface-container'
              "
            >
              <span class="material-symbols-rounded text-base">{{ prof.avatarIcon || 'home' }}</span>
              <span>{{ prof.displayName }}</span>
            </button>
          }

          <button
            type="button"
            (click)="showProfileModal.set(true)"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-label-ui text-xs font-semibold bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors"
          >
            <span class="material-symbols-rounded text-base">person_add</span>
            <span>+ Профиль</span>
          </button>
        </div>
      </section>

      <!-- Reactive KPI Summary Cards -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/20">
          <div class="flex items-center justify-between">
            <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              В наличии дома (Mutex ACTIVE)
            </span>
            <span class="w-8 h-8 rounded-lg bg-success-container text-on-success-container flex items-center justify-center">
              <span class="material-symbols-rounded text-lg">check_circle</span>
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-display-lg text-3xl font-bold text-on-surface">
              {{ ((home.inStockSupplies$ | async) ?? []).length }}
            </span>
            <span class="font-body-sm text-xs text-success font-medium">ресурсов не требуют покупки</span>
          </div>
        </div>

        <div
          class="rounded-xl p-space-md shadow-xs border transition-all"
          [class]="
            ((home.shoppingList$ | async) ?? []).length > 0
              ? 'bg-warning/10 border-warning/40'
              : 'bg-surface-container-lowest border-outline-variant/20'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Список покупок (Mutex INACTIVE)
            </span>
            <span class="w-8 h-8 rounded-lg bg-warning text-on-warning flex items-center justify-center">
              <span class="material-symbols-rounded text-lg">shopping_cart</span>
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-display-lg text-3xl font-bold text-on-surface">
              {{ ((home.shoppingList$ | async) ?? []).length }}
            </span>
            <span class="font-body-sm text-xs text-on-surface-variant">позиций ждут пополнения</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/20">
          <div class="flex items-center justify-between">
            <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Домашние рутины (Scheduled Mutex)
            </span>
            <span class="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span class="material-symbols-rounded text-lg">event_repeat</span>
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-display-lg text-3xl font-bold text-on-surface">
              {{ ((home.routineWidgets$ | async) ?? []).length }}
            </span>
            <span class="font-body-sm text-xs text-on-surface-variant">активных расписаний в home.routines</span>
          </div>
        </div>
      </section>

      <!-- Reactive Shopping List Strip -->
      @if (((home.shoppingList$ | async) ?? []); as shoppingItems) {
        @if (shoppingItems.length > 0) {
          <section class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border-2 border-warning/40 flex flex-col gap-space-sm">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-warning text-xl">shopping_bag</span>
              <h2 class="font-headline-sm text-sm font-bold text-on-surface">
                Реактивный список покупок ({{ shoppingItems.length }})
              </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              @for (item of shoppingItems; track item.flow.id) {
                <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-warning flex-shrink-0">
                      <span class="material-symbols-rounded text-lg">{{ item.icon }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="font-label-ui text-sm font-bold text-on-surface truncate">{{ item.flow.name }}</div>
                      <div class="font-label-code-sm text-[11px] text-on-surface-variant truncate">
                        {{ item.room }} · {{ item.unitHint }}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    (click)="home.markRestocked(item.flow.id)"
                    class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-90 transition-opacity flex-shrink-0 inline-flex items-center gap-1 shadow-xs"
                  >
                    <span class="material-symbols-rounded text-sm">add_shopping_cart</span>
                    <span>Купили</span>
                  </button>
                </div>
              }
            </div>
          </section>
        }
      }

      <!-- Stock Health Spectrum Bar -->
      @if (home.healthStats$ | async; as stats) {
        <section class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div class="flex-1 flex flex-col gap-2">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-primary text-xl">vital_signs</span>
                <h2 class="font-headline-sm text-sm font-bold text-on-surface">Баланс запасов дома (Stock Health)</h2>
                <span class="font-label-code-sm text-xs font-bold text-success bg-success-container/40 px-2 py-0.5 rounded-full">
                  {{ stats.healthPercent }}% в норме
                </span>
              </div>
              <div class="flex items-center gap-3 text-xs font-label-code-sm text-on-surface-variant flex-wrap">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <strong>{{ stats.empty }}</strong> исчерпано
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <strong>{{ stats.low }}</strong> на исходе (&lt;20%)
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <strong>{{ stats.healthy }}</strong> в достатке (&gt;60%)
                </span>
              </div>
            </div>

            <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden flex shadow-inner">
              <div [style.width.%]="(stats.healthy / (stats.total || 1)) * 100" class="bg-emerald-500 transition-all duration-500"></div>
              <div [style.width.%]="(stats.low / (stats.total || 1)) * 100" class="bg-amber-500 transition-all duration-500"></div>
              <div [style.width.%]="(stats.empty / (stats.total || 1)) * 100" class="bg-rose-500 transition-all duration-500"></div>
            </div>
          </div>

          <button
            type="button"
            (click)="home.maxAllInRoom(home.currentRoom)"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-xs font-bold transition-all shadow-xs active:scale-95 flex-shrink-0"
          >
            <span class="material-symbols-rounded text-sm">done_all</span>
            <span>Пополнить всё (Max All)</span>
          </button>
        </section>
      }

      <!-- Room Filter Bar + Section Mode Selector -->
      <section class="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="font-label-ui text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1">Зона:</span>
          @for (room of (home.rooms$ | async) ?? ['ALL']; track room) {
            <button
              type="button"
              (click)="home.setRoomFilter(room)"
              class="px-3 py-1.5 rounded-xl font-label-ui text-xs font-semibold transition-colors"
              [class]="
                (home.selectedRoom$ | async) === room
                  ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
              "
            >
              {{ room === 'ALL' ? 'Все зоны дома' : room }}
            </button>
          }
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="bg-surface-container-low p-1 rounded-xl flex items-center border border-outline-variant/20">
            <button
              type="button"
              (click)="currentSection.set('all')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-all"
              [class]="currentSection() === 'all' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
            >
              Все секции
            </button>
            <button
              type="button"
              (click)="currentSection.set('supplies')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-all"
              [class]="currentSection() === 'supplies' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
            >
              Запасы и счётчики
            </button>
            <button
              type="button"
              (click)="currentSection.set('tasks')"
              class="px-3 py-1 rounded-lg font-label-ui text-xs font-bold transition-all"
              [class]="currentSection() === 'tasks' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
            >
              Дела и Todo
            </button>
          </div>

          <button
            type="button"
            (click)="showWidgetModal.set(true)"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-container text-on-primary-container font-label-ui text-xs font-bold shadow-xs hover:brightness-95 transition-all"
          >
            <span class="material-symbols-rounded text-base">add_circle</span>
            <span class="hidden sm:inline">Новый виджет</span>
          </button>
        </div>
      </section>

      <!-- Main Supply Widgets Grid -->
      @if (currentSection() === 'all' || currentSection() === 'supplies') {
        <section class="flex flex-col gap-space-sm">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-lg text-on-surface-variant">inventory_2</span>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Счётчики и расходники зоны «{{ (home.selectedRoom$ | async) === 'ALL' ? 'Все зоны' : (home.selectedRoom$ | async) }}»
            </h2>
            <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              home.supplies · порционный расход
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            @for (widget of (home.supplyWidgets$ | async) ?? []; track widget.flow.id) {
              <app-home-supply-card [widget]="widget" />
            }
          </div>
        </section>
      }

      <!-- Room Tasks, Routines & Live Chronicle -->
      <app-home-tasks-and-routines [showTasksSection]="currentSection() === 'all' || currentSection() === 'tasks'" />
    </div>

    <app-home-modals
      [showWidgetModal]="showWidgetModal()"
      [showProfileModal]="showProfileModal()"
      (closeWidgetModal)="showWidgetModal.set(false)"
      (closeProfileModal)="showProfileModal.set(false)"
    />
  `,
})
export class HomeTrackerComponent {
  protected readonly home = inject(HomeTrackerService);
  protected readonly profileService = inject(ProfileService);

  readonly currentSection = signal<'all' | 'supplies' | 'tasks'>('all');
  readonly showWidgetModal = signal(false);
  readonly showProfileModal = signal(false);
}
