import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FlowType } from '../../core/models/flow.models';

/** Context-aware actions: "Manage" for FSM/Mutex flows, Play/Pause for the rest. */
@Component({
  selector: 'app-flow-action-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-end gap-1.5">
      @if (usesManage) {
        <button
          type="button"
          title="Manage flow"
          (click)="manage.emit()"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-ui text-label-ui transition-colors"
        >
          <span>Manage</span>
          <span class="material-symbols-rounded text-sm">tune</span>
        </button>
      } @else {
        <button
          type="button"
          [title]="isActive ? 'Pause flow' : 'Start flow'"
          (click)="toggle.emit()"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-ui text-label-ui transition-colors"
        >
          <span>{{ isActive ? 'Pause' : 'Start' }}</span>
          <span class="material-symbols-rounded text-sm">{{ isActive ? 'pause' : 'play_arrow' }}</span>
        </button>
      }
      <button
        type="button"
        title="More options"
        class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <span class="material-symbols-rounded text-base">more_vert</span>
      </button>
    </div>
  `,
})
export class FlowActionButtonsComponent {
  usesManage = false;

  @Input({ required: true }) set type(value: FlowType) {
    this.usesManage = value === FlowType.FSM || value === FlowType.MUTEX;
  }
  @Input() isActive = false;
  @Output() manage = new EventEmitter<void>();
  @Output() toggle = new EventEmitter<void>();
}
