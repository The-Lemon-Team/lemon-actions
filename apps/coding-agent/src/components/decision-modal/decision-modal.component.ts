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
  selector: 'app-decision-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-xs"
      appModalOverlay
      (overlayClose)="close()"
      aria-labelledby="decision-modal-title"
    >
      <div
        class="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-5"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span class="material-symbols-rounded text-xl">lightbulb</span>
            </div>
            <div>
              <h2 id="decision-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                Записать Архитектурное Решение
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Фиксация контекста и аргументации в памяти агента
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
          <div>
            <label class="text-xs font-bold text-on-surface block mb-1" for="dec-title-input">
              Заголовок решения:
            </label>
            <input
              id="dec-title-input"
              type="text"
              [ngModel]="title()"
              (ngModelChange)="title.set($event)"
              placeholder="например: Вынесение Core Combinator в отдельное ядро"
              class="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-on-surface block mb-1" for="dec-md-input">
              Аргументация и контекст (Markdown):
            </label>
            <textarea
              id="dec-md-input"
              rows="4"
              [ngModel]="rationale()"
              (ngModelChange)="rationale.set($event)"
              placeholder="Опишите, почему выбрано такое решение и какие альтернативы рассматривались..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
            ></textarea>
          </div>

          <div>
            <label class="text-xs font-bold text-on-surface block mb-1" for="dec-tags-input">
              Теги (через запятую):
            </label>
            <input
              id="dec-tags-input"
              type="text"
              [ngModel]="tagsStr()"
              (ngModelChange)="tagsStr.set($event)"
              placeholder="architecture, core, memory"
              class="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
            />
          </div>
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
            [disabled]="isSubmitting() || !title().trim()"
            class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            @if (isSubmitting()) {
              <span class="material-symbols-rounded text-sm animate-spin">progress_activity</span>
            }
            <span>Сохранить в память</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DecisionModalComponent {
  private readonly facade = inject(CodingAgentFacade);
  @Output() readonly dismissed = new EventEmitter<void>();

  readonly title = signal<string>('');
  readonly rationale = signal<string>('');
  readonly tagsStr = signal<string>('architecture, agent-memory');
  readonly isSubmitting = signal<boolean>(false);

  close(): void {
    this.resetState();
    this.dismissed.emit();
  }

  async submit(): Promise<void> {
    if (!this.title().trim()) return;

    this.isSubmitting.set(true);
    try {
      const tags = this.tagsStr()
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await this.facade.recordDecision(this.title(), this.rationale(), tags);
      this.close();
    } catch {
      // Error handled by toast
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private resetState(): void {
    this.title.set('');
    this.rationale.set('');
    this.tagsStr.set('architecture, agent-memory');
    this.isSubmitting.set(false);
  }
}
