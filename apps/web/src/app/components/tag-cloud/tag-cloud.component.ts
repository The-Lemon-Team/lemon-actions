import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TagWithCount } from '../../core/models/flow.models';

@Component({
  selector: 'app-tag-cloud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="
        layout === 'strip'
          ? 'flex flex-nowrap overflow-x-auto gap-1.5 py-1 px-0.5 no-scrollbar items-center'
          : 'flex flex-wrap gap-1.5'
      "
    >
      @for (tag of tags; track tag.id) {
        <button
          type="button"
          (click)="select.emit(tag.name)"
          [attr.aria-pressed]="tag.isSelected"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-code-sm text-label-code-sm transition-all flex-shrink-0 cursor-pointer select-none border"
          [class]="
            tag.isSelected
              ? 'bg-primary-container text-on-primary-container border-primary/40 shadow-xs font-semibold ring-1 ring-primary/20'
              : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant/30 active:scale-95'
          "
        >
          @if (tag.isSelected) {
            <span class="w-1.5 h-1.5 rounded-full bg-on-primary-container"></span>
          }
          <span>#{{ tag.name }}</span>
          <span class="text-[10px]" [class]="tag.isSelected ? 'opacity-70 font-bold' : 'text-outline'">{{
            tag.flowCount
          }}</span>
        </button>
      }
    </div>
  `,
})
export class TagCloudComponent {
  @Input({ required: true }) tags: TagWithCount[] = [];
  @Input() layout: 'wrap' | 'strip' = 'wrap';
  @Output() select = new EventEmitter<string>();
}
