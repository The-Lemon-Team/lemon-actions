import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FlowRowState } from '../../core/models/flow.models';
import { FlowRowComponent, FsmTransitionEvent } from '../flow-row/flow-row.component';

@Component({
  selector: 'app-flow-table',
  standalone: true,
  imports: [FlowRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr class="bg-surface-container-low/75 text-on-surface-variant font-label-ui text-xs uppercase tracking-wider select-none border-b border-outline-variant/20">
              <th class="py-3 px-3 w-10">
                <input type="checkbox" aria-label="Select all flows" class="rounded accent-primary-container cursor-pointer w-4 h-4" />
              </th>
              <th class="py-3 px-3">Flow Channel &amp; Purpose</th>
              <th class="py-3 px-3">Architecture &amp; Concurrency</th>
              <th class="py-3 px-3">Telemetry &amp; Live Triggers</th>
              <th class="py-3 px-3">Taxonomy</th>
              <th class="py-3 px-4 text-right">Power / Switch</th>
            </tr>
          </thead>
          <tbody class="font-body-sm text-body-sm">
            @for (row of rows; track row.flow.id; let odd = $odd) {
              <tr
                app-flow-row
                [state]="row"
                [class]="odd ? 'bg-surface-container-low/20' : ''"
                (toggle)="toggle.emit($event)"
                (manage)="manage.emit($event)"
                (fsmTransition)="fsmTransition.emit($event)"
              ></tr>
            } @empty {
              <tr>
                <td colspan="6" class="py-12 text-center text-on-surface-variant font-body-md">
                  <div class="flex flex-col items-center gap-2">
                    <span class="material-symbols-rounded text-3xl opacity-40">filter_alt_off</span>
                    <span>No flow channels match the current filter or folder.</span>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between px-4 py-3 font-label-code-sm text-xs text-on-surface-variant border-t border-outline-variant/20 bg-surface-container-low/30">
        <div class="flex items-center gap-2">
          <span>
            Active View: <span class="font-semibold text-on-surface">{{ rows.length ? '1-' + rows.length : '0' }}</span>
            of {{ total }} channels
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            <span>Running</span>
          </span>
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-warning"></span>
            <span>Paused / Mutex</span>
          </span>
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>Standby</span>
          </span>
        </div>
      </div>
    </div>
  `,
})
export class FlowTableComponent {
  @Input({ required: true }) rows: FlowRowState[] = [];
  @Input() total = 0;
  @Output() toggle = new EventEmitter<string>();
  @Output() manage = new EventEmitter<string>();
  @Output() fsmTransition = new EventEmitter<FsmTransitionEvent>();
}
