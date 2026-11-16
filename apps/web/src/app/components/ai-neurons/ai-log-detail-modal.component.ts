import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { AiRequestLogView } from '../../core/models/ai.models';

@Component({
  selector: 'app-ai-log-detail-modal',
  standalone: true,
  imports: [ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (log; as entry) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="closeModal.emit()"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        aria-labelledby="ai-log-detail-title"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-3xl max-h-[88vh] rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col"
        >
          <!-- HEADER -->
          <div class="flex items-center justify-between gap-3 px-6 py-4 border-b border-outline-variant/20">
            <div class="min-w-0 flex items-center gap-2.5 flex-wrap">
              <span class="px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container font-mono text-[11px] font-bold">
                {{ entry.taskType }}
              </span>
              <h2 id="ai-log-detail-title" class="font-headline-sm text-base font-bold text-on-surface truncate">
                {{ entry.provider }} · {{ entry.model }}
              </h2>
              <span [class]="statusBadgeClass(entry.status)">
                {{ entry.status }}
              </span>
            </div>
            <button
              type="button"
              (click)="closeModal.emit()"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex-shrink-0"
            >
              <span class="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          <!-- BODY -->
          <div class="p-6 overflow-y-auto flex flex-col gap-4 text-xs">
            <!-- META ROW -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div class="rounded-xl bg-surface-container-low border border-outline-variant/20 p-2.5">
                <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Клиент</div>
                <div class="font-mono font-bold text-on-surface mt-0.5 truncate">{{ entry.clientSlug }}</div>
              </div>
              <div class="rounded-xl bg-surface-container-low border border-outline-variant/20 p-2.5">
                <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Латентность</div>
                <div class="font-mono font-bold text-on-surface mt-0.5">{{ entry.latencyMs }} ms</div>
              </div>
              <div class="rounded-xl bg-surface-container-low border border-outline-variant/20 p-2.5">
                <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Токены</div>
                <div class="font-mono font-bold text-on-surface mt-0.5">
                  {{ entry.totalTokens ?? '—' }}
                  @if (entry.inputTokens || entry.outputTokens) {
                    <span class="text-[10px] opacity-70">({{ entry.inputTokens ?? 0 }}/{{ entry.outputTokens ?? 0 }})</span>
                  }
                </div>
              </div>
              <div class="rounded-xl bg-surface-container-low border border-outline-variant/20 p-2.5">
                <div class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Дата</div>
                <div class="font-mono text-[11px] text-on-surface mt-0.5 truncate">{{ formatDate(entry.createdAt) }}</div>
              </div>
            </div>

            @if (entry.errorMessage) {
              <div class="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-red-600 dark:text-red-400 font-mono text-[11px]">
                {{ entry.errorMessage }}
              </div>
            }

            <!-- MEDIA ASSETS GALLERY -->
            @if (entry.mediaAssetIds.length > 0) {
              <div class="flex flex-col gap-2">
                <div class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Связанные медиа-ассеты ({{ entry.mediaAssetIds.length }})
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  @for (assetId of entry.mediaAssetIds; track assetId) {
                    <div class="rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low flex flex-col">
                      <img
                        [src]="mediaFullUrlBuilder(assetId)"
                        [alt]="assetId"
                        class="w-full h-28 object-cover bg-surface-container"
                      />
                      <div class="p-2 flex items-center justify-between gap-1">
                        <span class="font-mono text-[10px] text-on-surface-variant truncate">{{ assetId }}</span>
                        <button
                          type="button"
                          (click)="remixAsset.emit(assetId)"
                          class="px-2 py-0.5 rounded-lg bg-primary-container text-on-primary-container text-[10px] font-bold cursor-pointer flex-shrink-0"
                        >
                          Remix
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- INPUT PAYLOAD -->
            <div class="flex flex-col gap-1.5">
              <div class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Входной запрос (Input Payload)
              </div>
              <pre class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3 font-mono text-[11px] text-on-surface overflow-x-auto whitespace-pre-wrap break-words">{{ formatJson(entry.inputPayload) }}</pre>
            </div>

            <!-- OUTPUT PAYLOAD -->
            @if (entry.outputPayload) {
              <div class="flex flex-col gap-1.5">
                <div class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Сгенерированный результат (Output Payload)
                </div>
                <pre class="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-3 font-mono text-[11px] text-on-surface overflow-x-auto whitespace-pre-wrap break-words">{{ formatJson(entry.outputPayload) }}</pre>
              </div>
            }
          </div>

          <!-- FOOTER -->
          <div class="flex items-center justify-between gap-2 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low">
            <span class="font-mono text-[10px] text-on-surface-variant truncate">ID: {{ entry.id }}</span>
            <button
              type="button"
              (click)="closeModal.emit()"
              class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AiLogDetailModalComponent {
  @Input() log: AiRequestLogView | null = null;
  @Input() mediaFullUrlBuilder: (assetId: string) => string = (id) => `/api/media/assets/${id}/file/full`;

  @Output() closeModal = new EventEmitter<void>();
  @Output() remixAsset = new EventEmitter<string>();

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      case 'FALLBACK':
        return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'FAILED':
        return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-600 dark:text-red-400';
      default:
        return 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container text-on-surface-variant';
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU');
  }

  formatJson(val: unknown): string {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
}
