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

      <!-- Stock Health Spectrum Bar (Inspired by Stitch prototype) -->
      @if (home.healthStats$ | async; as stats) {
        <section
          class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col md:flex-row md:items-center justify-between gap-space-md"
        >
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

            <!-- Segmented Health Progress Ribbon -->
            <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden flex shadow-inner">
              <div [style.width.%]="(stats.healthy / (stats.total || 1)) * 100" class="bg-emerald-500 transition-all duration-500" title="В достатке"></div>
              <div [style.width.%]="(stats.low / (stats.total || 1)) * 100" class="bg-amber-500 transition-all duration-500" title="На исходе"></div>
              <div [style.width.%]="(stats.empty / (stats.total || 1)) * 100" class="bg-rose-500 transition-all duration-500" title="Закончилось"></div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              (click)="maxAll()"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-ui text-xs font-bold transition-all shadow-xs active:scale-95"
              title="Пополнить все запасы выбранной зоны до 100% (Max All)"
            >
              <span class="material-symbols-rounded text-sm">done_all</span>
              <span>Пополнить всё (Max All)</span>
            </button>
          </div>
        </section>
      }

      <!-- Room Filter Bar + Section Mode Selector (Зонирование комнат) -->
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
          <!-- Section filter toggle: All / Supplies / Tasks -->
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

      <!-- Main Supply Widgets Grid (home.supplies with Steppers & Color Ribbon) -->
      @if (currentSection() === 'all' || currentSection() === 'supplies') {
        <section class="flex flex-col gap-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-lg text-on-surface-variant">inventory_2</span>
              <h2 class="font-headline-sm text-base font-bold text-on-surface">
                Счётчики и расходники зоны «{{ (home.selectedRoom$ | async) === 'ALL' ? 'Все зоны' : (home.selectedRoom$ | async) }}»
              </h2>
              <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                home.supplies · порционный расход
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            @for (widget of (home.supplyWidgets$ | async) ?? []; track widget.flow.id) {
              <div
                class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all flex flex-col justify-between gap-space-md"
                [class]="
                  widget.isInStock && widget.percentage >= 20
                    ? 'border-outline-variant/25'
                    : widget.isInStock && widget.percentage < 20
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-warning/50 bg-warning/5'
                "
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 min-w-0">
                    <div
                      class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      [class]="
                        widget.percentage === 0
                          ? 'bg-warning/20 text-warning'
                          : widget.percentage < 20
                            ? 'bg-rose-100 text-rose-600'
                            : widget.percentage <= 60
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-success-container text-on-success-container'
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
                            widget.percentage === 0
                              ? 'bg-warning text-on-warning'
                              : widget.percentage < 20
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : widget.percentage <= 60
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-success-container text-on-success-container'
                          "
                        >
                          {{
                            widget.percentage === 0
                              ? 'Закончилось (Mutex OFF)'
                              : widget.percentage < 20
                                ? 'Критически мало (Mutex ON)'
                                : widget.percentage <= 60
                                  ? 'Средний запас (Mutex ON)'
                                  : 'В достатке (Mutex ON)'
                          }}
                        </span>
                      </div>

                      @if (widget.brand) {
                        <div class="font-label-ui text-xs text-primary font-bold mt-0.5 flex items-center gap-1">
                          <span class="material-symbols-rounded text-xs">verified</span>
                          <span>{{ widget.brand }}</span>
                        </div>
                      }

                      <p class="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-1">
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

                <!-- Stitch-inspired Color Progress Ribbon -->
                <div class="flex flex-col gap-1.5 pt-1">
                  <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden relative">
                    <div
                      [style.width.%]="widget.percentage"
                      class="h-full rounded-full transition-all duration-300"
                      [class]="
                        widget.percentage === 0
                          ? 'bg-transparent'
                          : widget.percentage < 20
                            ? 'bg-rose-500 animate-pulse'
                            : widget.percentage <= 60
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                      "
                    ></div>
                  </div>

                  <div class="flex items-center justify-between text-[11px] font-label-code-sm text-on-surface-variant">
                    @if (widget.percentage === 0) {
                      <span class="text-rose-600 font-bold flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Исчерпано • В списке покупок!
                      </span>
                    } @else {
                      <span>
                        Запас: <strong [class]="widget.percentage < 20 ? 'text-rose-600' : widget.percentage <= 60 ? 'text-amber-600' : 'text-emerald-600'">{{ widget.percentage }}%</strong>
                        (хватит ~{{ MathRound(widget.currentQty * widget.daysPerUnit) }} дн.)
                      </span>
                    }
                    <span>Макс: {{ widget.maxQty }} {{ widget.unit }}</span>
                  </div>
                </div>

                <!-- Interactive Stepper & Counter Action Controls -->
                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20 gap-2 flex-wrap">
                  <!-- Stepper (- step / current / + step) -->
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      (click)="home.consumePortion(widget.flow.id)"
                      [disabled]="widget.currentQty === 0"
                      title="Списать порцию расхода (-{{ widget.step }} {{ widget.unit }})"
                      class="h-8 px-2.5 rounded-xl flex items-center justify-center font-bold text-xs transition-all border"
                      [class]="
                        widget.currentQty === 0
                          ? 'opacity-40 cursor-not-allowed bg-surface-container border-outline-variant/20 text-on-surface-variant'
                          : 'bg-surface-container-lowest border-outline-variant/30 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-xs active:scale-90'
                      "
                    >
                      -{{ widget.step }} {{ widget.unit }}
                    </button>

                    <div class="min-w-[65px] px-2 py-1 text-center font-label-code-sm text-xs font-bold rounded-lg bg-surface-container text-on-surface shadow-inner">
                      {{ widget.currentQty }} {{ widget.unit }}
                    </div>

                    <button
                      type="button"
                      (click)="home.addPortion(widget.flow.id)"
                      title="Добавить порцию (+{{ widget.step }} {{ widget.unit }})"
                      class="h-8 px-2.5 rounded-xl flex items-center justify-center font-bold text-xs bg-surface-container-lowest border border-outline-variant/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 shadow-xs active:scale-90 transition-all"
                    >
                      +{{ widget.step }} {{ widget.unit }}
                    </button>

                    <button
                      type="button"
                      (click)="home.addPortion(widget.flow.id, widget.maxQty)"
                      title="Независимое пополнение целой пачки (+{{ widget.maxQty }} {{ widget.unit }})"
                      class="h-8 px-2 rounded-xl text-[11px] font-label-ui font-bold bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      + Пачка
                    </button>
                  </div>

                  <!-- Discrete Mutex Actions -->
                  <div class="flex items-center gap-1.5">
                    @if (widget.isInStock) {
                      <button
                        type="button"
                        (click)="home.markDepleted(widget.flow.id)"
                        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-warning hover:text-on-warning font-label-ui text-xs font-bold transition-colors"
                        title="Сбросить остаток в 0 и выключить Mutex"
                      >
                        <span class="material-symbols-rounded text-sm">production_quantity_limits</span>
                        <span>В покупки</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="home.markRestocked(widget.flow.id)"
                        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 font-label-ui text-xs font-bold transition-opacity shadow-xs"
                      >
                        <span class="material-symbols-rounded text-sm">check_circle</span>
                        <span>Купили (Включить мьютекс)</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Room Tasks & Routines Partition (Дела и Todo комнаты vs Регулярные рутины) -->
      @if (currentSection() === 'all' || currentSection() === 'tasks') {
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <!-- Left Column: Room Tasks & Todo List -->
          <div class="lg:col-span-6 flex flex-col gap-space-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-lg text-primary">checklist</span>
                <h2 class="font-headline-sm text-base font-bold text-on-surface">
                  Дела и Todo: {{ (home.selectedRoom$ | async) === 'ALL' ? 'Все зоны дома' : (home.selectedRoom$ | async) }}
                </h2>
              </div>
              <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Чек-лист обслуживания
              </span>
            </div>

            <!-- Quick Add Task Input -->
            <div class="bg-surface-container-lowest rounded-2xl p-2.5 shadow-xs border border-outline-variant/25 flex items-center gap-2">
              <input
                type="text"
                [(ngModel)]="newTaskTitle"
                (keyup.enter)="addNewTask()"
                placeholder="Добавить дело в эту комнату (нажмите Enter)..."
                class="flex-1 px-3 py-1.5 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-outline border border-transparent focus:border-primary focus:bg-surface-container-lowest focus:outline-none"
              />
              <button
                type="button"
                (click)="addNewTask()"
                class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-90 flex-shrink-0"
              >
                + Добавить
              </button>
            </div>

            <!-- Tasks List -->
            <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-2">
              @for (task of (home.tasksForSelectedRoom$ | async) ?? []; track task.id) {
                <div
                  class="flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all"
                  [class]="task.done ? 'bg-surface-container-low/40 opacity-60' : 'bg-surface-container-low hover:bg-surface-container'"
                >
                  <label class="flex items-center gap-2.5 min-w-0 cursor-pointer select-none flex-1">
                    <input
                      type="checkbox"
                      [checked]="task.done"
                      (change)="home.toggleRoomTask(task.id)"
                      class="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span class="font-body-sm text-xs text-on-surface truncate" [class.line-through]="task.done">
                      {{ task.title }}
                    </span>
                  </label>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full"
                      [class]="
                        task.priority === 'high'
                          ? 'bg-rose-100 text-rose-700 font-bold'
                          : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-surface-container text-on-surface-variant'
                      "
                    >
                      {{ task.room }}
                    </span>
                    <button
                      type="button"
                      (click)="home.deleteRoomTask(task.id)"
                      class="p-1 rounded text-outline hover:text-rose-600 transition-colors"
                      title="Удалить задачу"
                    >
                      <span class="material-symbols-rounded text-sm">close</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-6 font-body-sm text-xs text-on-surface-variant">
                  В этой зоне пока нет запланированных дел. Добавьте задачу выше!
                </div>
              }
            </div>
          </div>

          <!-- Right Column: Scheduled Household Routines (home.routines) -->
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
      </section>
    }

    <!-- Live Chronicle of Home Events (flow_events) -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-rounded text-lg text-on-surface-variant">history</span>
          <h2 class="font-headline-sm text-base font-bold text-on-surface">
            Хроника событий дома
          </h2>
          <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
            flow_events · порции, покупки и рутины
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
                  <option value="inventory_2">Коробка / Запас (inventory_2)</option>
                  <option value="soap">Мыло (soap)</option>
                  <option value="clean_hands">Влажные салфетки (clean_hands)</option>
                  <option value="wash">Мытье посуды (wash)</option>
                  <option value="layers">Губки поролоновые (layers)</option>
                  <option value="dry">Тряпки / салфетки (dry)</option>
                  <option value="sanitizer">Средство для плиты / Санокс (sanitizer)</option>
                  <option value="brush">Металлические губки / щетки (brush)</option>
                  <option value="local_laundry_service">Стирка / Порошок (local_laundry_service)</option>
                  <option value="cleaning_services">Уборка / Клининг (cleaning_services)</option>
                  <option value="emoji_food_beverage">Чай в пакетиках (emoji_food_beverage)</option>
                  <option value="spa">Чай листовой / Травы (spa)</option>
                  <option value="bakery_dining">Хлеб / Выпечка (bakery_dining)</option>
                  <option value="soup_kitchen">Кетчуп / Соус (soup_kitchen)</option>
                  <option value="dinner_dining">Утка / Мясо / Птица (dinner_dining)</option>
                  <option value="lunch_dining">Сало / Закуски (lunch_dining)</option>
                  <option value="nutrition">Лимон / Цитрусовые (nutrition)</option>
                  <option value="local_drink">Молоко / Напитки (local_drink)</option>
                  <option value="grain">Мука / Зерно (grain)</option>
                  <option value="scatter_plot">Сахар / Сыпучие (scatter_plot)</option>
                  <option value="rice_bowl">Гречка / Рис / Крупы (rice_bowl)</option>
                  <option value="water_drop">Вода (water_drop)</option>
                  <option value="yard">Растения / Сад (yard)</option>
                  <option value="pets">Питомцы (pets)</option>
                </select>
              </label>
            </div>

            @if (newWidgetKind === 'supply') {
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Ед. изм. (кратко)</span>
                  <input
                    type="text"
                    [(ngModel)]="newWidgetUnitShort"
                    placeholder="шт / пак / кг / л / г"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1 sm:col-span-2">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Фасовка / Описание</span>
                  <input
                    type="text"
                    [(ngModel)]="newWidgetUnit"
                    placeholder="Напр.: 100 пакетиков / Пакет 2 кг"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Остаток</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetCurrentQty"
                    min="0"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Макс. ёмкость</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetMaxQty"
                    min="0.1"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Шаг порции</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetStep"
                    min="0.01"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Срок расхода (дней)</span>
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

  readonly currentSection = signal<'all' | 'supplies' | 'tasks'>('all');
  newTaskTitle = '';
  newTaskPriority: 'low' | 'medium' | 'high' = 'medium';

  readonly showWidgetModal = signal(false);
  readonly showProfileModal = signal(false);

  newWidgetKind: 'supply' | 'routine' = 'supply';
  newWidgetName = '';
  newWidgetRoom = 'Кухня';
  newWidgetIcon = 'inventory_2';
  newWidgetUnit = '1 уп.';
  newWidgetUnitShort = 'шт';
  newWidgetCurrentQty = 1;
  newWidgetMaxQty = 1;
  newWidgetStep = 1;
  newWidgetDays = 14;
  newScheduleStart = '10:00';
  newScheduleEnd = '12:00';

  newProfileName = '';
  newProfileHandle = '';

  maxAll(): void {
    this.home.maxAllInRoom(this.home.currentRoom);
  }

  addNewTask(): void {
    if (!this.newTaskTitle.trim()) return;
    const room = this.home.currentRoom === 'ALL' ? 'Кухня' : this.home.currentRoom;
    this.home.addRoomTask(room, this.newTaskTitle, this.newTaskPriority);
    this.newTaskTitle = '';
  }

  MathRound(val: number): number {
    return Math.round(val);
  }

  submitNewWidget(): void {
    if (!this.newWidgetName.trim()) return;
    this.home.createHomeWidget({
      name: this.newWidgetName,
      kind: this.newWidgetKind,
      room: this.newWidgetRoom,
      icon: this.newWidgetIcon,
      unitHint: this.newWidgetUnit,
      unit: this.newWidgetUnitShort,
      currentQty: this.newWidgetCurrentQty,
      maxQty: this.newWidgetMaxQty,
      step: this.newWidgetStep,
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
