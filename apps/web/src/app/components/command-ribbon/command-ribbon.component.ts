import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FolderNode } from '../../core/models/flow.models';

const FOLDER_ICONS: Record<string, string> = {
  workspace: 'folder',
  infrastructure: 'dns',
  focus_modes: 'psychology',
  event_hooks: 'bolt',
  archival: 'archive',
};

@Component({
  selector: 'app-command-ribbon',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/30 flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class="material-symbols-rounded text-base text-primary">tune</span>
          <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold"
            >{{ 'commandRibbon.title' | trans }}</span
          >
        </div>
        <button
          type="button"
          (click)="showCreateModal = !showCreateModal"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-code-sm text-xs bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors"
        >
          <span class="material-symbols-rounded text-sm">add</span>
          <span>{{ 'commandRibbon.newFolder' | trans }}</span>
        </button>
      </div>

      <!-- Horizontal Ribbon of Folder Chips -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 select-none">
        <!-- ALL FLOWS CHIP -->
        <button
          type="button"
          (click)="select.emit(null)"
          class="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full font-label-ui text-xs transition-all active:scale-95"
          [class]="
            selectedFolderId === null
              ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
              : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          "
        >
          <span class="material-symbols-rounded text-sm">layers</span>
          <span>{{ 'commandRibbon.allFlows' | trans }}</span>
          <span
            class="font-label-code-sm text-[11px] px-1.5 py-0.2 rounded-full"
            [class]="selectedFolderId === null ? 'bg-on-primary-container/20 text-on-primary-container' : 'bg-surface-container text-on-surface-variant'"
            >{{ totalCount }}</span
          >
        </button>

        <!-- ROOT FOLDERS -->
        @for (node of folderNodes; track node.id) {
          <div class="relative flex-shrink-0 flex items-center">
            <div
              class="flex items-center rounded-full transition-all border"
              [class]="
                isNodeOrChildSelected(node)
                  ? 'bg-primary-container text-on-primary-container border-primary/20 shadow-xs'
                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-transparent'
              "
            >
              <!-- Primary Chip Click: Selects Folder -->
              <button
                type="button"
                (click)="select.emit(node.id); activeDropdownId = null"
                class="flex items-center gap-1.5 pl-3 pr-2 py-1.5 font-label-ui text-xs"
              >
                @if (node.hasActiveFlow) {
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                }
                <span class="material-symbols-rounded text-sm">{{ icon(node) }}</span>
                <span class="font-medium whitespace-nowrap">{{ i18n.translateFolder(node.name) }}</span>
                <span
                  class="font-label-code-sm text-[10px] px-1.5 py-0.5 rounded-full"
                  [class]="isNodeOrChildSelected(node) ? 'bg-on-primary-container/20 text-on-primary-container font-bold' : 'bg-surface-container text-on-surface-variant'"
                  >{{ node.flowCount }}</span
                >
              </button>

              <!-- Dropdown Trigger for Folders with Subfolders -->
              @if (node.children.length) {
                <button
                  type="button"
                  [attr.aria-label]="i18n.t('commandRibbon.toggleSubfolders', { name: i18n.translateFolder(node.name) })"
                  (click)="$event.stopPropagation(); toggleDropdown(node.id)"
                  class="pr-2 pl-0.5 py-1.5 flex items-center hover:opacity-75"
                >
                  <span
                    class="material-symbols-rounded text-sm transition-transform"
                    [class.rotate-180]="activeDropdownId === node.id"
                    >expand_more</span
                  >
                </button>
              }
            </div>

            <!-- Subfolders Floating Menu -->
            @if (activeDropdownId === node.id && node.children.length) {
              <div
                class="absolute left-0 top-full mt-1.5 z-40 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/40 p-1.5 min-w-[210px] flex flex-col gap-1 backdrop-blur-md"
              >
                <div class="px-2 py-1 text-[11px] font-label-ui uppercase tracking-wider text-on-surface-variant/70 border-b border-outline-variant/20">
                  {{ 'commandRibbon.subDomainsOf' | trans: { name: i18n.translateFolder(node.name) } }}
                </div>
                <button
                  type="button"
                  (click)="select.emit(node.id); activeDropdownId = null"
                  class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-label-ui hover:bg-surface-container-low transition-colors"
                  [class]="selectedFolderId === node.id ? 'bg-primary-container/20 text-primary font-bold' : 'text-on-surface'"
                >
                  <span class="flex items-center gap-1.5">
                    <span class="material-symbols-rounded text-sm">folder_open</span>
                    <span>{{ 'commandRibbon.allIn' | trans: { name: i18n.translateFolder(node.name) } }}</span>
                  </span>
                  <span class="font-label-code-sm text-[10px] text-on-surface-variant">{{ node.flowCount }}</span>
                </button>

                @for (child of node.children; track child.id) {
                  <button
                    type="button"
                    (click)="select.emit(child.id); activeDropdownId = null"
                    class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-label-ui hover:bg-surface-container-low transition-colors"
                    [class]="selectedFolderId === child.id ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface'"
                  >
                    <span class="flex items-center gap-1.5 min-w-0">
                      @if (child.hasActiveFlow) {
                        <span class="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0"></span>
                      }
                      <span class="truncate">{{ i18n.translateFolder(child.name) }}</span>
                    </span>
                    <span
                      class="font-label-code-sm text-[10px] px-1.5 py-0.5 rounded"
                      [class]="selectedFolderId === child.id ? 'bg-on-primary-container/20 text-on-primary-container' : 'bg-surface-container text-on-surface-variant'"
                      >{{ child.flowCount }}</span
                    >
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Quick Inline Creator Form -->
      @if (showCreateModal) {
        <div class="mt-2 pt-2 border-t border-outline-variant/30 flex flex-wrap items-center gap-2">
          <input
            #folderNameInput
            type="text"
            [(ngModel)]="newFolderName"
            (keydown.enter)="submitCreate()"
            [placeholder]="'commandRibbon.newFolderPlaceholder' | trans"
            class="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
          <select
            [(ngModel)]="newParentId"
            class="px-2.5 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-label-ui focus:outline-none focus:ring-2 focus:ring-primary-container"
          >
            <option [ngValue]="null">{{ 'commandRibbon.rootNoParent' | trans }}</option>
            @for (folder of folderNodes; track folder.id) {
              <option [ngValue]="folder.id">{{ 'commandRibbon.inFolder' | trans: { name: i18n.translateFolder(folder.name) } }}</option>
            }
          </select>
          <button
            type="button"
            (click)="submitCreate()"
            [disabled]="!newFolderName.trim()"
            class="px-3 py-1.5 rounded-lg bg-primary-container hover:bg-primary-fixed-dim disabled:opacity-50 text-on-primary-container font-label-ui text-xs font-bold transition-all"
          >
            {{ 'commandRibbon.saveFolder' | trans }}
          </button>
          <button
            type="button"
            (click)="showCreateModal = false"
            class="px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-ui text-xs"
          >
            {{ 'commandRibbon.cancel' | trans }}
          </button>
        </div>
      }
    </div>
  `,
})
export class CommandRibbonComponent {
  private readonly hostRef = inject(ElementRef);
  protected readonly i18n = inject(I18nService);

  @Input({ required: true }) folderNodes: FolderNode[] = [];
  @Input() selectedFolderId: string | null = null;
  @Input() totalCount = 0;

  @Output() select = new EventEmitter<string | null>();
  @Output() create = new EventEmitter<{ name: string; parentId?: string | null }>();

  activeDropdownId: string | null = null;
  showCreateModal = false;
  newFolderName = '';
  newParentId: string | null = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.hostRef.nativeElement.contains(event.target)) {
      this.activeDropdownId = null;
    }
  }

  icon(node: FolderNode): string {
    return FOLDER_ICONS[node.path] ?? 'folder';
  }

  toggleDropdown(id: string): void {
    this.activeDropdownId = this.activeDropdownId === id ? null : id;
  }

  isNodeOrChildSelected(node: FolderNode): boolean {
    if (this.selectedFolderId === node.id) return true;
    return node.children.some((c) => c.id === this.selectedFolderId);
  }

  submitCreate(): void {
    if (!this.newFolderName.trim()) return;
    this.create.emit({
      name: this.newFolderName.trim(),
      parentId: this.newParentId,
    });
    this.newFolderName = '';
    this.newParentId = null;
    this.showCreateModal = false;
  }
}
