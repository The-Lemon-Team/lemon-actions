import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HomeWidgetView } from '../../core/models/flow.models';
import { HomeTrackerService } from '../../core/services/home-tracker.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-home-tracker',
  standalone: true,
  imports: [AsyncPipe, FormsModule],
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
                title="Императивное приложение изолировано по ltree-контейнеру home.*"
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

        <!-- Profile Switcher & New Profile Button -->
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
            <span
              class="w-8 h-8 rounded-lg bg-success-container text-on-success-container flex items-center justify-center"
            >
              <span class="material-symbols-rounded text-lg">check_circle</span>
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-display-lg text-3xl font-bold text-on-surface">
              {{ ((home.inStockSupplies$ | async) ?? []).length }}
            </span>
            <span class="font-body-sm text-xs text-success font-medium">
              ресурсов не требуют покупки
            </span>
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
            <span class="font-body-sm text-xs text-on-surface-variant">
              позиций ждут пополнения
            </span>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/20">
          <div class="flex items-center justify-between">
            <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Домашние рутины (Scheduled Mutex)
            </span>
            <span
              class="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center"
            >
              <span class="material-symbols-rounded text-lg">event_repeat</span>
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-display-lg text-3xl font-bold text-on-surface">
              {{ ((home.routineWidgets$ | async) ?? []).length }}
            </span>
            <span class="font-body-sm text-xs text-on-surface-variant">
              активных расписаний в home.routines
            </span>
          </div>
        </div>
      </section>

      <!-- Reactive Shopping List Strip (when items are depleted) -->
      @if (((home.shoppingList$ | async) ?? []); as shoppingItems) {
        @if (shoppingItems.length > 0) {
          <section
            class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border-2 border-warning/40 flex flex-col gap-space-sm"
          >
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-warning text-xl">shopping_bag</span>
                <h2 class="font-headline-sm text-sm font-bold text-on-surface">
                  Реактивный список покупок ({{ shoppingItems.length }})
                </h2>
                <span class="font-body-sm text-xs text-on-surface-variant">
                  — формируется автоматически из потоков с выключенным мьютексом наличия
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              @for (item of shoppingItems; track item.flow.id) {
                <div
                  class="flex items-center justify-between gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div
                      class="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-warning flex-shrink-0"
                    >
                      <span class="material-symbols-rounded text-lg">{{ item.icon }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="font-label-ui text-sm font-bold text-on-surface truncate">
                        {{ item.flow.name }}
                      </div>
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

      <!-- Room Filter Bar + Add Widget Action -->
      <section class="flex flex-wrap items-center justify-between gap-space-sm">
        <div class="flex flex-wrap items-center gap-1.5">
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

        <button
          type="button"
          (click)="showWidgetModal.set(true)"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-label-ui text-xs font-bold shadow-xs hover:brightness-95 transition-all"
        >
          <span class="material-symbols-rounded text-base">add_circle</span>
          <span>Создать виджет ресурса / рутины</span>
        </button>
      </section>

      <!-- Main Supply Widgets Grid (home.supplies) -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-lg text-on-surface-variant">inventory_2</span>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Виджеты запасов дома
            </h2>
            <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              home.supplies
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          @for (widget of (home.supplyWidgets$ | async) ?? []; track widget.flow.id) {
            <div
              class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all flex flex-col justify-between gap-space-md"
              [class]="
                widget.isInStock
                  ? 'border-outline-variant/25'
                  : 'border-warning/50 bg-warning/5'
              "
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div
                    class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    [class]="
                      widget.isInStock
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-warning/20 text-warning'
                    "
                  >
                    <span class="material-symbols-rounded text-xl">{{ widget.icon }}</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-headline-sm text-base font-bold text-on-surface">
                        {{ widget.flow.name }}
                      </h3>
                      <span
                        class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                        [class]="
                          widget.isInStock
                            ? 'bg-success-container text-on-success-container'
                            : 'bg-warning text-on-warning'
                        "
                      >
                        {{ widget.isInStock ? 'В наличии (Mutex ON)' : 'Закончилось (Mutex OFF)' }}
                      </span>
                    </div>
                    <p class="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {{ widget.flow.description }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  (click)="home.deleteWidget(widget.flow.id)"
                  title="Удалить виджет"
                  class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                >
                  <span class="material-symbols-rounded text-base">delete</span>
                </button>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20 gap-2 flex-wrap">
                <div class="flex items-center gap-3 font-label-code-sm text-xs text-on-surface-variant">
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-rounded text-sm">room</span>
                    {{ widget.room }}
                  </span>
                  <span>·</span>
                  <span>{{ widget.unitHint }}</span>
                  <span>·</span>
                  <span>Цикл ~{{ widget.expectedDays }} дн.</span>
                </div>

                @if (widget.isInStock) {
                  <button
                    type="button"
                    (click)="home.markDepleted(widget.flow.id)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-warning hover:text-on-warning font-label-ui text-xs font-bold transition-colors"
                  >
                    <span class="material-symbols-rounded text-sm">production_quantity_limits</span>
                    <span>Закончилось (В покупки)</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="home.markRestocked(widget.flow.id)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 font-label-ui text-xs font-bold transition-opacity shadow-xs"
                  >
                    <span class="material-symbols-rounded text-sm">check_circle</span>
                    <span>Купили (Включить мьютекс)</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Scheduled Household Routines & Live Activity Chronicle -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <!-- Routines (home.routines) -->
        <div class="lg:col-span-6 flex flex-col gap-space-sm">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-lg text-on-surface-variant">schedule</span>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Расписания и рутины дома
            </h2>
            <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              home.routines
            </span>
          </div>

          <div class="flex flex-col gap-3">
            @for (routine of (home.routineWidgets$ | async) ?? []; track routine.flow.id) {
              <div
                class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <div
                      class="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0"
                    >
                      <span class="material-symbols-rounded text-lg">{{ routine.icon }}</span>
                    </div>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-headline-sm text-sm font-bold text-on-surface">
                          {{ routine.flow.name }}
                        </h3>
                        <span
                          class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold"
                        >
                          Scheduled Mutex · {{ routine.scheduleLabel }}
                        </span>
                      </div>
                      <p class="font-body-sm text-xs text-on-surface-variant mt-1">
                        {{ routine.flow.description }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                  <span class="font-label-code-sm text-xs text-on-surface-variant">
                    Зона: {{ routine.room }} · Статус окна: {{ routine.flow.status }}
                  </span>
                  <button
                    type="button"
                    (click)="home.completeRoutine(routine.flow.id, 'Выполнено пользователем в окне расписания')"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-success-container hover:text-on-success-container text-on-surface font-label-ui text-xs font-bold transition-colors"
                  >
                    <span class="material-symbols-rounded text-sm">task_alt</span>
                    <span>Отметить выполнение</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Live Chronicle of Home Events (flow_events) -->
        <div class="lg:col-span-6 flex flex-col gap-space-sm">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-lg text-on-surface-variant">history</span>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Хроника событий дома
            </h2>
            <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              flow_events
            </span>
          </div>

          <div
            class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto"
          >
            @for (act of (home.activities$ | async) ?? []; track act.id) {
              <div
                class="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/15"
              >
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  [class]="
                    act.eventType === 'DEPLETED'
                      ? 'bg-warning/20 text-warning'
                      : act.eventType === 'RESTOCKED'
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-primary-container text-on-primary-container'
                  "
                >
                  <span class="material-symbols-rounded text-base">{{ act.icon }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-label-ui text-xs font-bold text-on-surface truncate">
                      {{ act.flowName }}
                    </span>
                    <span class="font-label-code-sm text-[10px] text-outline flex-shrink-0">
                      {{ act.eventType }}
                    </span>
                  </div>
                  <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                    {{ act.note }}
                  </p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>
    </div>

    <!-- Modal: Create New Home Widget -->
    @if (showWidgetModal()) {
      <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        (click)="showWidgetModal.set(false)"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-lg font-bold text-on-surface">
              Новый виджет дома (Поток в home.*)
            </h3>
            <button
              type="button"
              (click)="showWidgetModal.set(false)"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              (click)="newWidgetKind = 'supply'"
              class="p-3 rounded-xl border text-left transition-all"
              [class]="
                newWidgetKind === 'supply'
                  ? 'border-primary bg-primary-container/30 text-on-surface font-bold'
                  : 'border-outline-variant/30 text-on-surface-variant'
              "
            >
              <div class="font-label-ui text-xs font-bold">Запас ресурса (Mutex)</div>
              <div class="font-body-sm text-[11px] opacity-80 mt-0.5">Контейнер home.supplies</div>
            </button>
            <button
              type="button"
              (click)="newWidgetKind = 'routine'"
              class="p-3 rounded-xl border text-left transition-all"
              [class]="
                newWidgetKind === 'routine'
                  ? 'border-primary bg-primary-container/30 text-on-surface font-bold'
                  : 'border-outline-variant/30 text-on-surface-variant'
              "
            >
              <div class="font-label-ui text-xs font-bold">Рутина (Scheduled Mutex)</div>
              <div class="font-body-sm text-[11px] opacity-80 mt-0.5">Контейнер home.routines</div>
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название ресурса или дела</span>
              <input
                type="text"
                [(ngModel)]="newWidgetName"
                placeholder="Напр.: Фильтры для воды / Проветривание"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Комната / Зона</span>
                <input
                  type="text"
                  [(ngModel)]="newWidgetRoom"
                  placeholder="Кухня / Ванная / Спальня"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Иконка (Material)</span>
                <select
                  [(ngModel)]="newWidgetIcon"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                >
                  <option value="inventory_2">Коробка (inventory_2)</option>
                  <option value="local_laundry_service">Стирка (local_laundry_service)</option>
                  <option value="bakery_dining">Хлеб / Еда (bakery_dining)</option>
                  <option value="coffee">Чай / Кофе (coffee)</option>
                  <option value="water_drop">Вода (water_drop)</option>
                  <option value="cleaning_services">Уборка (cleaning_services)</option>
                  <option value="yard">Растения / Сад (yard)</option>
                  <option value="pets">Питомцы (pets)</option>
                </select>
              </label>
            </div>

            @if (newWidgetKind === 'supply') {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Единица / Упаковка</span>
                  <input
                    type="text"
                    [(ngModel)]="newWidgetUnit"
                    placeholder="Напр.: 1 пачка / 2 л"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">На сколько дней хватает</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetDays"
                    min="1"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Начало окна (HH:MM)</span>
                  <input
                    type="text"
                    [(ngModel)]="newScheduleStart"
                    placeholder="09:00"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Конец окна (HH:MM)</span>
                  <input
                    type="text"
                    [(ngModel)]="newScheduleEnd"
                    placeholder="11:00"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="showWidgetModal.set(false)"
              class="px-4 py-2 rounded-xl font-label-ui text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewWidget()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Создать поток в профиле
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Register New User Profile -->
    @if (showProfileModal()) {
      <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        (click)="showProfileModal.set(false)"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-lg font-bold text-on-surface">
              Регистрация профиля в Lemon Home
            </h3>
            <button
              type="button"
              (click)="showProfileModal.set(false)"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <p class="font-body-sm text-xs text-on-surface-variant">
            Для нового пользователя в Core Combinator автоматически создается изолированное дерево
            <code class="font-label-code-sm">home</code>, <code class="font-label-code-sm">home.supplies</code>,
            <code class="font-label-code-sm">home.routines</code> и стартовые бытовые потоки.
          </p>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название профиля / дома</span>
              <input
                type="text"
                [(ngModel)]="newProfileName"
                placeholder="Напр.: Квартира родителей"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Уникальный handle (латиницей)</span>
              <input
                type="text"
                [(ngModel)]="newProfileHandle"
                placeholder="parents_home"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="showProfileModal.set(false)"
              class="px-4 py-2 rounded-xl font-label-ui text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewProfile()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Зарегистрировать профиль
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class HomeTrackerComponent {
  protected readonly home = inject(HomeTrackerService);
  protected readonly profileService = inject(ProfileService);

  readonly showWidgetModal = signal(false);
  readonly showProfileModal = signal(false);

  newWidgetKind: 'supply' | 'routine' = 'supply';
  newWidgetName = '';
  newWidgetRoom = 'Кухня';
  newWidgetIcon = 'inventory_2';
  newWidgetUnit = '1 уп.';
  newWidgetDays = 14;
  newScheduleStart = '10:00';
  newScheduleEnd = '12:00';

  newProfileName = '';
  newProfileHandle = '';

  submitNewWidget(): void {
    if (!this.newWidgetName.trim()) return;
    this.home.createHomeWidget({
      name: this.newWidgetName,
      kind: this.newWidgetKind,
      room: this.newWidgetRoom,
      icon: this.newWidgetIcon,
      unitHint: this.newWidgetUnit,
      expectedDays: this.newWidgetDays,
      scheduleStart: this.newScheduleStart,
      scheduleEnd: this.newScheduleEnd,
    });
    this.newWidgetName = '';
    this.showWidgetModal.set(false);
  }

  submitNewProfile(): void {
    if (!this.newProfileName.trim() || !this.newProfileHandle.trim()) return;
    this.profileService
      .registerProfile({
        displayName: this.newProfileName,
        handle: this.newProfileHandle,
        avatarIcon: 'apartment',
      })
      .subscribe(() => {
        this.newProfileName = '';
        this.newProfileHandle = '';
        this.showProfileModal.set(false);
      });
  }
}
