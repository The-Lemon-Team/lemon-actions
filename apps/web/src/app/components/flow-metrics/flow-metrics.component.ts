import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FlowMetrics } from '../../core/models/flow.models';

@Component({
  selector: 'app-flow-metrics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-surface-container-lowest rounded-lg px-3 py-2 shadow-xs flex items-center justify-between">
        <div class="flex flex-col">
          <span class="font-label-ui text-[11px] text-on-surface-variant">Registered</span>
          <span class="font-headline-sm text-sm text-on-surface font-semibold">{{ metrics.registered }} Flows</span>
        </div>
        <div class="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-rounded text-sm">account_tree</span>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-lg px-3 py-2 shadow-xs flex items-center justify-between">
        <div class="flex flex-col">
          <span class="font-label-ui text-[11px] text-on-surface-variant">Executing</span>
          <div class="flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/70 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span class="font-headline-sm text-sm text-on-surface font-semibold">{{ metrics.executing }} Active</span>
          </div>
        </div>
        <div class="w-7 h-7 rounded-md bg-success-container text-on-success-container flex items-center justify-center">
          <span class="material-symbols-rounded text-sm">play_circle</span>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-lg px-3 py-2 shadow-xs flex items-center justify-between">
        <div class="flex flex-col">
          <span class="font-label-ui text-[11px] text-on-surface-variant">Paused</span>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-warning"></span>
            <span class="font-headline-sm text-sm text-on-surface font-semibold">{{ metrics.paused }} Paused</span>
          </div>
        </div>
        <div class="w-7 h-7 rounded-md bg-warning-container text-on-warning-container flex items-center justify-center">
          <span class="material-symbols-rounded text-sm">pause_circle</span>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-lg px-3 py-2 shadow-xs flex items-center justify-between">
        <div class="flex flex-col">
          <span class="font-label-ui text-[11px] text-on-surface-variant">Standby</span>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
            <span class="font-headline-sm text-sm text-on-surface font-semibold">{{ metrics.standby }} Idle</span>
          </div>
        </div>
        <div class="w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-tertiary">
          <span class="material-symbols-rounded text-sm">radio_button_checked</span>
        </div>
      </div>
    </div>
  `,
})
export class FlowMetricsComponent {
  @Input({ required: true }) metrics!: FlowMetrics;
}
