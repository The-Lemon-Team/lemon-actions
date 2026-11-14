import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, timer } from 'rxjs';
import { LemonWorkerService } from '../../core/services/lemon-worker.service';
import { FlowOrchestratorService } from '../../core/services/flow-orchestrator.service';
import { LemonChronicleService } from '../../core/services/lemon-chronicle.service';
import { ProjectStandService } from '../../core/services/project-stand.service';
import { LemonCardColor, LemonWorkerCard } from '../../core/models/worker.models';
import {
  ProjectChronicleCard,
  ProjectSessionLogEntry,
} from '../../core/models/chronicle-card.models';
import {
  ReactiveTodoListCard,
  ReactiveTriggerType,
} from '../../core/models/todo-card.models';
import { ProjectStand } from '../../core/models/project-stand.models';
import { AppEnvironment, AppNetworkMode } from '../../core/models/health-checker.models';

import { LemonWorkerCardComponent } from './lemon-worker-card.component';
import { CreateWorkerModalComponent } from './create-worker-modal.component';
import { ServiceHealthCheckerComponent } from './service-health-checker.component';
import { ProjectChronicleCardComponent } from './project-chronicle-card.component';
import { ReactiveTodoCardComponent } from './reactive-todo-card.component';
import { CreateChronicleModalComponent } from './create-chronicle-modal.component';
import { CreateTodoModalComponent } from './create-todo-modal.component';
import { ProjectStandCardComponent } from './project-stand-card.component';
import { CreateStandModalComponent } from './create-stand-modal.component';
import { AddAppModalComponent } from './add-app-modal.component';

type ActiveTab = 'stands' | 'workers' | 'chronicle' | 'todos' | 'health';

@Component({
  selector: 'app-worker-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LemonWorkerCardComponent,
    CreateWorkerModalComponent,
    ServiceHealthCheckerComponent,
    ProjectChronicleCardComponent,
    ReactiveTodoCardComponent,
    CreateChronicleModalComponent,
    CreateTodoModalComponent,
    ProjectStandCardComponent,
    CreateStandModalComponent,
    AddAppModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-16">

      <!-- TOP CONTROL & TITLE -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-primary-container animate-pulse"></span>
              <h1 class="font-headline-sm text-xl md:text-2xl font-bold text-on-surface tracking-tight">
                Lemon Actions — Стенды Проектов и Потоки
              </h1>
            </div>
            <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
              Единые инфраструктурные стенды: регистрируйте приложения, ведите историю изменений и автоматизируйте задачи
            </p>
          </div>

          <!-- PRIMARY ACTION BUTTONS -->
          <div class="flex items-center gap-2">
            @if (activeTab === 'stands') {
              <button
                type="button"
                (click)="showCreateStandModal = true"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
              >
                <span class="material-symbols-rounded text-base">domain_add</span>
                <span>Зарегистрировать стенд</span>
              </button>
            } @else if (activeTab === 'workers') {
              <button
                type="button"
                (click)="showCreateWorkerModal = true"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
              >
                <span class="material-symbols-rounded text-base">add</span>
                <span>Создать воркера</span>
              </button>
            } @else if (activeTab === 'chronicle') {
              <button
                type="button"
                (click)="showCreateChronicleModal = true"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
              >
                <span class="material-symbols-rounded text-base">history_edu</span>
                <span>Новая хроника</span>
              </button>
            } @else if (activeTab === 'todos') {
              <button
                type="button"
                (click)="showCreateTodoModal = true"
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
              >
                <span class="material-symbols-rounded text-base">checklist</span>
                <span>Новый TodoList</span>
              </button>
            }
          </div>
        </div>

        <!-- TABS BAR -->
        <div class="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/30 self-start mt-1">
          <!-- 1. STANDS (Primary View) -->
          <button
            type="button"
            (click)="activeTab = 'stands'"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold font-headline-sm transition-all cursor-pointer"
            [class]="activeTab === 'stands' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-base">domain</span>
            <span>Стенды проектов</span>
            <span class="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-mono">
              {{ (standsVm$ | async)?.totalCount ?? 0 }}
            </span>
          </button>

          <!-- 2. WORKERS -->
          <button
            type="button"
            (click)="activeTab = 'workers'"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold font-headline-sm transition-all cursor-pointer"
            [class]="activeTab === 'workers' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-base">style</span>
            <span>Карточки-воркеры</span>
          </button>

          <!-- 3. CHRONICLE -->
          <button
            type="button"
            (click)="activeTab = 'chronicle'"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold font-headline-sm transition-all cursor-pointer"
            [class]="activeTab === 'chronicle' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-base">history_edu</span>
            <span>История по проектам</span>
            <span class="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-mono">
              {{ (chronicleVm$ | async)?.totalCount ?? 0 }}
            </span>
          </button>

          <!-- 4. TODOS -->
          <button
            type="button"
            (click)="activeTab = 'todos'"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold font-headline-sm transition-all cursor-pointer"
            [class]="activeTab === 'todos' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-base">checklist</span>
            <span>Реактивный TodoList</span>
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </button>

          <!-- 5. HEALTH CHECKER -->
          <button
            type="button"
            (click)="activeTab = 'health'"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold font-headline-sm transition-all cursor-pointer"
            [class]="activeTab === 'health' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-base">vital_signs</span>
            <span>Чекер сервисов (PROJECTION)</span>
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>

        <!-- SEARCH & FILTER TOOLBAR (Visible on cards tabs) -->
        @if (activeTab !== 'health') {
          <div class="p-2.5 rounded-2xl bg-surface-container-low/70 border border-outline-variant/30 flex flex-wrap items-center gap-2.5">
            <!-- Search Input -->
            <div class="relative flex-1 min-w-[220px]">
              <span class="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                search
              </span>
              <input
                type="text"
                [ngModel]="searchTerm$ | async"
                (ngModelChange)="searchTerm$.next($event)"
                placeholder="Поиск по названию, папке, приложениям или тегам..."
                class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>

            <!-- Filter by Neuron Folder -->
            <div class="flex items-center gap-1">
              <span class="text-xs text-on-surface-variant font-medium">Нейрон:</span>
              <select
                [ngModel]="selectedFolder$ | async"
                (ngModelChange)="selectedFolder$.next($event)"
                class="px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="ALL">Все Нейроны</option>
                <option value="workspace.seasons">workspace.seasons (Lemon Seasons)</option>
                <option value="workspace.actions">workspace.actions (Lemon Actions)</option>
                <option value="workspace.sportdrop">workspace.sportdrop (Sportdrop)</option>
                <option value="workspace.core">workspace.core</option>
                <option value="workspace.reports">workspace.reports</option>
              </select>
            </div>

            <!-- Filter by Color -->
            <div class="flex items-center gap-1 pl-1 border-l border-outline-variant/30">
              <span class="text-xs text-on-surface-variant font-medium">Цвет:</span>
              <div class="flex items-center gap-1">
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
          </div>
        }
      </section>

      <!-- ================================================================== -->
      <!-- TAB 1: PROJECT STANDS (ОБЩИЕ СТЕНДЫ ПРОЕКТОВ)                      -->
      <!-- ================================================================== -->
      @if (activeTab === 'stands') {
        @if (standsVm$ | async; as vm) {
          <!-- PORT SHIELD HUD BAR -->
          <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs mb-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0">
                <span class="material-symbols-rounded text-xl">shield</span>
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="font-headline-sm font-bold text-sm text-on-surface">Lemon-Projectarium Cockpit</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                    Zero-Deadlock Active
                  </span>
                </div>
                <span class="text-xs text-on-surface-variant">
                  Корневые якоря: PostgreSQL (:5433), API (:3000), Web (:4201). Динамический пул: порты 4320+.
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

          <!-- Pinned Stands -->
          @if (vm.pinned.length > 0) {
            <section class="flex flex-col gap-3.5">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-primary">push_pin</span>
                <span>Закреплённые стенды проектов ({{ vm.pinned.length }})</span>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                @for (stand of vm.pinned; track stand.id) {
                  <app-project-stand-card
                    [stand]="stand"
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
              </div>
            </section>
          }

          <!-- Regular Stands -->
          <section class="flex flex-col gap-3.5 mt-2">
            @if (vm.pinned.length > 0 && vm.regular.length > 0) {
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-on-surface-variant">domain</span>
                <span>Все стенды ({{ vm.regular.length }})</span>
              </div>
            }

            @if (vm.regular.length > 0) {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                @for (stand of vm.regular; track stand.id) {
                  <app-project-stand-card
                    [stand]="stand"
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
              </div>
            } @else if (vm.pinned.length === 0) {
              <div class="p-12 text-center rounded-2xl bg-surface-container-low/40 border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-primary-container/40 flex items-center justify-center text-primary">
                  <span class="material-symbols-rounded text-2xl">domain</span>
                </div>
                <div>
                  <h3 class="font-headline-sm text-sm font-bold text-on-surface">Нет зарегистрированных стендов проектов</h3>
                  <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                    Зарегистрируйте постоянный стенд проекта перед началом работы, чтобы объединить микросервисы, чекер и задачи
                  </p>
                </div>
                <button
                  type="button"
                  (click)="showCreateStandModal = true"
                  class="mt-1 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold font-headline-sm shadow-xs transition-all cursor-pointer"
                >
                  + Зарегистрировать стенд
                </button>
              </div>
            }
          </section>
        }
      }

      <!-- ================================================================== -->
      <!-- TAB 2: WORKERS BOARD                                               -->
      <!-- ================================================================== -->
      @if (activeTab === 'workers') {
        @if (workersVm$ | async; as vm) {
          <!-- Pinned Section -->
          @if (vm.pinned.length > 0) {
            <section class="flex flex-col gap-3.5">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-primary">push_pin</span>
                <span>Закреплённые воркеры ({{ vm.pinned.length }})</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (worker of vm.pinned; track worker.id) {
                  <app-lemon-worker-card
                    [worker]="worker"
                    [isExecuting]="(executingMap$ | async)?.[worker.id] ?? false"
                    (pinToggle)="workerService.togglePin($event)"
                    (pauseToggle)="workerService.togglePause($event)"
                    (triggerNow)="onTriggerWorker($event)"
                    (deleteCard)="workerService.deleteWorker($event)"
                    (colorChange)="workerService.setColor($event.id, $event.color)"
                  />
                }
              </div>
            </section>
          }

          <!-- Regular Section -->
          <section class="flex flex-col gap-3.5 mt-2">
            @if (vm.pinned.length > 0 && vm.regular.length > 0) {
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-on-surface-variant">grid_view</span>
                <span>Все воркеры ({{ vm.regular.length }})</span>
              </div>
            }

            @if (vm.regular.length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (worker of vm.regular; track worker.id) {
                  <app-lemon-worker-card
                    [worker]="worker"
                    [isExecuting]="(executingMap$ | async)?.[worker.id] ?? false"
                    (pinToggle)="workerService.togglePin($event)"
                    (pauseToggle)="workerService.togglePause($event)"
                    (triggerNow)="onTriggerWorker($event)"
                    (deleteCard)="workerService.deleteWorker($event)"
                    (colorChange)="workerService.setColor($event.id, $event.color)"
                  />
                }
              </div>
            }
          </section>
        }
      }

      <!-- ================================================================== -->
      <!-- TAB 3: PROJECT CHRONICLE (HISTORY)                                 -->
      <!-- ================================================================== -->
      @if (activeTab === 'chronicle') {
        @if (chronicleVm$ | async; as vm) {
          @if (vm.pinned.length > 0) {
            <section class="flex flex-col gap-3.5">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-primary">push_pin</span>
                <span>Закреплённая хроника проектов ({{ vm.pinned.length }})</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (card of vm.pinned; track card.id) {
                  <app-project-chronicle-card
                    [card]="card"
                    (pinToggle)="chronicleService.togglePinChronicle($event)"
                    (colorChange)="chronicleService.setChronicleColor($event.id, $event.color)"
                    (deleteCard)="chronicleService.deleteChronicleCard($event)"
                    (addLog)="chronicleService.addSessionLog($event.cardId, $event.entry)"
                  />
                }
              </div>
            </section>
          }

          <section class="flex flex-col gap-3.5 mt-2">
            @if (vm.regular.length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (card of vm.regular; track card.id) {
                  <app-project-chronicle-card
                    [card]="card"
                    (pinToggle)="chronicleService.togglePinChronicle($event)"
                    (colorChange)="chronicleService.setChronicleColor($event.id, $event.color)"
                    (deleteCard)="chronicleService.deleteChronicleCard($event)"
                    (addLog)="chronicleService.addSessionLog($event.cardId, $event.entry)"
                  />
                }
              </div>
            }
          </section>
        }
      }

      <!-- ================================================================== -->
      <!-- TAB 4: REACTIVE TODOLIST                                           -->
      <!-- ================================================================== -->
      @if (activeTab === 'todos') {
        @if (todosVm$ | async; as vm) {
          @if (vm.pinned.length > 0) {
            <section class="flex flex-col gap-3.5">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span class="material-symbols-rounded text-sm text-primary">push_pin</span>
                <span>Закреплённые TodoList ({{ vm.pinned.length }})</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (card of vm.pinned; track card.id) {
                  <app-reactive-todo-card
                    [card]="card"
                    (pinToggle)="chronicleService.togglePinTodo($event)"
                    (colorChange)="chronicleService.setTodoColor($event.id, $event.color)"
                    (deleteCard)="chronicleService.deleteTodoCard($event)"
                    (toggleItem)="chronicleService.toggleTodoItem($event.cardId, $event.itemId)"
                    (deleteItem)="chronicleService.deleteTodoItem($event.cardId, $event.itemId)"
                    (addItem)="chronicleService.addTodoItem($event.cardId, $event.item)"
                    (simulateImpulse)="onSimulateImpulse($event)"
                  />
                }
              </div>
            </section>
          }

          <section class="flex flex-col gap-3.5 mt-2">
            @if (vm.regular.length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (card of vm.regular; track card.id) {
                  <app-reactive-todo-card
                    [card]="card"
                    (pinToggle)="chronicleService.togglePinTodo($event)"
                    (colorChange)="chronicleService.setTodoColor($event.id, $event.color)"
                    (deleteCard)="chronicleService.deleteTodoCard($event)"
                    (toggleItem)="chronicleService.toggleTodoItem($event.cardId, $event.itemId)"
                    (deleteItem)="chronicleService.deleteTodoItem($event.cardId, $event.itemId)"
                    (addItem)="chronicleService.addTodoItem($event.cardId, $event.item)"
                    (simulateImpulse)="onSimulateImpulse($event)"
                  />
                }
              </div>
            }
          </section>
        }
      }

      <!-- ================================================================== -->
      <!-- TAB 5: SERVICE HEALTH CHECKER (PROJECTION)                         -->
      <!-- ================================================================== -->
      @if (activeTab === 'health') {
        <app-service-health-checker />
      }

      <!-- ================================================================== -->
      <!-- MODALS                                                             -->
      <!-- ================================================================== -->
      @if (showCreateStandModal) {
        <app-create-stand-modal
          (close)="showCreateStandModal = false"
          (create)="onCreateStand($event)"
        />
      }

      @if (showAddAppModal && selectedStandIdForAddApp) {
        <app-add-app-modal
          [standId]="selectedStandIdForAddApp"
          (close)="showAddAppModal = false"
          (add)="onAddAppToStand($event)"
        />
      }

      @if (showCreateWorkerModal) {
        <app-create-worker-modal
          (close)="showCreateWorkerModal = false"
          (create)="onCreateWorker($event)"
        />
      }

      @if (showCreateChronicleModal) {
        <app-create-chronicle-modal
          (close)="showCreateChronicleModal = false"
          (create)="onCreateChronicle($event)"
        />
      }

      @if (showCreateTodoModal) {
        <app-create-todo-modal
          (close)="showCreateTodoModal = false"
          (create)="onCreateTodo($event)"
        />
      }

      <!-- ================================================================== -->
      <!-- REACTIVE IMPULSE TOAST NOTIFICATION                                -->
      <!-- ================================================================== -->
      @if (latestToast) {
        <div
          class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container-highest/95 backdrop-blur-md border border-outline-variant/40 shadow-xl text-on-surface transition-all animate-bounce"
        >
          <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-rounded text-lg">bolt</span>
          </div>
          <div class="flex flex-col text-xs max-w-sm">
            <span class="font-bold text-on-surface">Реактивный импульс сработал</span>
            <span class="text-on-surface-variant">{{ latestToast.message }}</span>
          </div>
          <button
            type="button"
            (click)="latestToast = null"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

    </div>
  `,
})
export class WorkerBoardComponent {
  readonly standService = inject(ProjectStandService);
  readonly workerService = inject(LemonWorkerService);
  readonly chronicleService = inject(LemonChronicleService);
  readonly orchestrator = inject(FlowOrchestratorService);

  activeTab: ActiveTab = 'stands';

  showCreateStandModal = false;
  showAddAppModal = false;
  selectedStandIdForAddApp: string | null = null;

  showCreateWorkerModal = false;
  showCreateChronicleModal = false;
  showCreateTodoModal = false;

  latestToast: { message: string; type: ReactiveTriggerType } | null = null;

  readonly executingMap$ = this.workerService.executingState$;

  readonly searchTerm$ = new BehaviorSubject<string>('');
  readonly selectedFolder$ = new BehaviorSubject<string>('ALL');
  readonly selectedColor$ = new BehaviorSubject<string>('ALL');

  readonly filterColors: LemonCardColor[] = [
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  constructor() {
    this.chronicleService.impulseToast$.subscribe((toast) => {
      this.latestToast = toast;
      timer(4500).subscribe(() => {
        if (this.latestToast === toast) {
          this.latestToast = null;
        }
      });
    });
  }

  // 1. STANDS VIEW MODEL
  readonly standsVm$ = combineLatest([
    this.standService.allStands$,
    this.searchTerm$,
    this.selectedFolder$,
    this.selectedColor$,
  ]).pipe(
    map(([stands, search, folder, color]) => {
      let filtered = stands;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.neuronPath.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)) ||
            s.apps.some((a) => a.appName.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)),
        );
      }

      if (folder !== 'ALL') {
        filtered = filtered.filter((s) => s.neuronPath.startsWith(folder));
      }

      if (color !== 'ALL') {
        filtered = filtered.filter((s) => s.color === color);
      }

      return {
        totalCount: stands.length,
        pinned: filtered.filter((s) => s.isPinned),
        regular: filtered.filter((s) => !s.isPinned),
      };
    }),
  );

  getTotalAppsCount(vm: { pinned: ProjectStand[]; regular: ProjectStand[] }): number {
    return [...vm.pinned, ...vm.regular].reduce((acc, s) => acc + s.apps.length, 0);
  }

  // 2. WORKERS VIEW MODEL
  readonly workersVm$ = combineLatest([
    this.workerService.allWorkers$,
    this.searchTerm$,
    this.selectedFolder$,
    this.selectedColor$,
  ]).pipe(
    map(([workers, search, folder, color]) => {
      let filtered = workers;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.description?.toLowerCase().includes(q) ||
            w.neuronPath.toLowerCase().includes(q) ||
            (w.rule.action.kind === 'HTTP_REQUEST' && w.rule.action.url.toLowerCase().includes(q)),
        );
      }

      if (folder !== 'ALL') {
        filtered = filtered.filter((w) => w.neuronPath.startsWith(folder));
      }

      if (color !== 'ALL') {
        filtered = filtered.filter((w) => w.color === color);
      }

      return {
        pinned: filtered.filter((w) => w.isPinned),
        regular: filtered.filter((w) => !w.isPinned),
      };
    }),
  );

  // 3. CHRONICLE VIEW MODEL
  readonly chronicleVm$ = combineLatest([
    this.chronicleService.allChronicleCards$,
    this.searchTerm$,
    this.selectedFolder$,
    this.selectedColor$,
  ]).pipe(
    map(([cards, search, folder, color]) => {
      let filtered = cards;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.projectName.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.projectId.toLowerCase().includes(q) ||
            c.tags.some((t) => t.toLowerCase().includes(q)) ||
            c.history.some((h) => h.title.toLowerCase().includes(q) || h.details?.toLowerCase().includes(q)),
        );
      }

      if (folder !== 'ALL') {
        filtered = filtered.filter((c) => c.projectId.startsWith(folder));
      }

      if (color !== 'ALL') {
        filtered = filtered.filter((c) => c.color === color);
      }

      return {
        totalCount: cards.length,
        pinned: filtered.filter((c) => c.isPinned),
        regular: filtered.filter((c) => !c.isPinned),
      };
    }),
  );

  // 4. TODOS VIEW MODEL
  readonly todosVm$ = combineLatest([
    this.chronicleService.allTodoCards$,
    this.searchTerm$,
    this.selectedFolder$,
    this.selectedColor$,
  ]).pipe(
    map(([cards, search, folder, color]) => {
      let filtered = cards;

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.projectId.toLowerCase().includes(q) ||
            c.items.some((i) => i.text.toLowerCase().includes(q)),
        );
      }

      if (folder !== 'ALL') {
        filtered = filtered.filter((c) => c.projectId.startsWith(folder) || c.projectId === 'all');
      }

      if (color !== 'ALL') {
        filtered = filtered.filter((c) => c.color === color);
      }

      return {
        pinned: filtered.filter((c) => c.isPinned),
        regular: filtered.filter((c) => !c.isPinned),
      };
    }),
  );

  onOpenAddApp(standId: string): void {
    this.selectedStandIdForAddApp = standId;
    this.showAddAppModal = true;
  }

  onAddAppToStand(payload: {
    standId: string;
    appData: {
      appName: string;
      role: string;
      desiredPort?: number;
      environment: AppEnvironment;
      networkMode: AppNetworkMode;
      customUrl?: string;
    };
  }): void {
    this.standService.addAppToStand(payload.standId, payload.appData);
    this.showAddAppModal = false;
    this.selectedStandIdForAddApp = null;
  }

  onCreateStand(payload: {
    name: string;
    description: string;
    neuronPath: string;
    color: LemonCardColor;
    tags: string[];
  }): void {
    this.standService.registerStand(payload);
    this.showCreateStandModal = false;
  }

  onTriggerWorker(id: string): void {
    this.workerService.triggerWorker(id).subscribe();
  }

  onCreateWorker(
    payload: Omit<LemonWorkerCard, 'id' | 'createdAt' | 'updatedAt' | 'telemetry'>,
  ): void {
    this.workerService.createWorker(payload);
    this.showCreateWorkerModal = false;
  }

  onCreateChronicle(
    payload: Omit<ProjectChronicleCard, 'id' | 'createdAt' | 'updatedAt'>,
  ): void {
    this.chronicleService.createChronicleCard(payload);
    this.showCreateChronicleModal = false;
  }

  onCreateTodo(
    payload: Omit<ReactiveTodoListCard, 'id' | 'createdAt' | 'updatedAt'>,
  ): void {
    this.chronicleService.createTodoCard(payload);
    this.showCreateTodoModal = false;
  }

  onSimulateImpulse(type: ReactiveTriggerType): void {
    this.chronicleService.dispatchReactiveImpulse(
      type,
      `Тестовый импульс [${type}] успешно отправлен в реактивную шину`,
    );
  }

  getColorDotBg(color: LemonCardColor): string {
    switch (color) {
      case 'lemon':
        return 'bg-[#ffe176]';
      case 'amber':
        return 'bg-[#ffb74d]';
      case 'sage':
        return 'bg-[#a5d6a7]';
      case 'lavender':
        return 'bg-[#ce93d8]';
      case 'sky':
        return 'bg-[#81d4fa]';
      case 'rose':
        return 'bg-[#ef9a9a]';
      case 'slate':
        return 'bg-[#b0bec5]';
      default:
        return 'bg-[#ffffff]';
    }
  }
}
