import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TagWithCount } from '../../core/models/flow.models';

@Component({
  selector: 'app-tag-cloud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-1.5">
      @for (tag of tags; track tag.id) {
        <button
          type="button"
          (click)="select.emit(tag.name)"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-code-sm text-label-code-sm transition-colors"
          [class]="
            tag.isSelected
              ? 'bg-primary-container text-on-primary-container shadow-sm active:scale-95'
              : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          "
        >
          @if (tag.isSelected) {
            <span class="w-1.5 h-1.5 rounded-full bg-on-primary-container"></span>
          }
          <span>#{{ tag.name }}</span>
          <span class="text-[10px]" [class]="tag.isSelected ? 'opacity-60' : 'text-outline'">{{ tag.flowCount }}</span>
        </button>
      }
    </div>
  `,
})
export class TagCloudComponent {
  @Input({ required: true }) tags: TagWithCount[] = [];
  @Output() select = new EventEmitter<string>();
}
