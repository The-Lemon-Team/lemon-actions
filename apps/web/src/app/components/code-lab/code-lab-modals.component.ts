import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeTaskView, FlowEventRecord } from '../../core/models/flow.models';
import { CodeLabService } from '../../core/services/code-lab.service';

@Component({
  selector: 'app-code-lab-modals',
  standalone: true,
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Modal: Подключить репозиторий задач -->
    @if (showAddRepoModal) {
      <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-lg shadow-xl border border-outline-variant/30 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-lg font-bold text-on-surface">Подключить папку с задачами</h3>
            <button type="button" (click)="closeAddRepoModal.emit()" class="p-1 rounded-lg hover:bg-surface-container">
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
              (click)="closeAddRepoModal.emit()"
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
    @if (showLogsModal) {
      <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-2xl max-h-[85vh] shadow-xl border border-outline-variant/30 flex flex-col gap-4 overflow-hidden">
          <div class="flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="font-headline-sm text-base font-bold text-on-surface">
                Логи тестов: {{ selectedTask?.flow?.name }}
              </h3>
              <span class="font-label-code-sm text-[11px] text-on-surface-variant">
                {{ selectedTask?.meta?.testSuite || 'Спецификация тестов' }}
              </span>
            </div>
            <button type="button" (click)="closeLogsModal.emit()" class="p-1 rounded-lg hover:bg-surface-container">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="overflow-y-auto flex flex-col gap-3 pr-1">
            <div class="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-lg" [class]="selectedTask?.isPassed ? 'text-success' : selectedTask?.isFailed ? 'text-error' : 'text-outline'">
                  {{ selectedTask?.isPassed ? 'check_circle' : selectedTask?.isFailed ? 'error' : 'hourglass_empty' }}
                </span>
                <span class="font-label-ui text-xs font-bold text-on-surface">
                  Статус раннера: {{ selectedTask?.meta?.status }}
                </span>
              </div>
              <div class="font-label-code-sm text-xs text-on-surface-variant">
                Пройдено: {{ selectedTask?.meta?.testsPassed }}/{{ selectedTask?.meta?.testsTotal }} · {{ selectedTask?.meta?.durationMs }}ms
              </div>
            </div>

            @if (selectedTask?.meta?.lastLogs?.length) {
              <div class="flex flex-col gap-2">
                <span class="font-label-ui text-xs font-bold text-error uppercase tracking-wider">
                  Ошибки выполнения ({{ selectedTask?.meta?.lastLogs?.length }}):
                </span>
                @for (log of selectedTask?.meta?.lastLogs ?? []; track log.test) {
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
            } @else if (selectedTask?.isPassed) {
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
              (click)="closeLogsModal.emit()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Хроника задачи -->
    @if (showHistoryModal) {
      <div class="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-xl max-h-[85vh] shadow-xl border border-outline-variant/30 flex flex-col gap-4 overflow-hidden">
          <div class="flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="font-headline-sm text-base font-bold text-on-surface">
                Хроника: {{ selectedTask?.flow?.name }}
              </h3>
              <span class="font-label-code-sm text-[11px] text-on-surface-variant">
                Непрерывная летопись сессий и событий в шине Core Combinator
              </span>
            </div>
            <button type="button" (click)="closeHistoryModal.emit()" class="p-1 rounded-lg hover:bg-surface-container">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="overflow-y-auto flex flex-col gap-3 pr-1">
            @if (loadingHistory) {
              <div class="p-8 text-center text-on-surface-variant font-body-sm text-xs">
                Загрузка хроники событий...
              </div>
            } @else {
              @for (ev of historyEvents; track ev.id) {
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
              (click)="closeHistoryModal.emit()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CodeLabModalsComponent {
  private readonly codeLab = inject(CodeLabService);

  @Input() showAddRepoModal = false;
  @Input() showLogsModal = false;
  @Input() showHistoryModal = false;
  @Input() selectedTask: CodeTaskView | null = null;
  @Input() historyEvents: FlowEventRecord[] = [];
  @Input() loadingHistory = false;

  @Output() readonly closeAddRepoModal = new EventEmitter<void>();
  @Output() readonly closeLogsModal = new EventEmitter<void>();
  @Output() readonly closeHistoryModal = new EventEmitter<void>();

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
          this.newRepoPath = '';
          this.newRepoName = '';
          this.closeAddRepoModal.emit();
        },
      });
  }

  getEventSummary(ev: FlowEventRecord): string {
    const p = (ev.payload ?? {}) as Record<string, any>;
    if (p['note']) return p['note'];
    if (p['action'] === 'all_tests_passed') return `Все тесты успешно пройдены за ${p['durationMs'] || 0}ms!`;
    if (p['action'] === 'tests_failing') return `Падение тестов: ${p['failedCount'] || 1} ошибок обнаружено.`;
    if (p['action'] === 'focus_started') return 'Разработчик начал решение задачи.';
    if (p['action'] === 'focus_paused') return 'Сессия решения приостановлена.';
    if (p['taskId']) return `Обнаружена задача ${p['taskId']} (slug: ${p['slug']}).`;
    return JSON.stringify(p);
  }
}
