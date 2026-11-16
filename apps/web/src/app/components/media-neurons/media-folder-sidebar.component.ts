import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  MediaCombinatorNeuronSummaryView,
  MediaFolderView,
  MediaServiceClientView,
} from '../../core/models/media.models';

@Component({
  selector: 'app-media-folder-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex flex-col gap-4 w-full">
      <!-- FOLDERS TREE -->
      <section class="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-primary">folder_open</span>
            <h2 class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Папки медиа
            </h2>
          </div>
          <button
            type="button"
            (click)="createFolderClick.emit()"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-[11px] font-bold text-on-surface transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">create_new_folder</span>
            <span>+ Папка</span>
          </button>
        </div>

        <div class="flex flex-col gap-1">
          <button
            type="button"
            (click)="folderSelect.emit('all')"
            [class]="folderRowClass(activeFolderPath === 'all')"
          >
            <span class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-rounded text-base">perm_media</span>
              <span class="truncate font-semibold">Все ассеты</span>
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
              {{ totalAssets }}
            </span>
          </button>

          @for (folder of folders; track folder.id) {
            <div class="flex items-center gap-1 group">
              <button
                type="button"
                (click)="folderSelect.emit(folder.path)"
                [class]="folderRowClass(activeFolderPath === folder.path)"
                class="flex-1"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <span class="material-symbols-rounded text-base">{{ folderIcon(folder.icon) }}</span>
                  <span class="truncate font-medium">{{ folder.name }}</span>
                </span>
                <span class="flex items-center gap-1.5 flex-shrink-0">
                  <span [class]="visibilityMiniBadge(folder.defaultVisibility)">
                    {{ folder.defaultVisibility }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                    {{ folder.assetsCount ?? 0 }}
                  </span>
                </span>
              </button>
              @if ((folder.assetsCount ?? 0) === 0) {
                <button
                  type="button"
                  title="Удалить пустую папку"
                  (click)="deleteFolderClick.emit(folder)"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <span class="material-symbols-rounded text-sm">delete</span>
                </button>
              }
            </div>
          } @empty {
            <p class="text-xs text-on-surface-variant py-2 px-2">Папки не найдены</p>
          }
        </div>
      </section>

      <!-- PROJECT CLIENTS (ACL CONSUMERS) -->
      <section class="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-emerald-500">apps</span>
            <h2 class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Проекты-клиенты
            </h2>
          </div>
          <button
            type="button"
            (click)="createClientClick.emit()"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-[11px] font-bold text-on-surface transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">add</span>
            <span>+ Клиент</span>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          @for (client of clients; track client.id) {
            <div class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-on-surface truncate">{{ client.name }}</span>
                <span [class]="clientStatusClass(client.isActive)">
                  {{ client.isActive ? 'ACTIVE' : 'OFF' }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-2 text-[10px] text-on-surface-variant font-mono">
                <span class="truncate">{{ client.slug }}</span>
                <span>{{ client.grantsCount ?? 0 }} grants</span>
              </div>
            </div>
          } @empty {
            <p class="text-xs text-on-surface-variant px-1">
              Нет зарегистрированных клиентов. Добавьте проект для выдачи SCOPED-доступа.
            </p>
          }
        </div>
      </section>

      <!-- CORE COMBINATOR NEURONS BRIDGE -->
      <section class="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-amber-500">hub</span>
            <h2 class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Core Combinator
            </h2>
          </div>
          <button
            type="button"
            [disabled]="syncingNeurons"
            (click)="syncNeuronsClick.emit()"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-[11px] font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-rounded text-sm">sync</span>
            <span>Sync</span>
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          @for (neuron of neurons; track neuron.channel) {
            <div class="px-2.5 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[11px] font-bold text-on-surface truncate">{{ neuron.path }}</div>
                <div class="text-[10px] font-mono text-on-surface-variant truncate">
                  {{ neuron.channel }} · {{ neuron.flowIds.length }} flows
                </div>
              </div>
              <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
            </div>
          } @empty {
            <p class="text-[11px] text-on-surface-variant">
              Нейроны Media Hub ещё не синхронизированы с Core Combinator.
            </p>
          }
        </div>
      </section>
    </aside>
  `,
})
export class MediaFolderSidebarComponent {
  @Input() folders: readonly MediaFolderView[] = [];
  @Input() clients: readonly MediaServiceClientView[] = [];
  @Input() neurons: readonly MediaCombinatorNeuronSummaryView[] = [];
  @Input() activeFolderPath = 'all';
  @Input() totalAssets = 0;
  @Input() syncingNeurons = false;

  @Output() folderSelect = new EventEmitter<string>();
  @Output() createFolderClick = new EventEmitter<void>();
  @Output() deleteFolderClick = new EventEmitter<MediaFolderView>();
  @Output() createClientClick = new EventEmitter<void>();
  @Output() syncNeuronsClick = new EventEmitter<void>();

  folderRowClass(active: boolean): string {
    return active
      ? 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs transition-all cursor-pointer shadow-xs'
      : 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-container text-xs transition-all cursor-pointer';
  }

  visibilityMiniBadge(vis: string): string {
    if (vis === 'PUBLIC') {
      return 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    }
    if (vis === 'SCOPED') {
      return 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400';
    }
    return 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface-container-high text-on-surface-variant';
  }

  clientStatusClass(active: boolean): string {
    return active
      ? 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-error-container text-on-error-container';
  }

  folderIcon(icon?: string | null): string {
    const allowed = new Set([
      'folder',
      'image',
      'movie',
      'audiotrack',
      'description',
      'auto_awesome',
      'event',
      'palette',
      'archive',
      'photo_library',
    ]);
    if (icon && allowed.has(icon)) return icon;
    return 'folder';
  }
}
