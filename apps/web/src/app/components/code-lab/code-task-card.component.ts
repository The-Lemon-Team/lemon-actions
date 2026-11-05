import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CodeTaskView } from '../../core/models/flow.models';
import { CodeLabService } from '../../core/services/code-lab.service';

@Component({
  selector: 'app-code-task-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
                ACTIVE
              </span>
            } @else if (task.isPassed) {
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-container text-on-success-container font-label-code-sm text-[10px] font-bold">
                PASSED
              </span>
            } @else if (task.isFailed) {
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-code-sm text-[10px] font-bold">
                FAILED
              </span>
            } @else {
              <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                STUB
              </span>
            }
          </div>
        </div>

        <h3 class="font-headline-sm text-base font-bold text-on-surface mt-2.5">
          {{ task.flow.name }}
        </h3>
        <p class="font-body-sm text-xs text-on-surface-variant mt-1.5 line-clamp-3">
          {{ task.flow.description }}
        </p>

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

      <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 font-label-code-sm text-[11px] text-on-surface-variant">
          @if (task.meta.testsTotal && task.meta.testsTotal > 0) {
            <span [class]="task.isPassed ? 'text-success font-semibold' : task.isFailed ? 'text-error font-semibold' : ''">
              {{ task.meta.testsPassed }}/{{ task.meta.testsTotal }} тестов
            </span>
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
  `,
})
export class CodeTaskCardComponent {
  protected readonly codeLab = inject(CodeLabService);

  @Input({ required: true }) task!: CodeTaskView;
  @Output() readonly logsRequested = new EventEmitter<CodeTaskView>();
  @Output() readonly historyRequested = new EventEmitter<CodeTaskView>();

  openLogsModal(task: CodeTaskView): void {
    this.logsRequested.emit(task);
  }

  openHistoryModal(task: CodeTaskView): void {
    this.historyRequested.emit(task);
  }
}
