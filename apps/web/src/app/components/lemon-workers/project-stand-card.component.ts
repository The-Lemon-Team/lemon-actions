import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProjectStand,
  StandAppItem,
  StandAppStatus,
} from '../../core/models/project-stand.models';
import { AppEnvironment, AppNetworkMode } from '../../core/models/health-checker.models';
import { LEMON_CARD_PALETTES, LemonCardColor } from '../../core/models/worker.models';
import { ChronicleEventType, ProjectSessionLogEntry } from '../../core/models/chronicle-card.models';
import { ReactiveTriggerType } from '../../core/models/todo-card.models';

type StandSubTab = 'APPS' | 'TODOS' | 'CHRONICLE';

@Component({
  selector: 'app-project-stand-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-200 border shadow-2xs hover:shadow-md"
      [ngClass]="[palette.bgClass, palette.borderClass]"
    >
      <div>
        <!-- TOP ROW: NEURON WORKSPACE, PROJECT TOKEN & PIN -->
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <div class="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide border border-black/5 bg-black/5 dark:bg-white/10 dark:border-white/10 text-on-surface">
              <span class="material-symbols-rounded text-sm text-primary">domain</span>
              <span class="truncate max-w-[150px]">{{ stand.neuronPath }}</span>
            </div>
            @if (stand.projectToken) {
              <div
                class="px-2 py-0.5 rounded-md font-mono text-[9px] text-on-surface-variant bg-black/5 dark:bg-white/5 border border-black/5 truncate max-w-[140px]"
                [title]="'Master Project Token: ' + stand.projectToken"
              >
                🔑 {{ stand.projectToken }}
              </div>
            }
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="pingStand.emit(stand.id)"
              class="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim transition-all active:scale-95 shadow-2xs cursor-pointer"
              title="Опросить здоровье всех приложений стенда"
            >
              <span class="material-symbols-rounded text-xs">vital_signs</span>
              <span>Пинг стенда</span>
            </button>

            <!-- Pin Button (Keep style) -->
            <button
              type="button"
              (click)="pinToggle.emit(stand.id)"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              [class]="getPinButtonClass(stand.isPinned)"
              [title]="stand.isPinned ? 'Открепить стенд' : 'Закрепить стенд вверху'"
            >
              <span
                class="material-symbols-rounded text-lg"
                [style.font-variation-settings]="pinVariation"
              >
                push_pin
              </span>
            </button>
          </div>
        </div>

        <!-- STAND TITLE & DESCRIPTION -->
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <h3 class="font-headline-sm text-xl font-bold text-on-surface leading-snug tracking-tight">
              {{ stand.name }}
            </h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              Стенд активен
            </span>
          </div>
          <p class="font-body-sm text-xs text-on-surface-variant/80 leading-relaxed mt-1">
            {{ stand.description }}
          </p>
        </div>

        <!-- TAGS ROW -->
        @if (stand.tags && stand.tags.length > 0) {
          <div class="flex flex-wrap gap-1.5 mb-3.5">
            @for (tag of stand.tags; track tag) {
              <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-black/5 dark:bg-white/10 text-on-surface-variant">
                #{{ tag }}
              </span>
            }
          </div>
        }

        <!-- SUB-TABS SELECTOR (KEEP COCKPIT STYLE) -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mb-4 text-xs font-semibold">
          <button
            type="button"
            (click)="activeSubTab = 'APPS'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            [class]="activeSubTab === 'APPS' ? 'bg-primary-container text-on-primary-container shadow-2xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-sm">shield</span>
            <span>Сервисы ({{ filteredApps.length }})</span>
          </button>
          <button
            type="button"
            (click)="activeSubTab = 'TODOS'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            [class]="activeSubTab === 'TODOS' ? 'bg-primary-container text-on-primary-container shadow-2xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-sm">checklist</span>
            <span>Чек-лист ({{ completedTodosCount }}/{{ stand.todos.length }})</span>
          </button>
          <button
            type="button"
            (click)="activeSubTab = 'CHRONICLE'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            [class]="activeSubTab === 'CHRONICLE' ? 'bg-primary-container text-on-primary-container shadow-2xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            <span class="material-symbols-rounded text-sm">history_edu</span>
            <span>Хроника ({{ stand.chronicle.length }})</span>
          </button>
        </div>

        <!-- ============================================================== -->
        <!-- SUB-TAB 1: СЕРВИСЫ СТЕНДА (APPLICATIONS & PORT SHIELD)          -->
        <!-- ============================================================== -->
        @if (activeSubTab === 'APPS') {
          <section class="flex flex-col gap-2.5 mb-3">
            <!-- Environment filter pills -->
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="envFilterChange.emit({ standId: stand.id, env: 'ALL' })"
                  class="px-2 py-0.5 rounded-lg text-[10px] cursor-pointer"
                  [class]="stand.activeEnvironment === 'ALL' ? 'bg-black/15 font-bold' : 'text-on-surface-variant hover:text-on-surface'"
                >
                  Все
                </button>
                <button
                  type="button"
                  (click)="envFilterChange.emit({ standId: stand.id, env: 'dev' })"
                  class="px-2 py-0.5 rounded-lg text-[10px] cursor-pointer"
                  [class]="stand.activeEnvironment === 'dev' ? 'bg-black/15 font-bold' : 'text-on-surface-variant hover:text-on-surface'"
                >
                  DEV ({{ countByEnv('dev') }})
                </button>
                <button
                  type="button"
                  (click)="envFilterChange.emit({ standId: stand.id, env: 'staging' })"
                  class="px-2 py-0.5 rounded-lg text-[10px] cursor-pointer"
                  [class]="stand.activeEnvironment === 'staging' ? 'bg-black/15 font-bold' : 'text-on-surface-variant hover:text-on-surface'"
                >
                  STAGING ({{ countByEnv('staging') }})
                </button>
                <button
                  type="button"
                  (click)="envFilterChange.emit({ standId: stand.id, env: 'production' })"
                  class="px-2 py-0.5 rounded-lg text-[10px] cursor-pointer"
                  [class]="stand.activeEnvironment === 'production' ? 'bg-black/15 font-bold' : 'text-on-surface-variant hover:text-on-surface'"
                >
                  PROD ({{ countByEnv('production') }})
                </button>
              </div>

              <button
                type="button"
                (click)="openAddApp.emit(stand.id)"
                class="text-primary hover:underline text-[11px] font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <span class="material-symbols-rounded text-xs">add</span>
                <span>Добавить сервис</span>
              </button>
            </div>

            <!-- List of protected apps -->
            <div class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              @for (app of filteredApps; track app.id) {
                <div class="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all hover:bg-black/10">
                  <!-- App Icon & Details -->
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary flex-shrink-0">
                      <span class="material-symbols-rounded text-base">{{ app.icon }}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold text-xs text-on-surface truncate">{{ app.appName }}</span>
                        <!-- Port Shield Badge -->
                        <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-on-surface flex items-center gap-0.5">
                          <span class="material-symbols-rounded text-[11px] text-primary">shield</span>
                          <span>:{{ app.port }}</span>
                        </span>
                        <!-- Lease Token Badge -->
                        @if (app.leaseToken) {
                          <span
                            class="font-mono text-[9px] text-on-surface-variant/70 truncate max-w-[90px]"
                            [title]="'Lease: ' + app.leaseToken"
                          >
                            {{ app.leaseToken }}
                          </span>
                        }
                      </div>
                      <span class="text-[10px] text-on-surface-variant/80 truncate">
                        {{ app.role }}
                      </span>
                    </div>
                  </div>

                  <!-- Right Side: Status, Circuit Breaker Controls & Actions -->
                  <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                    <!-- Environment / Network badge -->
                    <div class="flex flex-col items-end text-[9px] font-mono">
                      <span class="font-bold uppercase" [ngClass]="getEnvColor(app.environment)">
                        {{ app.environment }}
                      </span>
                      <span class="text-on-surface-variant/70">
                        {{ getNetworkLabel(app.networkMode) }}
                      </span>
                    </div>

                    <!-- Health status badge -->
                    <div
                      class="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-bold"
                      [class]="getHealthBadgeClass(app.status)"
                    >
                      <span
                        class="w-1.5 h-1.5 rounded-full"
                        [class]="getHealthDotClass(app.status)"
                      ></span>
                      <span>{{ getHealthLabel(app) }}</span>
                    </div>

                    <!-- Circuit Breaker Action: Simulate Failure -->
                    <button
                      type="button"
                      (click)="simulateFailure.emit({ standId: stand.id, appId: app.id })"
                      class="px-1.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-all cursor-pointer flex items-center gap-0.5"
                      title="Симулировать сбой сервиса (Circuit Breaker тест)"
                    >
                      <span class="material-symbols-rounded text-xs">bolt</span>
                      <span>Сбой</span>
                    </button>

                    <!-- Heartbeat Recovery Action -->
                    @if (app.status === 'DEGRADED' || app.status === 'EVICTED') {
                      <button
                        type="button"
                        (click)="heartbeatApp.emit({ standId: stand.id, appId: app.id })"
                        class="px-1.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer flex items-center gap-0.5"
                        title="Восстановить работу сервиса (Heartbeat OK)"
                      >
                        <span class="material-symbols-rounded text-xs">healing</span>
                        <span>Восстановить</span>
                      </button>
                    }

                    <!-- Delete button -->
                    <button
                      type="button"
                      (click)="removeApp.emit({ standId: stand.id, appId: app.id })"
                      class="w-6 h-6 rounded-md flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors opacity-60 hover:opacity-100 cursor-pointer"
                      title="Освободить порт и удалить приложение из пула"
                    >
                      <span class="material-symbols-rounded text-sm">close</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="p-4 text-center rounded-2xl bg-black/5 text-[11px] text-on-surface-variant">
                  Нет сервисов в данном фильтре окружения
                </div>
              }
            </div>
          </section>
        }

        <!-- ============================================================== -->
        <!-- SUB-TAB 2: ДВУХУРОВНЕВЫЙ ЧЕК-ЛИСТ (PROJECT & APP TASKS)         -->
        <!-- ============================================================== -->
        @if (activeSubTab === 'TODOS') {
          <section class="flex flex-col gap-2.5 mb-3">
            <!-- Progress Bar -->
            <div class="flex items-center justify-between text-[11px] font-mono text-on-surface-variant mb-0.5">
              <span>Прогресс выполнения:</span>
              <span class="font-bold">{{ completedTodosCount }}/{{ stand.todos.length }} ({{ todoPercentage }}%)</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-1">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out bg-emerald-500"
                [style.width.%]="todoPercentage"
              ></div>
            </div>

            <!-- Add Task Toggle / Inline Form -->
            <div class="flex items-center justify-between text-[11px] font-bold text-on-surface-variant/80 uppercase">
              <span>Задачи стенда</span>
              <button
                type="button"
                (click)="showAddTodo = !showAddTodo"
                class="text-primary hover:underline lowercase font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <span class="material-symbols-rounded text-xs">{{ showAddTodo ? 'expand_less' : 'add' }}</span>
                <span>{{ showAddTodo ? 'Скрыть форму' : 'Новая задача' }}</span>
              </button>
            </div>

            @if (showAddTodo) {
              <div class="p-3 rounded-2xl bg-surface-container-lowest/95 border border-outline-variant/30 flex flex-col gap-2 text-xs shadow-xs">
                <input
                  type="text"
                  [(ngModel)]="newTodoText"
                  placeholder="Текст задачи (например: Настроить SSL сертификат)..."
                  class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <!-- Scope Selector -->
                  <div class="flex flex-col gap-0.5">
                    <label class="text-[10px] text-on-surface-variant font-medium">Уровень задачи:</label>
                    <select
                      [(ngModel)]="newTodoScope"
                      class="px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                    >
                      <option value="PROJECT">Весь Проект (PROJECT)</option>
                      <option value="APP">Конкретный Сервис (APP)</option>
                    </select>
                  </div>

                  <!-- Target App (if scope is APP) -->
                  @if (newTodoScope === 'APP') {
                    <div class="flex flex-col gap-0.5">
                      <label class="text-[10px] text-on-surface-variant font-medium">Сервис:</label>
                      <select
                        [(ngModel)]="newTodoTargetAppName"
                        class="px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                      >
                        @for (app of stand.apps; track app.id) {
                          <option [value]="app.appName">{{ app.appName }} (:{{ app.port }})</option>
                        }
                      </select>
                    </div>
                  }

                  <!-- Priority Selector -->
                  <div class="flex flex-col gap-0.5">
                    <label class="text-[10px] text-on-surface-variant font-medium">Приоритет:</label>
                    <select
                      [(ngModel)]="newTodoPriority"
                      class="px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                    >
                      <option value="HIGH">Высокий (HIGH)</option>
                      <option value="MEDIUM">Средний (MEDIUM)</option>
                      <option value="LOW">Низкий (LOW)</option>
                    </select>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    (click)="showAddTodo = false"
                    class="px-2.5 py-1 text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    (click)="submitTodo()"
                    [disabled]="!newTodoText.trim()"
                    class="px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-[11px] disabled:opacity-40 cursor-pointer"
                  >
                    Добавить задачу
                  </button>
                </div>
              </div>
            }

            <!-- Tasks list -->
            <div class="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
              @for (todo of stand.todos; track todo.id) {
                <div
                  class="p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all"
                  [class]="todo.completed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      (click)="toggleTodo.emit({ standId: stand.id, todoId: todo.id })"
                      class="w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                      [class]="todo.completed ? 'border-primary bg-primary text-on-primary' : 'border-black/30 dark:border-white/30 hover:border-primary'"
                    >
                      @if (todo.completed) {
                        <span class="material-symbols-rounded text-xs font-bold">check</span>
                      }
                    </button>
                    <div class="flex flex-col min-w-0">
                      <span
                        class="text-xs truncate font-medium"
                        [class.line-through]="todo.completed"
                        [class.text-on-surface-variant]="todo.completed"
                        [class.text-on-surface]="!todo.completed"
                      >
                        {{ todo.text }}
                      </span>
                      @if (todo.completedAt) {
                        <span class="text-[9px] text-on-surface-variant/70">
                          Выполнено {{ formatTimestamp(todo.completedAt) }}
                        </span>
                      }
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <!-- Scope Badge -->
                    <span
                      class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                      [class]="getScopeBadgeClass(todo.scope)"
                    >
                      {{ todo.scope === 'APP' && todo.targetAppName ? todo.targetAppName : (todo.scope || 'PROJECT') }}
                    </span>

                    <!-- Priority Badge -->
                    <span
                      class="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold"
                      [class]="getPriorityBadgeClass(todo.priority)"
                    >
                      {{ todo.priority || 'MED' }}
                    </span>

                    <button
                      type="button"
                      (click)="deleteTodo.emit({ standId: stand.id, todoId: todo.id })"
                      class="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-error opacity-60 hover:opacity-100 cursor-pointer"
                    >
                      <span class="material-symbols-rounded text-xs">close</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="p-3 text-center rounded-xl bg-black/5 text-[11px] text-on-surface-variant">
                  Чек-лист чист. Добавьте первую задачу проекта или сервиса!
                </div>
              }
            </div>
          </section>
        }

        <!-- ============================================================== -->
        <!-- SUB-TAB 3: ХРОНИКА ИЗМЕНЕНИЙ (CHRONICLE & AUDIT TRAIL)          -->
        <!-- ============================================================== -->
        @if (activeSubTab === 'CHRONICLE') {
          <section class="flex flex-col gap-2.5 mb-3">
            <div class="flex items-center justify-between text-[11px] font-bold text-on-surface-variant/80 uppercase">
              <span>Хроника изменений ({{ stand.chronicle.length }})</span>
              <button
                type="button"
                (click)="showAddLog = !showAddLog"
                class="text-primary hover:underline lowercase font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <span class="material-symbols-rounded text-xs">{{ showAddLog ? 'expand_less' : 'add' }}</span>
                <span>{{ showAddLog ? 'Скрыть форму' : 'Запись в хронологию' }}</span>
              </button>
            </div>

            @if (showAddLog) {
              <div class="p-2.5 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-1.5 text-xs shadow-xs">
                <input
                  type="text"
                  [(ngModel)]="newLogTitle"
                  placeholder="Заголовок события (например: Синхронизированы DTO контракты)..."
                  class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div class="flex items-center justify-between gap-2">
                  <select
                    [(ngModel)]="newLogType"
                    class="px-2 py-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface"
                  >
                    <option value="MILESTONE">Веха (MILESTONE)</option>
                    <option value="DEPLOY">Деплой (DEPLOY)</option>
                    <option value="SERVICE_EVENT">Сервис (SERVICE)</option>
                    <option value="WORKER_RUN">Воркер (WORKER)</option>
                  </select>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      (click)="showAddLog = false"
                      class="px-2 py-1 text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      (click)="submitLog()"
                      [disabled]="!newLogTitle.trim()"
                      class="px-3 py-1 rounded-xl bg-primary-container text-on-primary-container font-bold text-[11px] disabled:opacity-40 cursor-pointer"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            }

            <div class="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
              @for (log of stand.chronicle; track log.id) {
                <div class="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-1 text-xs">
                  <div class="flex items-center justify-between text-[9px] font-mono">
                    <span class="font-bold uppercase text-primary">[{{ log.badge || log.type }}] {{ log.author }}</span>
                    <span class="text-on-surface-variant">{{ formatTimestamp(log.timestamp) }}</span>
                  </div>
                  <div class="font-medium text-on-surface text-[11px] leading-tight">{{ log.title }}</div>
                  @if (log.details) {
                    <div class="text-[10px] text-on-surface-variant/80">{{ log.details }}</div>
                  }
                </div>
              } @empty {
                <div class="p-3 text-center rounded-xl bg-black/5 text-[11px] text-on-surface-variant">
                  Хроника изменений пока пуста
                </div>
              }
            </div>
          </section>
        }
      </div>

      <!-- CARD FOOTER: METRICS & COLOR PICKER -->
      <footer class="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-1 text-[11px] text-on-surface-variant font-mono">
          <span>{{ stand.apps.length }} сервисов</span>
          <span>•</span>
          <span>{{ completedTodosCount }}/{{ stand.todos.length }} задач</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Color Palette Picker -->
          <div class="flex items-center gap-1">
            @for (color of availableColors; track color) {
              <button
                type="button"
                (click)="colorChange.emit({ standId: stand.id, color })"
                class="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 transition-transform hover:scale-125 focus:scale-125 cursor-pointer"
                [class.ring-2]="stand.color === color"
                [class.ring-primary]="stand.color === color"
                [ngClass]="getColorDotBg(color)"
                [title]="color"
              ></button>
            }
          </div>

          <!-- Delete Stand Button -->
          <button
            type="button"
            (click)="deleteStand.emit(stand.id)"
            class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Удалить стенд проекта"
          >
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </footer>
    </article>
  `,
})
export class ProjectStandCardComponent {
  @Input({ required: true }) stand!: ProjectStand;

  @Output() pinToggle = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{ standId: string; color: LemonCardColor }>();
  @Output() deleteStand = new EventEmitter<string>();
  @Output() pingStand = new EventEmitter<string>();
  @Output() envFilterChange = new EventEmitter<{ standId: string; env: AppEnvironment | 'ALL' }>();
  @Output() openAddApp = new EventEmitter<string>();
  @Output() removeApp = new EventEmitter<{ standId: string; appId: string }>();
  @Output() simulateFailure = new EventEmitter<{ standId: string; appId: string }>();
  @Output() heartbeatApp = new EventEmitter<{ standId: string; appId: string }>();
  @Output() addChronicle = new EventEmitter<{
    standId: string;
    entry: Omit<ProjectSessionLogEntry, 'id' | 'timestamp'>;
  }>();
  @Output() toggleTodo = new EventEmitter<{ standId: string; todoId: string }>();
  @Output() addTodo = new EventEmitter<{
    standId: string;
    item: {
      text: string;
      isReactive: boolean;
      scope?: 'PROJECT' | 'APP';
      targetAppName?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      triggerType?: ReactiveTriggerType;
      triggerDescription?: string;
    };
  }>();
  @Output() deleteTodo = new EventEmitter<{ standId: string; todoId: string }>();

  activeSubTab: StandSubTab = 'APPS';

  showAddLog = false;
  newLogTitle = '';
  newLogType: ChronicleEventType = 'MILESTONE';

  showAddTodo = false;
  newTodoText = '';
  newTodoScope: 'PROJECT' | 'APP' = 'PROJECT';
  newTodoTargetAppName = '';
  newTodoPriority: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';

  readonly availableColors: LemonCardColor[] = [
    'default',
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  get palette() {
    return LEMON_CARD_PALETTES[this.stand.color] || LEMON_CARD_PALETTES.default;
  }

  get pinVariation(): string {
    return this.stand.isPinned ? "'FILL' 1" : "'FILL' 0";
  }

  getPinButtonClass(isPinned: boolean): string {
    return isPinned ? 'opacity-100 text-primary' : 'text-on-surface-variant';
  }

  get filteredApps(): StandAppItem[] {
    if (this.stand.activeEnvironment === 'ALL') {
      return this.stand.apps;
    }
    return this.stand.apps.filter((a) => a.environment === this.stand.activeEnvironment);
  }

  get completedTodosCount(): number {
    return this.stand.todos.filter((t) => t.completed).length;
  }

  get todoPercentage(): number {
    if (this.stand.todos.length === 0) return 0;
    return Math.round((this.completedTodosCount / this.stand.todos.length) * 100);
  }

  countByEnv(env: AppEnvironment): number {
    return this.stand.apps.filter((a) => a.environment === env).length;
  }

  getEnvColor(env: AppEnvironment): string {
    switch (env) {
      case 'production':
        return 'text-rose-600 dark:text-rose-400';
      case 'staging':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-sky-600 dark:text-sky-400';
    }
  }

  getNetworkLabel(mode: AppNetworkMode): string {
    switch (mode) {
      case 'tailscale-funnel':
        return 'Funnel';
      case 'tailscale-lan':
        return 'TS-LAN';
      default:
        return 'Local';
    }
  }

  getHealthBadgeClass(status: StandAppStatus): string {
    switch (status) {
      case 'HEALTHY':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
      case 'DEGRADED':
        return 'bg-amber-500/20 text-amber-800 dark:text-amber-300';
      case 'EVICTED':
        return 'bg-rose-500/20 text-rose-800 dark:text-rose-300';
      default:
        return 'bg-slate-500/15 text-slate-800 dark:text-slate-300';
    }
  }

  getHealthDotClass(status: StandAppStatus): string {
    switch (status) {
      case 'HEALTHY':
        return 'bg-emerald-500 animate-pulse';
      case 'DEGRADED':
        return 'bg-amber-500';
      case 'EVICTED':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  }

  getHealthLabel(app: StandAppItem): string {
    if (app.status === 'EVICTED') {
      return 'EVICTED (5/5)';
    }
    if (app.status === 'DEGRADED') {
      return `DEGRADED (${app.consecutiveFailures}/5)`;
    }
    return `${app.lastLatencyMs}ms`;
  }

  getScopeBadgeClass(scope?: 'PROJECT' | 'APP'): string {
    return scope === 'APP'
      ? 'bg-sky-500/15 text-sky-800 dark:text-sky-300'
      : 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300';
  }

  getPriorityBadgeClass(priority?: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    switch (priority) {
      case 'HIGH':
        return 'bg-rose-500/20 text-rose-800 dark:text-rose-300';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-800 dark:text-amber-300';
      default:
        return 'bg-slate-500/15 text-slate-800 dark:text-slate-300';
    }
  }

  submitLog(): void {
    if (!this.newLogTitle.trim()) return;
    this.addChronicle.emit({
      standId: this.stand.id,
      entry: {
        type: this.newLogType,
        author: 'Developer',
        title: this.newLogTitle.trim(),
        badge: this.newLogType,
      },
    });
    this.newLogTitle = '';
    this.showAddLog = false;
  }

  submitTodo(): void {
    if (!this.newTodoText.trim()) return;
    this.addTodo.emit({
      standId: this.stand.id,
      item: {
        text: this.newTodoText.trim(),
        isReactive: false,
        scope: this.newTodoScope,
        targetAppName: this.newTodoScope === 'APP' ? this.newTodoTargetAppName || this.stand.apps[0]?.appName : undefined,
        priority: this.newTodoPriority,
      },
    });
    this.newTodoText = '';
    this.showAddTodo = false;
  }

  formatTimestamp(iso?: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
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
