import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AiRequestLogView,
  AiRequestStatus,
  AiTaskType,
} from '../../core/models/ai.models';

export interface AiHistoryFilterChange {
  taskType: AiTaskType | '';
  status: AiRequestStatus | '';
  search: string;
}

@Component({
  selector: 'app-ai-history-list',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 flex flex-col gap-4 shadow-xs">
      <!-- HEADER & FILTERS -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-rounded text-lg text-amber-500">history</span>
          <h2 class="font-headline-sm text-base font-bold text-on-surface">
            Сгенерированный контент и история ({{ total }})
          </h2>
        </div>

        <div class="flex items-center gap-2 flex-wrap text-xs">
          <input
            type="text"
            [ngModel]="searchText"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Поиск по промпту, ответу, модели..."
            class="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface w-56 focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <select
            [ngModel]="activeTaskType"
            (ngModelChange)="onTaskTypeChange($event)"
            class="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface"
          >
            <option value="">Все типы задач</option>
            <option value="TEXT_GENERATE">TEXT_GENERATE</option>
            <option value="NOTE_GENERATE">NOTE_GENERATE</option>
            <option value="QUICK_ADD_PARSE">QUICK_ADD_PARSE</option>
            <option value="IMAGE_GENERATE">IMAGE_GENERATE</option>
            <option value="IMAGE_REMIX">IMAGE_REMIX</option>
            <option value="VISION_ANALYZE">VISION_ANALYZE</option>
          </select>

          <select
            [ngModel]="activeStatus"
            (ngModelChange)="onStatusChange($event)"
            class="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface"
          >
            <option value="">Любой статус</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FALLBACK">FALLBACK</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      <!-- ITEMS LIST -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        @for (item of items; track item.id) {
          <article
            (click)="selectLog.emit(item)"
            class="rounded-2xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 p-4 flex flex-col gap-2.5 transition-all cursor-pointer"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-2 py-0.5 rounded-lg bg-primary-container text-on-primary-container font-mono text-[10px] font-bold">
                  {{ item.taskType }}
                </span>
                <span [class]="statusBadgeClass(item.status)">
                  {{ item.status }}
                </span>
                <span class="font-mono text-[10px] text-on-surface-variant">
                  {{ item.clientSlug }}
                </span>
              </div>
              <span class="font-mono text-[10px] text-on-surface-variant">
                {{ formatTime(item.createdAt) }}
              </span>
            </div>

            <!-- PROMPT / INPUT PREVIEW -->
            <div class="text-xs font-semibold text-on-surface line-clamp-2">
              {{ extractPromptPreview(item) }}
            </div>

            <!-- GENERATED TEXT OR MEDIA THUMBNAILS -->
            @if (item.mediaAssetIds.length > 0) {
              <div class="flex items-center gap-2 overflow-x-auto pb-1">
                @for (assetId of item.mediaAssetIds.slice(0, 4); track assetId) {
                  <img
                    [src]="mediaThumbUrlBuilder(assetId)"
                    [alt]="assetId"
                    class="w-16 h-16 rounded-xl object-cover border border-outline-variant/30 bg-surface-container flex-shrink-0"
                  />
                }
              </div>
            }

            @if (extractOutputPreview(item); as outText) {
              <p class="text-[11px] text-on-surface-variant line-clamp-3 whitespace-pre-wrap">
                {{ outText }}
              </p>
            }

            @if (item.errorMessage) {
              <p class="text-[11px] text-red-600 dark:text-red-400 font-mono line-clamp-2">
                {{ item.errorMessage }}
              </p>
            }

            <div class="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/15 text-[10px] font-mono text-on-surface-variant">
              <span>{{ item.provider }} · {{ item.model }}</span>
              <span>
                {{ item.latencyMs }}ms
                @if (item.totalTokens) {
                  · {{ item.totalTokens }} tok
                }
              </span>
            </div>
          </article>
        } @empty {
          <div class="md:col-span-2 rounded-2xl border border-dashed border-outline-variant/40 p-8 text-center text-xs text-on-surface-variant">
            @if (isLoading) {
              Загрузка истории генераций...
            } @else {
              Записей пока нет. Сгенерируйте текст, заметку или изображение в студии выше.
            }
          </div>
        }
      </div>

      @if (hasMore) {
        <div class="flex justify-center pt-1">
          <button
            type="button"
            [disabled]="isLoading"
            (click)="loadMoreClick.emit()"
            class="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
          >
            {{ isLoading ? 'Загрузка...' : 'Загрузить ещё' }}
          </button>
        </div>
      }
    </section>
  `,
})
export class AiHistoryListComponent {
  @Input() items: AiRequestLogView[] = [];
  @Input() total = 0;
  @Input() hasMore = false;
  @Input() isLoading = false;
  @Input() activeTaskType: AiTaskType | '' = '';
  @Input() activeStatus: AiRequestStatus | '' = '';
  @Input() searchText = '';
  @Input() mediaThumbUrlBuilder: (assetId: string) => string = (id) => `/api/media/assets/${id}/file/thumb`;

  @Output() filterChange = new EventEmitter<AiHistoryFilterChange>();
  @Output() loadMoreClick = new EventEmitter<void>();
  @Output() selectLog = new EventEmitter<AiRequestLogView>();

  onTaskTypeChange(taskType: AiTaskType | ''): void {
    this.filterChange.emit({
      taskType,
      status: this.activeStatus,
      search: this.searchText,
    });
  }

  onStatusChange(status: AiRequestStatus | ''): void {
    this.filterChange.emit({
      taskType: this.activeTaskType,
      status,
      search: this.searchText,
    });
  }

  onSearchChange(search: string): void {
    this.filterChange.emit({
      taskType: this.activeTaskType,
      status: this.activeStatus,
      search,
    });
  }

  statusBadgeClass(status: AiRequestStatus): string {
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

  extractPromptPreview(item: AiRequestLogView): string {
    const inp = item.inputPayload || {};
    return (
      inp['prompt'] ||
      inp['topic'] ||
      inp['title'] ||
      inp['rawText'] ||
      inp['instruction'] ||
      inp['sourceAssetId'] ||
      item.id
    );
  }

  extractOutputPreview(item: AiRequestLogView): string {
    const out = item.outputPayload;
    if (!out) return '';
    if (typeof out['text'] === 'string') return out['text'];
    if (typeof out['content'] === 'string') return `${out['title'] ? `${out['title']}: ` : ''}${out['content']}`;
    if (typeof out['description'] === 'string') return out['description'];
    if (typeof out['synthesizedPrompt'] === 'string') return out['synthesizedPrompt'];
    if (typeof out['remixPrompt'] === 'string') return out['remixPrompt'];
    return '';
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
