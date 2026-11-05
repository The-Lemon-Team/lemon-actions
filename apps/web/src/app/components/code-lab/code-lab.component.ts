import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CodeRepoView,
  CodeTaskView,
  FlowEventRecord,
} from '../../core/models/flow.models';
import { CodeLabService, TaskStatusFilter } from '../../core/services/code-lab.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-code-lab',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      <!-- Top Header & Scope Bar -->
      <section
        class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md"
      >
        <div class="flex items-start sm:items-center gap-space-md">
          <div
            class="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 shadow-xs"
          >
            <span class="material-symbols-rounded text-2xl" style="font-variation-settings: 'FILL' 1">terminal</span>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="font-headline-sm text-lg font-bold text-on-surface">
                Lemon Code Lab · Лаборатория Задач
              </h1>
              <span
                class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold"
              >
                ltree scope: code.*
              </span>
              <span
                class="inline-flex items-center gap-1 font-label-code-sm text-[11px] px-2 py-0.5 rounded-full bg-success-container text-on-success-container font-semibold"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                FS Watcher Active
              </span>
            </div>
            <p class="font-body-sm text-xs text-on-surface-variant mt-1">
              Императивное пространство разработчика. Задачи синхронизируются через контракт <code class="font-label-code-sm">.lemon/tasks.json</code>
              и отчёты тестов <code class="font-label-code-sm">.lemon/results.json</code> без запуска недоверенного кода в браузере.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="showAddRepoModal.set(true)"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-95 transition-all shadow-xs"
          >
            <span class="material-symbols-rounded text-base">create_new_folder</span>
            <span>+ Подключить папку</span>
          </button>
        </div>
      </section>

      <!-- KPI Summary Cards -->
      @if (codeLab.metrics$ | async; as m) {
        <section class="grid grid-cols-2 sm:grid-cols-5 gap-space-sm">
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20">
            <span class="font-label-ui text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">Всего задач</span>
            <div class="mt-1 font-display-lg text-2xl font-bold text-on-surface">{{ m.total }}</div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20">
            <span class="font-label-ui text-[11px] uppercase tracking-wider text-primary font-bold">В фокусе</span>
            <div class="mt-1 font-display-lg text-2xl font-bold text-primary flex items-center gap-1">
              <span>{{ m.active }}</span>
              @if (m.active > 0) {
                <span class="material-symbols-rounded text-base animate-spin text-primary">progress_activity</span>
              }
            </div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20">
            <span class="font-label-ui text-[11px] uppercase tracking-wider text-success font-bold">Выполнено</span>
            <div class="mt-1 font-display-lg text-2xl font-bold text-success">{{ m.passed }}</div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20">
            <span class="font-label-ui text-[11px] uppercase tracking-wider text-error font-bold">Ошибки тестов</span>
            <div class="mt-1 font-display-lg text-2xl font-bold text-error">{{ m.failed }}</div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20 col-span-2 sm:col-span-1">
            <span class="font-label-ui text-[11px] uppercase tracking-wider text-outline font-bold">Заготовки / Stub</span>
            <div class="mt-1 font-display-lg text-2xl font-bold text-on-surface-variant">{{ m.stub }}</div>
          </div>
        </section>
      }

      <!-- Spotlight: Active Task in Focus -->
      @if (codeLab.activeTask$ | async; as activeTask) {
        <section class="bg-surface-container-lowest rounded-2xl p- space-md p-5 border-2 border-primary-container shadow-md relative overflow-hidden">
          <div class="absolute top-0 right-0 px-3 py-1 bg-primary-container text-on-primary-container font-label-code-sm text-[11px] font-bold rounded-bl-xl flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>СЕССИЯ АКТИВНА · MUTEX LOCKED</span>
          </div>

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded font-label-code-sm text-[10px] font-bold bg-primary text-on-primary uppercase">
                  {{ activeTask.meta.difficulty || 'Medium' }}
                </span>
                <span class="font-label-code-sm text-xs text-on-surface-variant">
                  {{ activeTask.repoName || 'Репозиторий' }}
                </span>
              </div>
              <h2 class="font-headline-sm text-xl font-bold text-on-surface mt-1">
                {{ activeTask.flow.name }}
              </h2>
              <p class="font-body-sm text-sm text-on-surface-variant mt-1 max-w-3xl">
                {{ activeTask.flow.description }}
              </p>
              <div class="flex flex-wrap items-center gap-1.5 mt-3">
                @for (t of activeTask.tags; track t) {
                  <span class="font-label-code-sm text-xs px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                    {{ t }}
                  </span>
                }
              </div>
            </div>

            <div class="flex flex-row md:flex-col items-end gap-2 flex-shrink-0">
              <button
                type="button"
                (click)="codeLab.pauseTask(activeTask.flow.id)"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5"
              >
                <span class="material-symbols-rounded text-base">pause</span>
                <span>Приостановить сессию</span>
              </button>
              <button
                type="button"
                (click)="openLogsModal(activeTask)"
                class="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-ui text-xs font-semibold transition-all inline-flex items-center gap-1.5"
              >
                <span class="material-symbols-rounded text-base">terminal</span>
                <span>Логи тестов</span>
              </button>
            </div>
          </div>

          <!-- Active Task Test Status Bar -->
          <div class="mt-4 pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-rounded text-base" [class]="activeTask.isPassed ? 'text-success' : activeTask.isFailed ? 'text-error' : 'text-outline'">
                  {{ activeTask.isPassed ? 'check_circle' : activeTask.isFailed ? 'error' : 'hourglass_empty' }}
                </span>
                <span class="font-label-code-sm text-xs font-bold text-on-surface">
                  @if (activeTask.isPassed) {
                    Все тесты пройдены ({{ activeTask.meta.testsPassed }}/{{ activeTask.meta.testsTotal }})
                  } @else if (activeTask.isFailed) {
                    Тесты не проходят ({{ activeTask.meta.testsPassed }}/{{ activeTask.meta.testsTotal }} пройдено, {{ activeTask.meta.testsFailed }} ошибок)
                  } @else {
                    Тесты ещё не запускались (Заготовка)
                  }
                </span>
              </div>
              @if (activeTask.meta.durationMs) {
                <span class="font-label-code-sm text-[11px] text-on-surface-variant">
                  · {{ activeTask.meta.durationMs }}ms
                </span>
              }
            </div>

            @if (activeTask.meta.testSuite) {
              <div class="font-label-code-sm text-[11px] text-on-surface-variant truncate max-w-xs" title="Файл тестов">
                📄 {{ activeTask.meta.testSuite }}
              </div>
            }
          </div>
        </section>
      }

      <!-- Repositories Bar -->
      <section class="bg-surface-container-lowest rounded-xl p-3 shadow-xs border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 overflow-x-auto py-1">
          <span class="font-label-ui text-xs text-on-surface-variant font-bold uppercase tracking-wider flex-shrink-0">
            Репозитории:
          </span>
          <button
            type="button"
            (click)="codeLab.selectRepo(null)"
            class="px-2.5 py-1 rounded-lg font-label-ui text-xs font-semibold transition-all flex-shrink-0"
            [class]="(codeLab.selectedRepoId$ | async) === null ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'"
          >
            Все
          </button>
          @for (repo of (codeLab.repos$ | async) ?? []; track repo.id) {
            <div class="inline-flex items-center gap-1 bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/20 flex-shrink-0">
              <button
                type="button"
                (click)="codeLab.selectRepo(repo.id)"
                class="px-2 py-0.5 rounded font-label-ui text-xs font-medium transition-all"
                [class]="(codeLab.selectedRepoId$ | async) === repo.id ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span>{{ repo.name }}</span>
                <span class="ml-1 opacity-75 font-label-code-sm text-[10px]">({{ repo.tasksCount }})</span>
              </button>
              <button
                type="button"
                (click)="codeLab.syncRepo(repo.id)"
                title="Синхронизировать .lemon/*.json"
                class="p-1 rounded text-outline hover:text-primary transition-colors"
              >
                <span class="material-symbols-rounded text-sm">sync</span>
              </button>
              <button
                type="button"
                (click)="codeLab.unregisterRepo(repo.id)"
                title="Отключить репозиторий"
                class="p-1 rounded text-outline hover:text-error transition-colors"
              >
                <span class="material-symbols-rounded text-sm">close</span>
              </button>
            </div>
          }
        </div>

        <button
          type="button"
          (click)="codeLab.refreshAll().subscribe()"
          title="Обновить состояние"
          class="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors flex-shrink-0"
        >
          <span class="material-symbols-rounded text-base">refresh</span>
        </button>
      </section>

      <!-- Tag Cloud Ribbon (#js, #tauri, #vite, #rest, etc.) -->
      @if ((codeLab.tagCloud$ | async)?.length) {
        <section class="flex flex-wrap items-center gap-1.5">
          <span class="font-label-ui text-xs text-on-surface-variant font-bold uppercase tracking-wider mr-1">
            Теги:
          </span>
          @for (tagItem of (codeLab.tagCloud$ | async) ?? []; track tagItem.name) {
            <button
              type="button"
              (click)="codeLab.selectTag(tagItem.name)"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-code-sm text-xs transition-all border"
              [class]="
                (codeLab.selectedTag$ | async) === tagItem.name
                  ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
              "
            >
              <span>{{ tagItem.name }}</span>
              <span class="text-[10px] opacity-75">({{ tagItem.count }})</span>
            </button>
          }
          @if (codeLab.selectedTag$ | async) {
            <button
              type="button"
              (click)="codeLab.selectTag(null)"
              class="font-label-ui text-xs text-outline hover:text-error transition-colors ml-1"
            >
              Сбросить фильтр
            </button>
          }
        </section>
      }

      <!-- Status Tabs & Filter -->
      <section class="flex items-center justify-between border-b border-outline-variant/30 pb-2">
        <div class="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            (click)="codeLab.setStatusFilter('ALL')"
            class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
            [class]="(codeLab.statusFilter$ | async) === 'ALL' ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            Все задачи
          </button>
          <button
            type="button"
            (click)="codeLab.setStatusFilter('ACTIVE')"
            class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
            [class]="(codeLab.statusFilter$ | async) === 'ACTIVE' ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            В фокусе
          </button>
          <button
            type="button"
            (click)="codeLab.setStatusFilter('PASSED')"
            class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
            [class]="(codeLab.statusFilter$ | async) === 'PASSED' ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            Выполненные
          </button>
          <button
            type="button"
            (click)="codeLab.setStatusFilter('FAILED')"
            class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
            [class]="(codeLab.statusFilter$ | async) === 'FAILED' ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            Ошибки тестов
          </button>
          <button
            type="button"
            (click)="codeLab.setStatusFilter('STUB')"
            class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
            [class]="(codeLab.statusFilter$ | async) === 'STUB' ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
          >
            Заготовки
          </button>
        </div>

        <div class="font-label-code-sm text-xs text-on-surface-variant">
          Найдено: {{ ((codeLab.filteredTasks$ | async) ?? []).length }}
        </div>
      </section>

      <!-- Task Cards Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        @for (task of (codeLab.filteredTasks$ | async) ?? []; track task.flow.id) {
          <div
            class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all flex flex-col justify-between"
            [class]="
              task.isActive
                ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                : task.isPassed
                ? 'border-success/30 hover:border-success/60'
                : task.isFailed
                ? 'border-error/30 hover:border-error/60'
                : 'border-outline-variant/30 hover:border-outline'
            "
          >
            <div>
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 rounded font-label-code-sm text-[10px] font-bold uppercase tracking-wider"
                    [class]="
                      task.meta.difficulty === 'easy'
                        ? 'bg-success-container text-on-success-container'
                        : task.meta.difficulty === 'hard'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-primary-container text-on-primary-container'
                    "
                  >
                    {{ task.meta.difficulty || 'medium' }}
                  </span>
                  @if (task.repoName) {
                    <span class="font-label-code-sm text-[11px] text-on-surface-variant truncate max-w-[150px]">
                      {{ task.repoName }}
                    </span>
                  }
                </div>

                <div class="flex items-center gap-1">
                  @if (task.isActive) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-code-sm text-[10px] font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      ACTIVE
                    </span>
                  } @else if (task.isPassed) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-container text-on-success-container font-label-code-sm text-[10px] font-bold">
                      <span class="material-symbols-rounded text-xs">done_all</span>
                      PASSED
                    </span>
                  } @else if (task.isFailed) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-code-sm text-[10px] font-bold">
                      <span class="material-symbols-rounded text-xs">close</span>
                      FAILED
                    </span>
                  } @else {
                    <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                      STUB
                    </span>
                  }
                </div>
              </div>

              <!-- Title & Description -->
              <h3 class="font-headline-sm text-base font-bold text-on-surface mt-2.5">
                {{ task.flow.name }}
              </h3>
              <p class="font-body-sm text-xs text-on-surface-variant mt-1.5 line-clamp-3">
                {{ task.flow.description }}
              </p>

              <!-- Tags -->
              <div class="flex flex-wrap items-center gap-1 mt-3">
                @for (tag of task.tags; track tag) {
                  <span
                    (click)="codeLab.selectTag(tag)"
                    class="font-label-code-sm text-[11px] px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    {{ tag }}
                  </span>
                }
              </div>
            </div>

            <!-- Card Bottom & Actions -->
            <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 font-label-code-sm text-[11px] text-on-surface-variant">
                @if (task.meta.testsTotal && task.meta.testsTotal > 0) {
                  <span [class]="task.isPassed ? 'text-success font-semibold' : task.isFailed ? 'text-error font-semibold' : ''">
                    {{ task.meta.testsPassed }}/{{ task.meta.testsTotal }} тестов
                  </span>
                  @if (task.meta.durationMs) {
                    <span>· {{ task.meta.durationMs }}ms</span>
                  }
                } @else {
                  <span>Тесты не запущены</span>
                }
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="openLogsModal(task)"
                  title="Посмотреть логи тестов"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <span class="material-symbols-rounded text-base">terminal</span>
                </button>
                <button
                  type="button"
                  (click)="openHistoryModal(task)"
                  title="История событий и сессий"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <span class="material-symbols-rounded text-base">history</span>
                </button>

                @if (task.isActive) {
                  <button
                    type="button"
                    (click)="codeLab.pauseTask(task.flow.id)"
                    class="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-ui text-xs font-bold hover:bg-surface-container-highest transition-colors inline-flex items-center gap-1"
                  >
                    <span class="material-symbols-rounded text-xs">pause</span>
                    <span>Пауза</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="codeLab.startTask(task.flow.id)"
                    class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-1 shadow-xs"
                  >
                    <span class="material-symbols-rounded text-xs">play_arrow</span>
                    <span>В работу</span>
                  </button>
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="col-span-full p-12 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
            <span class="material-symbols-rounded text-4xl text-outline mb-2">code_off</span>
            <h4 class="font-headline-sm text-base font-bold text-on-surface">Задачи не найдены</h4>
            <p class="font-body-sm text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
              Попробуйте сбросить фильтры по тегам или подключите локальную папку с задачами через Менеджер.
            </p>
          </div>
        }
      </section>

      <!-- Modal: Подключить репозиторий задач -->
      @if (showAddRepoModal()) {
        <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-lg shadow-xl border border-outline-variant/30 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="font-headline-sm text-lg font-bold text-on-surface">Подключить папку с задачами</h3>
              <button type="button" (click)="showAddRepoModal.set(false)" class="p-1 rounded-lg hover:bg-surface-container">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <p class="font-body-sm text-xs text-on-surface-variant">
              Укажите абсолютный или относительный путь к локальному каталогу с задачами. Внутри папки должна находиться конфигурация
              <code class="font-label-code-sm">.lemon/tasks.json</code>.
            </p>

            <div class="flex flex-col gap-3">
              <div>
                <label class="font-label-ui text-xs font-bold text-on-surface block mb-1">Путь к каталогу</label>
                <input
                  type="text"
                  [(ngModel)]="newRepoPath"
                  placeholder="Например: ./examples/challenges-demo или C:/projects/my-tasks"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 font-label-code-sm text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label class="font-label-ui text-xs font-bold text-on-surface block mb-1">Название репозитория (опционально)</label>
                <input
                  type="text"
                  [(ngModel)]="newRepoName"
                  placeholder="Например: Frontend & Tauri Challenges"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 font-body-sm text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label class="font-label-ui text-xs font-bold text-on-surface block mb-1">Теги по умолчанию (через запятую)</label>
                <input
                  type="text"
                  [(ngModel)]="newRepoTags"
                  placeholder="#js, #tauri, #vite, #rest"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 font-label-code-sm text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <div class="font-label-ui text-xs font-bold text-on-surface">Быстрый старт: демо-набор</div>
                  <div class="font-label-code-sm text-[11px] text-on-surface-variant">./examples/challenges-demo</div>
                </div>
                <button
                  type="button"
                  (click)="setDemoRepoPath()"
                  class="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container text-on-surface font-label-ui text-xs font-semibold transition-colors"
                >
                  Использовать
                </button>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="showAddRepoModal.set(false)"
                class="px-4 py-2 rounded-xl font-label-ui text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                Отмена
              </button>
              <button
                type="button"
                (click)="submitAddRepo()"
                [disabled]="!newRepoPath.trim()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                Подключить
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Логи выполнения тестов -->
      @if (showLogsModal()) {
        <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-2xl max-h-[85vh] shadow-xl border border-outline-variant/30 flex flex-col gap-4 overflow-hidden">
            <div class="flex items-center justify-between flex-shrink-0">
              <div>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">
                  Логи тестов: {{ selectedTask()?.flow?.name }}
                </h3>
                <span class="font-label-code-sm text-[11px] text-on-surface-variant">
                  {{ selectedTask()?.meta?.testSuite || 'Спецификация тестов' }}
                </span>
              </div>
              <button type="button" (click)="showLogsModal.set(false)" class="p-1 rounded-lg hover:bg-surface-container">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <div class="overflow-y-auto flex flex-col gap-3 pr-1">
              <div class="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-rounded text-lg" [class]="selectedTask()?.isPassed ? 'text-success' : selectedTask()?.isFailed ? 'text-error' : 'text-outline'">
                    {{ selectedTask()?.isPassed ? 'check_circle' : selectedTask()?.isFailed ? 'error' : 'hourglass_empty' }}
                  </span>
                  <span class="font-label-ui text-xs font-bold text-on-surface">
                    Статус раннера: {{ selectedTask()?.meta?.status }}
                  </span>
                </div>
                <div class="font-label-code-sm text-xs text-on-surface-variant">
                  Пройдено: {{ selectedTask()?.meta?.testsPassed }}/{{ selectedTask()?.meta?.testsTotal }} · {{ selectedTask()?.meta?.durationMs }}ms
                </div>
              </div>

              @if (selectedTask()?.meta?.lastLogs?.length) {
                <div class="flex flex-col gap-2">
                  <span class="font-label-ui text-xs font-bold text-error uppercase tracking-wider">
                    Ошибки выполнения ({{ selectedTask()?.meta?.lastLogs?.length }}):
                  </span>
                  @for (log of selectedTask()?.meta?.lastLogs ?? []; track log.test) {
                    <div class="p-3 rounded-xl bg-error-container/15 border border-error-container/40 flex flex-col gap-1.5">
                      <div class="font-label-code-sm text-xs font-bold text-error flex items-center gap-1.5">
                        <span class="material-symbols-rounded text-sm">close</span>
                        <span>{{ log.test }}</span>
                      </div>
                      @if (log.error) {
                        <div class="font-label-code-sm text-[11px] text-on-surface bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 overflow-x-auto">
                          {{ log.error }}
                        </div>
                      }
                      @if (log.stack) {
                        <pre class="font-label-code-sm text-[10px] text-outline overflow-x-auto whitespace-pre-wrap">{{ log.stack }}</pre>
                      }
                    </div>
                  }
                </div>
              } @else if (selectedTask()?.isPassed) {
                <div class="p-8 text-center text-success flex flex-col items-center">
                  <span class="material-symbols-rounded text-4xl mb-1">verified</span>
                  <span class="font-headline-sm text-sm font-bold">Все тесты успешно пройдены!</span>
                  <span class="font-body-sm text-xs text-on-surface-variant mt-1">
                    Спецификация полностью реализована, ошибок не обнаружено.
                  </span>
                </div>
              } @else {
                <div class="p-8 text-center text-on-surface-variant">
                  Запустите тесты в вашем IDE/терминале (например, npm test), чтобы отчёт сохранился в .lemon/results.json.
                </div>
              }
            </div>

            <div class="flex justify-end pt-2 border-t border-outline-variant/20 flex-shrink-0">
              <button
                type="button"
                (click)="showLogsModal.set(false)"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Хроника задачи -->
      @if (showHistoryModal()) {
        <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-xl max-h-[85vh] shadow-xl border border-outline-variant/30 flex flex-col gap-4 overflow-hidden">
            <div class="flex items-center justify-between flex-shrink-0">
              <div>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">
                  Хроника: {{ selectedTask()?.flow?.name }}
                </h3>
                <span class="font-label-code-sm text-[11px] text-on-surface-variant">
                  Непрерывная летопись сессий и событий в шине Core Combinator
                </span>
              </div>
              <button type="button" (click)="showHistoryModal.set(false)" class="p-1 rounded-lg hover:bg-surface-container">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <div class="overflow-y-auto flex flex-col gap-3 pr-1">
              @if (loadingHistory()) {
                <div class="p-8 text-center text-on-surface-variant font-body-sm text-xs">
                  Загрузка хроники событий...
                </div>
              } @else {
                @for (ev of historyEvents(); track ev.id) {
                  <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                    <span class="material-symbols-rounded text-base text-primary mt-0.5">
                      {{ ev.eventType === 'TASK_COMPLETED' || ev.eventType === 'TESTS_PASSED' ? 'task_alt' : ev.eventType === 'TESTS_FAILED' ? 'error' : 'history' }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-label-code-sm text-xs font-bold text-on-surface">
                          {{ ev.eventType }}
                        </span>
                        <span class="font-label-code-sm text-[10px] text-on-surface-variant">
                          {{ ev.createdAt | date: 'dd.MM.yy HH:mm:ss' }}
                        </span>
                      </div>
                      <div class="font-body-sm text-xs text-on-surface-variant mt-1">
                        {{ getEventSummary(ev) }}
                      </div>
                      @if (ev.activeFlowSessionIds.length) {
                        <div class="mt-1 font-label-code-sm text-[10px] text-outline">
                          Слепок открытых сессий: {{ ev.activeFlowSessionIds.length }}
                        </div>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="p-8 text-center text-on-surface-variant font-body-sm text-xs">
                    Событий пока не зафиксировано.
                  </div>
                }
              }
            </div>

            <div class="flex justify-end pt-2 border-t border-outline-variant/20 flex-shrink-0">
              <button
                type="button"
                (click)="showHistoryModal.set(false)"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CodeLabComponent {
  readonly codeLab = inject(CodeLabService);
  readonly profileService = inject(ProfileService);

  readonly showAddRepoModal = signal(false);
  readonly showLogsModal = signal(false);
  readonly showHistoryModal = signal(false);

  readonly selectedTask = signal<CodeTaskView | null>(null);
  readonly historyEvents = signal<FlowEventRecord[]>([]);
  readonly loadingHistory = signal(false);

  newRepoPath = '';
  newRepoName = '';
  newRepoTags = '#js, #tauri, #vite, #rest';

  setDemoRepoPath(): void {
    this.newRepoPath = './examples/challenges-demo';
    this.newRepoName = 'Starter Challenges (JS/Tauri/Vite/REST)';
    this.newRepoTags = '#js, #tauri, #vite, #rest';
  }

  submitAddRepo(): void {
    if (!this.newRepoPath.trim()) return;

    const tags = this.newRepoTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    this.codeLab
      .registerRepo({
        localPath: this.newRepoPath.trim(),
        name: this.newRepoName.trim() || undefined,
        defaultTags: tags.length > 0 ? tags : undefined,
      })
      .subscribe({
        next: () => {
          this.showAddRepoModal.set(false);
          this.newRepoPath = '';
          this.newRepoName = '';
        },
      });
  }

  openLogsModal(task: CodeTaskView): void {
    this.selectedTask.set(task);
    this.showLogsModal.set(true);
  }

  openHistoryModal(task: CodeTaskView): void {
    this.selectedTask.set(task);
    this.loadingHistory.set(true);
    this.historyEvents.set([]);
    this.showHistoryModal.set(true);

    this.codeLab.getTaskEvents(task.flow.id).subscribe({
      next: (events) => {
        this.historyEvents.set(events);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.loadingHistory.set(false);
      },
    });
  }

  getEventSummary(ev: FlowEventRecord): string {
    const p = (ev.payload ?? {}) as any;
    if (p.note) return p.note;
    if (p.action === 'all_tests_passed') return `Все тесты успешно пройдены за ${p.durationMs || 0}ms!`;
    if (p.action === 'tests_failing') return `Падение тестов: ${p.failedCount || 1} ошибок обнаружено.`;
    if (p.action === 'focus_started') return 'Разработчик начал решение задачи.';
    if (p.action === 'focus_paused') return 'Сессия решения приостановлена.';
    if (p.taskId) return `Обнаружена задача ${p.taskId} (slug: ${p.slug}).`;
    return JSON.stringify(p);
  }
}
