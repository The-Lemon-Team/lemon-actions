import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FlowRowState } from '../../core/models/flow.models';
import { FlowRowComponent, FsmTransitionEvent } from '../flow-row/flow-row.component';

@Component({
  selector: 'app-flow-table',
  standalone: true,
  imports: [FlowRowComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr class="bg-surface-container-low/75 text-on-surface-variant font-label-ui text-xs uppercase tracking-wider select-none border-b border-outline-variant/20">
              <th class="py-3 px-3 w-10">
                <input
                  type="checkbox"
                  [attr.aria-label]="'table.selectAllAria' | trans"
                  class="rounded accent-primary-container cursor-pointer w-4 h-4"
                />
              </th>
              <th class="py-3 px-3">{{ 'table.colFlow' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colArchitecture' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colTelemetry' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colTaxonomy' | trans }}</th>
              <th class="py-3 px-4 text-right">{{ 'table.colPower' | trans }}</th>
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
                    <span>{{ 'table.emptyMessage' | trans }}</span>
                    <button
                      type="button"
                      (click)="createChannel.emit()"
                      class="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-ui text-xs font-semibold border border-outline-variant/30 transition-all"
                    >
                      <span class="material-symbols-rounded text-sm">add</span>
                      <span>{{ 'dashboard.createFlowChannel' | trans }}</span>
                    </button>
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
            {{ 'table.activeView' | trans: { current: (rows.length ? '1-' + rows.length : '0'), total: total } }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            <span>{{ 'table.legendRunning' | trans }}</span>
          </span>
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-warning"></span>
            <span>{{ 'table.legendPaused' | trans }}</span>
          </span>
          <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>{{ 'table.legendStandby' | trans }}</span>
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
  @Output() createChannel = new EventEmitter<void>();
}
