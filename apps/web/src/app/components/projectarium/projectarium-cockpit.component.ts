import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { ProjectStandService } from '../../core/services/project-stand.service';
import { LemonCardColor, getLemonColorDotClass } from '../../core/models/worker.models';
import { ProjectStand } from '../../core/models/project-stand.models';
import { AppEnvironment, AppNetworkMode } from '../../core/models/health-checker.models';
import { ProjectStandCardComponent } from '../lemon-workers/project-stand-card.component';
import { CreateStandModalComponent } from '../lemon-workers/create-stand-modal.component';
import { AddAppModalComponent } from '../lemon-workers/add-app-modal.component';
import { ProjectariumAnalyticsComponent } from './projectarium-analytics.component';

@Component({
  selector: 'app-projectarium-cockpit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProjectStandCardComponent,
    CreateStandModalComponent,
    AddAppModalComponent,
    ProjectariumAnalyticsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-16 pt-4 px-4">

      <!-- COCKPIT HEADER -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0">
              <span class="material-symbols-rounded text-lg">domain</span>
            </div>
            <h1 class="font-headline-sm text-2xl font-bold text-on-surface tracking-tight">
              Lemon-Projectarium
            </h1>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/15 text-primary uppercase">
              Cockpit Live
            </span>
          </div>
          <p class="font-body-sm text-xs text-on-surface-variant mt-1">
            Единый пульт инфраструктурных стендов: Port Shield порты (4320+), мультисервисы, реактивные чек-листы и хроника
          </p>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <button
              type="button"
              data-testid="cockpit-tab-stands"
              (click)="switchCockpitView('STANDS')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              [class]="getCockpitViewBtnClass(activeCockpitView === 'STANDS')"
            >
              <span class="material-symbols-rounded text-sm">domain</span>
              <span>Стенды</span>
            </button>
            <button
              type="button"
              data-testid="cockpit-tab-analytics"
              (click)="switchCockpitView('ANALYTICS')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              [class]="getCockpitViewBtnClass(activeCockpitView === 'ANALYTICS')"
            >
              <span class="material-symbols-rounded text-sm">monitoring</span>
              <span>Статистика машин</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="toggle-machine-picker"
            (click)="toggleMachinePicker()"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold shadow-2xs transition-all cursor-pointer"
            [class]="getMachinePickerBtnClass()"
            title="Привязать этот браузер к конкретному ПК, чтобы видеть свои localhost-адреса"
          >
            <span class="material-symbols-rounded text-sm">computer</span>
            <span>{{ getActiveMachineLabel() }}</span>
          </button>

          <button
            type="button"
            (click)="showSmartTouch = !showSmartTouch"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface font-headline-sm text-xs font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Быстрый вызов единого обработчика Smart Touch"
          >
            <span class="material-symbols-rounded text-sm text-primary">touch_app</span>
            <span>Smart Upsert</span>
          </button>

          <button
            type="button"
            (click)="showCreateStandModal = true"
            class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">domain_add</span>
            <span>Зарегистрировать стенд</span>
          </button>
        </div>
      </header>

      <!-- WORKSTATION LOCALHOST BINDING DRAWER -->
      @if (showMachinePicker) {
        <section
          data-testid="machine-picker-panel"
          class="p-4 rounded-3xl bg-surface-container-low border border-sky-500/30 shadow-xs flex flex-col gap-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-base text-sky-600 dark:text-sky-400">computer</span>
              <span class="font-bold text-xs text-on-surface">
                Привязка локальной машины (для личных localhost-адресов)
              </span>
            </div>
            <button
              type="button"
              (click)="showMachinePicker = false"
              class="w-6 h-6 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span class="material-symbols-rounded text-sm">close</span>
            </button>
          </div>

          <p class="text-[11px] text-on-surface-variant">
            По умолчанию Projectarium показывает только общедоступные (production / LAN / Funnel) URL. Выберите ваш компьютер, чтобы видеть и свои локальные dev-сервисы на localhost без показа чужих машин.
          </p>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              (click)="selectMachine('', '')"
              class="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
              [class]="getMachineOptionClass(!(standService.selectedMachineId$ | async))"
            >
              Только публичные (без localhost)
            </button>
            <button
              type="button"
              (click)="selectMachine('pc-1', 'PC-1')"
              class="px-3 py-1.5 rounded-xl border text-xs font-mono font-bold cursor-pointer"
              [class]="getMachineOptionClass((standService.selectedMachineId$ | async) === 'pc-1')"
            >
              PC-1
            </button>
            <button
              type="button"
              (click)="selectMachine('pc-2', 'PC-2')"
              class="px-3 py-1.5 rounded-xl border text-xs font-mono font-bold cursor-pointer"
              [class]="getMachineOptionClass((standService.selectedMachineId$ | async) === 'pc-2')"
            >
              PC-2
            </button>
            <button
              type="button"
              (click)="selectMachine('local-default', 'Local Machine')"
              class="px-3 py-1.5 rounded-xl border text-xs font-mono font-bold cursor-pointer"
              [class]="getMachineOptionClass((standService.selectedMachineId$ | async) === 'local-default')"
            >
              Local Machine
            </button>
            @for (m of (standService.machines$ | async) || []; track m.machineId) {
              @if (m.machineId !== 'pc-1' && m.machineId !== 'pc-2' && m.machineId !== 'local-default' && !m.machineId.startsWith('host-')) {
                <button
                  type="button"
                  (click)="selectMachine(m.machineId, m.machineName)"
                  class="px-3 py-1.5 rounded-xl border text-xs font-mono font-bold cursor-pointer"
                  [class]="getMachineOptionClass((standService.selectedMachineId$ | async) === m.machineId)"
                >
                  {{ m.machineName }} ({{ m.activeLocalCount }})
                </button>
              }
            }
          </div>

          <div class="flex items-center gap-2 max-w-md">
            <input
              type="text"
              [(ngModel)]="customMachineInput"
              placeholder="Своё имя ПК (например: Laptop-Home)..."
              class="flex-1 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              (click)="applyCustomMachine()"
              [disabled]="!customMachineInput.trim()"
              class="px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              Привязать ПК
            </button>
          </div>
        </section>
      }

      <!-- SMART TOUCH QUICK DRAWER / FORM -->
      @if (showSmartTouch) {
        <section class="p-5 rounded-3xl bg-surface-container-low border border-primary/20 shadow-xs flex flex-col gap-3.5 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-base text-primary">dynamic_feed</span>
              <span class="font-bold text-xs text-on-surface">Smart Touch Handler («Upsert on First Touch»)</span>
              <span class="text-[10px] font-mono text-on-surface-variant">POST /api/projectarium/register</span>
            </div>
            <button
              type="button"
              (click)="showSmartTouch = false"
              class="w-6 h-6 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span class="material-symbols-rounded text-sm">close</span>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs">
            <input
              type="text"
              [(ngModel)]="smartProjectName"
              placeholder="Имя проекта (Lemon Seasons)..."
              class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              [(ngModel)]="smartAppName"
              placeholder="Имя сервиса (Gateway, CMS)..."
              class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              [(ngModel)]="smartHost"
              placeholder="Хост (localhost, 192.168.1.100)"
              class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              [(ngModel)]="smartPort"
              placeholder="Порт (авто)"
              class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              [(ngModel)]="smartEnvironment"
              class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="dev">DEV</option>
              <option value="staging">STAGING</option>
              <option value="production">PROD</option>
            </select>
            <button
              type="button"
              (click)="executeSmartTouch()"
              [disabled]="!smartProjectName.trim() || !smartAppName.trim() || isSubmitting"
              class="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold text-xs shadow-2xs hover:bg-primary-fixed-dim disabled:opacity-40 cursor-pointer"
            >
              {{ isSubmitting ? 'Регистрация...' : 'Запустить Touch' }}
            </button>
          </div>
          @if (smartFeedback) {
            <div class="text-[11px] font-mono p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 text-on-surface">
              {{ smartFeedback }}
            </div>
          }
        </section>
      }

      @if (activeCockpitView === 'ANALYTICS') {
        <app-projectarium-analytics
          [analytics]="standService.analytics$ | async"
          [selectedDays]="analyticsDays"
          (daysChange)="onAnalyticsDaysChange($event)"
          (refresh)="standService.fetchAnalytics(analyticsDays)"
        />
      } @else {
      <!-- TOP PORT SHIELD HUD BAR -->
      @if (standsVm$ | async; as vm) {
        <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0">
              <span class="material-symbols-rounded text-xl">shield</span>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-headline-sm font-bold text-sm text-on-surface">Port Shield Cluster Protection</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                  Zero-Deadlock Active
                </span>
              </div>
              <span class="text-xs text-on-surface-variant">
                Корневые якоря: PostgreSQL (:5433), API (:3000), Web (:4201). Динамический пул стендов: порты 4320+.
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs font-mono">
            <div class="flex flex-col items-center">
              <span class="text-on-surface-variant text-[10px]">Стенды</span>
              <span class="font-bold text-sm text-on-surface">{{ vm.totalCount }}</span>
            </div>
            <div class="w-px h-6 bg-outline-variant/40"></div>
            <div class="flex flex-col items-center">
              <span class="text-on-surface-variant text-[10px]">Защищённых портов</span>
              <span class="font-bold text-sm text-primary">{{ getTotalAppsCount(vm) }}</span>
            </div>
            <div class="w-px h-6 bg-outline-variant/40"></div>
            <div class="flex flex-col items-center">
              <span class="text-on-surface-variant text-[10px]">Circuit Breaker</span>
              <span class="font-bold text-sm text-emerald-600 dark:text-emerald-400">5/5 Fail Auto-Evict</span>
            </div>
          </div>
        </div>

        <!-- SEARCH & NEURON FILTERS BAR -->
        <section class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25">
          <!-- Search Input -->
          <div class="relative flex-1 max-w-md">
            <span class="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
            <input
              type="text"
              [ngModel]="searchTerm$ | async"
              (ngModelChange)="searchTerm$.next($event)"
              placeholder="Поиск стендов, приложений, тегов (#CALENDAR, #PORT_SHIELD)..."
              class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <!-- Neuron Workspace & Color Filters -->
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-on-surface-variant font-medium">Нейрон:</span>
              <select
                [ngModel]="selectedFolder$ | async"
                (ngModelChange)="selectedFolder$.next($event)"
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="ALL">Все Нейроны</option>
                @for (neuron of vm.availableNeurons; track neuron) {
                  <option [value]="neuron">{{ neuron }}</option>
                }
              </select>
            </div>

            <!-- Color Palette Filter -->
            <div class="flex items-center gap-1 pl-2 border-l border-outline-variant/30">
              <button
                type="button"
                (click)="selectedColor$.next('ALL')"
                class="w-5 h-5 rounded-full border border-black/15 flex items-center justify-center text-[10px] cursor-pointer"
                [class.ring-2]="(selectedColor$ | async) === 'ALL'"
                [class.ring-primary]="(selectedColor$ | async) === 'ALL'"
                title="Все цвета"
              >
                *
              </button>
              @for (color of filterColors; track color) {
                <button
                  type="button"
                  (click)="selectedColor$.next(color)"
                  class="w-4 h-4 rounded-full border border-black/15 transition-transform hover:scale-125 cursor-pointer"
                  [class.ring-2]="(selectedColor$ | async) === color"
                  [class.ring-primary]="(selectedColor$ | async) === color"
                  [ngClass]="getColorDotBg(color)"
                  [title]="color"
                ></button>
              }
            </div>
          </div>
        </section>

        <!-- PROJECT TABS SWITCHER -->
        @if (vm.ordered.length > 0) {
          <nav
            role="tablist"
            aria-label="Переключение между проектами"
            class="flex items-center gap-2 flex-wrap p-2 rounded-2xl bg-surface-container-low border border-outline-variant/25"
          >
            @for (stand of vm.ordered; track stand.id) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="vm.activeTab === stand.slug"
                (click)="selectProjectTab(stand.slug)"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                [class]="getProjectTabClass(vm.activeTab === stand.slug)"
              >
                <span
                  class="w-2.5 h-2.5 rounded-full border border-black/15 flex-shrink-0"
                  [ngClass]="getColorDotBg(stand.color)"
                ></span>
                @if (stand.isPinned) {
                  <span class="material-symbols-rounded text-xs text-primary">push_pin</span>
                }
                <span class="truncate max-w-[180px]">{{ stand.name }}</span>
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/10 dark:bg-white/10">
                  {{ stand.apps.length }}
                </span>
                @if (hasStandIssue(stand)) {
                  <span
                    class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                    title="Есть сервисы со сбоем (DEGRADED / EVICTED)"
                  ></span>
                }
              </button>
            }

            <button
              type="button"
              role="tab"
              [attr.aria-selected]="vm.activeTab === 'ALL'"
              (click)="selectProjectTab('ALL')"
              class="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="getProjectTabClass(vm.activeTab === 'ALL')"
              title="Показать все стенды одновременно"
            >
              <span class="material-symbols-rounded text-sm">grid_view</span>
              <span>Все ({{ vm.ordered.length }})</span>
            </button>
          </nav>

          <!-- ACTIVE PROJECT TAB PANEL OR ALL-STANDS GRID -->
          <section
            role="tabpanel"
            [class]="vm.activeTab === 'ALL' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'w-full'"
          >
            @for (stand of vm.displayedStands; track stand.id) {
              <app-project-stand-card
                [stand]="stand"
                [expanded]="vm.activeTab !== 'ALL'"
                [selectedMachineId]="(standService.selectedMachineId$ | async) || ''"
                [selectedMachineName]="(standService.selectedMachineName$ | async) || ''"
                (pinToggle)="standService.togglePinStand($event)"
                (colorChange)="standService.setStandColor($event.standId, $event.color)"
                (deleteStand)="standService.deleteStand($event)"
                (pingStand)="standService.pingStandApps($event)"
                (envFilterChange)="standService.setActiveEnvironment($event.standId, $event.env)"
                (openAddApp)="onOpenAddApp($event)"
                (removeApp)="standService.removeAppFromStand($event.standId, $event.appId)"
                (addChronicle)="standService.addChronicleEntry($event.standId, $event.entry)"
                (toggleTodo)="standService.toggleTodoItem($event.standId, $event.todoId)"
                (addTodo)="standService.addTodoItem($event.standId, $event.item)"
                (deleteTodo)="standService.deleteTodoItem($event.standId, $event.todoId)"
                (addNote)="standService.addNoteItem($event.standId, $event.note)"
                (updateNote)="standService.updateNoteItem($event.standId, $event.noteId, $event.patch)"
                (deleteNote)="standService.deleteNoteItem($event.standId, $event.noteId)"
              />
            }
          </section>
        } @else {
          <div class="p-12 text-center rounded-2xl bg-surface-container-low/40 border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-3">
            <span class="material-symbols-rounded text-3xl text-on-surface-variant">domain_disabled</span>
            <span class="text-sm font-medium text-on-surface">Нет стендов, соответствующих фильтру</span>
            <button
              type="button"
              (click)="showCreateStandModal = true"
              class="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold shadow-2xs hover:bg-primary-fixed-dim cursor-pointer"
            >
              Зарегистрировать первый стенд
            </button>
          </div>
        }
      }
      }

      <!-- MODALS -->
      @if (showCreateStandModal) {
        <app-create-stand-modal
          (close)="showCreateStandModal = false"
          (create)="onCreateStand($event)"
        />
      }

      @if (showAddAppModal && selectedStandIdForAddApp) {
        <app-add-app-modal
          [standId]="selectedStandIdForAddApp"
          [defaultMachineName]="(standService.selectedMachineName$ | async) || ''"
          (close)="showAddAppModal = false; selectedStandIdForAddApp = null"
          (add)="onAddAppToStand($event)"
        />
      }
    </div>
  `,
})
export class ProjectariumCockpitComponent {
  readonly standService = inject(ProjectStandService);

  showCreateStandModal = false;
  showAddAppModal = false;
  selectedStandIdForAddApp: string | null = null;

  activeCockpitView: 'STANDS' | 'ANALYTICS' = 'STANDS';
  analyticsDays = 30;
  showMachinePicker = false;
  customMachineInput = '';

  showSmartTouch = false;
  smartProjectName = '';
  smartAppName = '';
  smartHost = 'localhost';
  smartPort?: number;
  smartEnvironment: AppEnvironment = 'dev';
  isSubmitting = false;
  smartFeedback = '';

  readonly searchTerm$ = new BehaviorSubject<string>('');
  readonly selectedFolder$ = new BehaviorSubject<string>('ALL');
  readonly selectedColor$ = new BehaviorSubject<string>('ALL');
  readonly selectedTab$ = new BehaviorSubject<string>(this.loadSavedTab());

  readonly filterColors: LemonCardColor[] = [
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  readonly standsVm$ = combineLatest([
    this.standService.allStands$,
    this.searchTerm$,
    this.selectedFolder$,
    this.selectedColor$,
    this.selectedTab$,
  ]).pipe(
    map(([stands, search, folder, color, selectedTab]) => {
      let filtered = stands;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.neuronPath.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)) ||
            (s.notes || []).some(
              (n) =>
                (n.title && n.title.toLowerCase().includes(q)) ||
                n.content.toLowerCase().includes(q) ||
                (n.tags || []).some((t) => t.toLowerCase().includes(q)),
            ) ||
            s.apps.some(
              (a) =>
                a.appName.toLowerCase().includes(q) ||
                a.role.toLowerCase().includes(q) ||
                (a.host && a.host.toLowerCase().includes(q)) ||
                a.url.toLowerCase().includes(q) ||
                String(a.port).includes(q),
            ),
        );
      }

      if (folder !== 'ALL') {
        filtered = filtered.filter((s) => s.neuronPath.startsWith(folder));
      }

      if (color !== 'ALL') {
        filtered = filtered.filter((s) => s.color === color);
      }

      const pinned = filtered.filter((s) => s.isPinned);
      const regular = filtered.filter((s) => !s.isPinned);
      const ordered = [...pinned, ...regular];

      const activeStand =
        selectedTab === 'ALL'
          ? null
          : ordered.find((s) => s.slug === selectedTab) ?? ordered[0] ?? null;
      const activeTab = selectedTab === 'ALL' ? 'ALL' : activeStand?.slug ?? '';
      const displayedStands =
        activeTab === 'ALL' ? ordered : activeStand ? [activeStand] : [];

      return {
        totalCount: stands.length,
        availableNeurons: Array.from(new Set(stands.map((s) => s.neuronPath))),
        ordered,
        activeTab,
        activeStand,
        displayedStands,
      };
    }),
  );

  getTotalAppsCount(vm: { ordered: ProjectStand[] }): number {
    return vm.ordered.reduce((acc, s) => acc + s.apps.length, 0);
  }

  selectProjectTab(slugOrAll: string): void {
    this.selectedTab$.next(slugOrAll);
    try {
      localStorage.setItem('lemon_projectarium_active_tab_v1', slugOrAll);
    } catch {
      // storage unavailable
    }
  }

  hasStandIssue(stand: ProjectStand): boolean {
    return stand.apps.some((app) => app.status === 'DEGRADED' || app.status === 'EVICTED');
  }

  getProjectTabClass(isActive: boolean): string {
    return isActive
      ? 'bg-primary-container text-on-primary-container border-primary shadow-2xs'
      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface hover:bg-surface-container';
  }

  onOpenAddApp(standId: string): void {
    this.selectedStandIdForAddApp = standId;
    this.showAddAppModal = true;
  }

  onCreateStand(payload: {
    name: string;
    description: string;
    neuronPath: string;
    color: LemonCardColor;
    tags: string[];
  }): void {
    const created = this.standService.registerStand(payload);
    this.selectProjectTab(created.slug);
    this.showCreateStandModal = false;
  }

  onAddAppToStand(payload: {
    standId: string;
    appData: {
      appName: string;
      role: string;
      host?: string;
      desiredPort?: number;
      environment: AppEnvironment;
      networkMode: AppNetworkMode;
      machineId?: string;
      machineName?: string;
      customUrl?: string;
    };
  }): void {
    this.standService.addAppToStand(payload.standId, payload.appData);
    this.showAddAppModal = false;
    this.selectedStandIdForAddApp = null;
  }

  switchCockpitView(view: 'STANDS' | 'ANALYTICS'): void {
    this.activeCockpitView = view;
    if (view === 'ANALYTICS') {
      this.standService.fetchAnalytics(this.analyticsDays);
    }
  }

  onAnalyticsDaysChange(days: number): void {
    this.analyticsDays = days;
    this.standService.fetchAnalytics(days);
  }

  toggleMachinePicker(): void {
    this.showMachinePicker = !this.showMachinePicker;
    if (this.showMachinePicker) {
      this.standService.fetchMachines();
    }
  }

  selectMachine(machineId: string, machineName: string): void {
    this.standService.setSelectedMachine(machineId, machineName);
  }

  applyCustomMachine(): void {
    const raw = this.customMachineInput.trim();
    if (!raw) return;
    const id = raw
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!id) return;
    this.standService.setSelectedMachine(id, raw);
    this.customMachineInput = '';
  }

  getActiveMachineLabel(): string {
    const name = this.standService.getSelectedMachineName() || this.standService.getSelectedMachineId();
    return name ? `ПК: ${name}` : 'Публичный вид';
  }

  getCockpitViewBtnClass(isActive: boolean): string {
    return isActive
      ? 'bg-primary-container text-on-primary-container shadow-2xs'
      : 'text-on-surface-variant hover:text-on-surface';
  }

  getMachinePickerBtnClass(): string {
    const hasMachine = Boolean(this.standService.getSelectedMachineId());
    return hasMachine
      ? 'border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-300'
      : 'border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface';
  }

  getMachineOptionClass(isActive: boolean): string {
    return isActive
      ? 'bg-primary-container text-on-primary-container border-primary shadow-2xs'
      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface';
  }

  executeSmartTouch(): void {
    if (!this.smartProjectName.trim() || !this.smartAppName.trim()) return;

    const host = this.smartHost.trim() || 'localhost';
    const networkMode: AppNetworkMode =
      host === 'localhost' || host === '127.0.0.1'
        ? 'local'
        : host.endsWith('.ts.net')
          ? 'tailscale-funnel'
          : host.startsWith('100.')
            ? 'tailscale-lan'
            : 'lan';

    this.isSubmitting = true;
    this.smartFeedback = 'Вызов Smart Handler POST /api/projectarium/register...';

    this.standService
      .smartRegister({
        projectName: this.smartProjectName.trim(),
        appName: this.smartAppName.trim(),
        host,
        preferredPort: this.smartPort && this.smartPort > 0 ? this.smartPort : undefined,
        environment: this.smartEnvironment,
        networkMode,
        author: 'cockpit-ui',
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.smartFeedback = `✓ Успех: ${res.message} (Токен: ${res.projectToken})`;
          this.smartProjectName = '';
          this.smartAppName = '';
          this.smartHost = 'localhost';
          this.smartPort = undefined;
          if (res.project?.slug) {
            this.selectProjectTab(res.project.slug);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.smartFeedback = `Ошибка регистрации: ${err.message || 'Сбой API'}`;
        },
      });
  }

  private loadSavedTab(): string {
    try {
      return localStorage.getItem('lemon_projectarium_active_tab_v1') || '';
    } catch {
      return '';
    }
  }

  getColorDotBg(color: LemonCardColor): string {
    return getLemonColorDotClass(color);
  }
}
