import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CodeTaskView, FlowEventRecord } from '../../core/models/flow.models';
import { CodeLabService, TaskStatusFilter } from '../../core/services/code-lab.service';
import { ProfileService } from '../../core/services/profile.service';
import { CodeLabModalsComponent } from './code-lab-modals.component';
import { CodeTaskCardComponent } from './code-task-card.component';

@Component({
  selector: 'app-code-lab',
  standalone: true,
  imports: [AsyncPipe, CodeLabModalsComponent, CodeTaskCardComponent],
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
              <span class="font-label-code-sm text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                ltree scope: code.*
              </span>
              <span class="inline-flex items-center gap-1 font-label-code-sm text-[11px] px-2 py-0.5 rounded-full bg-success-container text-on-success-container font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                FS Watcher Active
              </span>
            </div>
            <p class="font-body-sm text-xs text-on-surface-variant mt-1">
              Императивное пространство разработчика. Задачи синхронизируются через контракт <code class="font-label-code-sm">.lemon/tasks.json</code>
              и отчёты тестов <code class="font-label-code-sm">.lemon/results.json</code>.
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="showAddRepoModal.set(true)"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold hover:opacity-95 transition-all shadow-xs self-start lg:self-auto"
        >
          <span class="material-symbols-rounded text-base">create_new_folder</span>
          <span>+ Подключить папку</span>
        </button>
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
        <section class="bg-surface-container-lowest rounded-2xl p-5 border-2 border-primary-container shadow-md relative overflow-hidden">
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

      <!-- Tag Cloud Ribbon -->
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
        </section>
      }

      <!-- Status Tabs & Filter -->
      <section class="flex items-center justify-between border-b border-outline-variant/30 pb-2">
        <div class="flex items-center gap-1 sm:gap-2">
          @for (tab of statusTabs; track tab.id) {
            <button
              type="button"
              (click)="codeLab.setStatusFilter(tab.id)"
              class="px-3 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-all"
              [class]="(codeLab.statusFilter$ | async) === tab.id ? 'bg-primary-container text-on-primary-container shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="font-label-code-sm text-xs text-on-surface-variant">
          Найдено: {{ ((codeLab.filteredTasks$ | async) ?? []).length }}
        </div>
      </section>

      <!-- Task Cards Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        @for (task of (codeLab.filteredTasks$ | async) ?? []; track task.flow.id) {
          <app-code-task-card [task]="task" (logsRequested)="openLogsModal($event)" (historyRequested)="openHistoryModal($event)" />
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
    </div>

    <app-code-lab-modals
      [showAddRepoModal]="showAddRepoModal()"
      [showLogsModal]="showLogsModal()"
      [showHistoryModal]="showHistoryModal()"
      [selectedTask]="selectedTask()"
      [historyEvents]="historyEvents()"
      [loadingHistory]="loadingHistory()"
      (closeAddRepoModal)="showAddRepoModal.set(false)"
      (closeLogsModal)="showLogsModal.set(false)"
      (closeHistoryModal)="showHistoryModal.set(false)"
    />
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

  readonly statusTabs: { id: TaskStatusFilter; label: string }[] = [
    { id: 'ALL', label: 'Все задачи' },
    { id: 'ACTIVE', label: 'В фокусе' },
    { id: 'PASSED', label: 'Выполненные' },
    { id: 'FAILED', label: 'Ошибки тестов' },
    { id: 'STUB', label: 'Заготовки' },
  ];

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
}
