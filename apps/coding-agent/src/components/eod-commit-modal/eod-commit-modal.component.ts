import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { CodingAgentFacade } from '../../core/services/coding-agent-facade.service';

@Component({
  selector: 'app-eod-commit-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-xs"
      appModalOverlay
      (overlayClose)="close()"
      aria-labelledby="eod-modal-title"
    >
      <div
        class="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-5"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <span class="material-symbols-rounded text-xl">fact_check</span>
            </div>
            <div>
              <h2 id="eod-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                Коммит в конце дня (EOD Commit)
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Фиксация среза выполненных задач и отправка выжимки
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="close()"
            class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
            aria-label="Закрыть"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-xs font-bold text-on-surface" for="commit-msg-input">
            Сообщение коммита / Название среза:
          </label>
          <input
            id="commit-msg-input"
            type="text"
            [ngModel]="commitMessage()"
            (ngModelChange)="commitMessage.set($event)"
            placeholder="например: Daily milestone: completed challenges and refactored core"
            class="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary"
          />

          <p class="text-[11px] text-on-surface-variant">
            При фиксации среза система соберет все решенные задачи, тесты и архитектурные решения за сегодня,
            сформирует компактный Markdown-отчет и отправит его в долговременную память агента.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            (click)="close()"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            Отмена
          </button>

          <button
            type="button"
            (click)="submit()"
            [disabled]="isSubmitting()"
            class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            @if (isSubmitting()) {
              <span class="material-symbols-rounded text-sm animate-spin">progress_activity</span>
            }
            <span>Зафиксировать коммит</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class EodCommitModalComponent {
  private readonly facade = inject(CodingAgentFacade);
  @Output() readonly dismissed = new EventEmitter<void>();

  readonly commitMessage = signal<string>('End-of-day digest snapshot & milestone sync');
  readonly isSubmitting = signal<boolean>(false);

  close(): void {
    this.resetState();
    this.dismissed.emit();
  }

  async submit(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      await this.facade.commitEndOfDayDigest(this.commitMessage());
      this.close();
    } catch {
      // Error handled by facade toast
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private resetState(): void {
    this.commitMessage.set('End-of-day digest snapshot & milestone sync');
    this.isSubmitting.set(false);
  }
}
