import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FolderNode } from '../../core/models/flow.models';

const FOLDER_ICONS: Record<string, string> = {
  workspace: 'folder',
  infrastructure: 'dns',
  focus_modes: 'psychology',
  event_hooks: 'bolt',
  archival: 'archive',
};

/** Recursive tree rendered from the flat ltree-based folder list. */
@Component({
  selector: 'app-folder-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-0.5">
      @for (node of nodes; track node.id) {
        <div class="flex flex-col">
          <div
            class="relative rounded-lg overflow-hidden flex items-center"
            [class]="node.isSelected ? 'bg-surface-container-high/60' : 'hover:bg-surface-container-low'"
            [style.padding-left.rem]="node.depth * 1.25"
          >
            @if (node.isSelected) {
              <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary-container"></div>
            }
            <button
              type="button"
              class="p-1 flex items-center"
              [class.invisible]="!node.children.length"
              [attr.aria-label]="node.isExpanded ? 'Collapse ' + node.name : 'Expand ' + node.name"
              (click)="toggle.emit(node.id)"
            >
              <span
                class="material-symbols-rounded text-sm text-on-surface-variant transition-transform duration-150"
                [class.rotate-90]="node.isExpanded"
                >chevron_right</span
              >
            </button>
            <button
              type="button"
              class="flex-1 min-w-0 flex items-center justify-between gap-2 pr-2.5 py-1.5 text-left"
              [class]="node.isSelected ? 'text-on-surface font-semibold' : 'text-on-surface-variant hover:text-on-surface'"
              (click)="select.emit(node.id)"
            >
              <span class="flex items-center gap-2 min-w-0">
                @if (node.depth === 0) {
                  <span
                    class="material-symbols-rounded text-base"
                    [class]="node.isSelected ? 'text-secondary' : ''"
                    [style.font-variation-settings]="node.isSelected ? &quot;'FILL' 1&quot; : null"
                    >{{ icon(node) }}</span
                  >
                }
                <span class="truncate" [class]="node.depth === 0 ? 'font-body-md text-body-md' : 'font-body-sm text-body-sm'">{{
                  node.name
                }}</span>
              </span>
              <span
                class="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded"
                [class]="node.isSelected ? 'bg-primary-container text-on-primary-container font-semibold' : 'bg-surface-container-high text-on-surface-variant'"
                >{{ node.flowCount }}</span
              >
            </button>
          </div>
          @if (node.isExpanded && node.children.length) {
            <app-folder-tree [nodes]="node.children" (select)="select.emit($event)" (toggle)="toggle.emit($event)" />
          }
        </div>
      }
    </div>
  `,
})
export class FolderTreeComponent {
  @Input({ required: true }) nodes: FolderNode[] = [];
  @Output() select = new EventEmitter<string>();
  @Output() toggle = new EventEmitter<string>();

  icon(node: FolderNode): string {
    return FOLDER_ICONS[node.path] ?? 'folder';
  }
}
