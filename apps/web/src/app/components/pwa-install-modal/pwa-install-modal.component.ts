import { ChangeDetectionStrategy, Component, Input, output, signal } from '@angular/core';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-pwa-install-modal',
  standalone: true,
  imports: [ModalOverlayDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      appModalOverlay
      [appModalOverlayDismissable]="true"
      (overlayClose)="onClose()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        (click)="$event.stopPropagation()"
        class="w-full max-w-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xl overflow-hidden"
      >
        <div class="flex items-start justify-between gap-3 px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-rounded text-xl">{{ appIcon }}</span>
            </div>
            <div>
              <h2 id="pwa-install-modal-title" class="font-title-md text-title-md text-on-surface font-bold">
                {{ appTitle }} — {{ 'pwa.modalTitle' | trans }}
              </h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {{ 'pwa.modalSubtitle' | trans }}
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="onClose()"
            [attr.aria-label]="'pwa.closeAria' | trans"
            class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-xl">close</span>
          </button>
        </div>

        <div class="px-6 py-5 space-y-4">
          <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2.5">
            <div class="flex items-center gap-2 text-on-surface font-label-ui text-xs font-bold uppercase tracking-wider">
              <span class="material-symbols-rounded text-base text-primary">install_desktop</span>
              <span>{{ 'pwa.quickMethodTitle' | trans }}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <span class="font-semibold">Chrome:</span> {{ 'pwa.quickMethodChrome' | trans }}
            </p>
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              <span class="font-semibold text-on-surface">Edge:</span> {{ 'pwa.quickMethodEdge' | trans }}
            </p>
          </div>

          @if (!isSecureContext && originUrl) {
            <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2.5">
              <div class="flex items-center gap-2 text-on-surface font-label-ui text-xs font-bold">
                <span class="material-symbols-rounded text-base text-tertiary">lan</span>
                <span>{{ 'pwa.lanTipTitle' | trans }}</span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {{ 'pwa.lanTipDesc' | trans }}
              </p>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <code class="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-code-sm text-xs">
                  {{ flagsUrl }}
                </code>
                <button
                  type="button"
                  (click)="copyText(flagsUrl, 'flag')"
                  class="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-on-surface font-label-ui text-xs font-semibold transition-colors"
                >
                  {{ copiedTarget() === 'flag' ? ('pwa.copied' | trans) : ('pwa.copyFlag' | trans) }}
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <code class="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-code-sm text-xs">
                  {{ originUrl }}
                </code>
                <button
                  type="button"
                  (click)="copyText(originUrl, 'origin')"
                  class="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-on-surface font-label-ui text-xs font-semibold transition-colors"
                >
                  {{ copiedTarget() === 'origin' ? ('pwa.copied' | trans) : ('pwa.copyUrl' | trans) }}
                </button>
              </div>
            </div>
          }
        </div>

        <div class="px-6 py-3.5 border-t border-outline-variant/20 bg-surface-container-low flex justify-end">
          <button
            type="button"
            (click)="onClose()"
            class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold transition-colors"
          >
            {{ 'pwa.closeBtn' | trans }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PwaInstallModalComponent {
  @Input() appTitle = 'Lemon Actions';
  @Input() appIcon = 'install_desktop';
  @Input() originUrl = '';
  @Input() isSecureContext = false;

  readonly closed = output<void>();
  readonly copiedTarget = signal<'flag' | 'origin' | null>(null);
  readonly flagsUrl = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

  onClose(): void {
    this.copiedTarget.set(null);
    this.closed.emit();
  }

  copyText(text: string, target: 'flag' | 'origin'): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    this.copiedTarget.set(target);
  }
}
