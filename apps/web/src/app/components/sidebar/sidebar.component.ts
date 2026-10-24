import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Flow, TagWithCount } from '../../core/models/flow.models';
import { TagCloudComponent } from '../tag-cloud/tag-cloud.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [TagCloudComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex flex-col gap-space-md">
      <!-- Workspace Switcher -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30">
        <div class="flex items-center justify-between gap-space-sm cursor-pointer select-none group">
          <div class="flex items-center gap-space-sm min-w-0">
            <div
              class="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0 text-on-surface"
            >
              <span class="material-symbols-rounded text-lg" style="font-variation-settings: 'FILL' 1">lan</span>
            </div>
            <div class="min-w-0 flex flex-col">
              <span class="font-headline-sm text-sm text-on-surface truncate tracking-tight font-bold">{{
                workspaceName
              }}</span>
              <div class="flex items-center gap-1.5 pt-0.5">
                <span class="relative flex h-2 w-2">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/70 opacity-75"
                  ></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span class="font-label-code-sm text-xs text-on-surface-variant">{{ activeFlows }} Channels Active</span>
              </div>
            </div>
          </div>
          <span
            class="material-symbols-rounded text-on-surface-variant group-hover:text-on-surface transition-colors text-base"
            >unfold_more</span
          >
        </div>
      </div>

      <!-- System Concurrency & Mutex Guard Status Card -->
      <div
        class="rounded-xl p-space-md shadow-sm border transition-all"
        [class]="
          isMutexLocked
            ? 'bg-warning/10 border-warning/40 shadow-[0_0_12px_rgb(var(--c-warning)/0.15)]'
            : 'bg-surface-container-lowest border-outline-variant/30'
        "
      >
        <div class="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div class="flex items-center gap-1.5">
            <span
              class="material-symbols-rounded text-base"
              [class]="isMutexLocked ? 'text-warning animate-pulse' : 'text-success'"
            >
              {{ isMutexLocked ? 'lock' : 'verified_user' }}
            </span>
            <span class="font-label-ui text-xs uppercase tracking-wider font-bold text-on-surface">
              {{ isMutexLocked ? 'Mutex Lock Engaged' : 'System Guard: Clear' }}
            </span>
          </div>
          <span
            class="font-label-code-sm text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            [class]="isMutexLocked ? 'bg-warning text-on-warning' : 'bg-success-container text-on-success-container'"
          >
            {{ isMutexLocked ? 'LOCKED' : 'READY' }}
          </span>
        </div>

        <div class="pt-2.5 flex flex-col gap-1.5 font-body-sm text-xs">
          @if (isMutexLocked) {
            <p class="text-on-surface font-medium leading-relaxed">
              Exclusive flow holding system lock:
            </p>
            @for (lock of activeLocks; track lock.id) {
              <div
                class="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container text-on-surface font-label-code-sm text-xs"
              >
                <span class="material-symbols-rounded text-xs text-warning">lock</span>
                <span class="font-bold truncate">{{ lock.name }}</span>
              </div>
            }
            <p class="text-on-surface-variant text-[11px] leading-tight">
              Dependent context tasks &amp; cards are queued or paused per orchestrator rules.
            </p>
          } @else {
            <p class="text-on-surface-variant leading-relaxed">
              No concurrency conflicts. All parallel channels are unblocked and accepting triggers.
            </p>
          }
        </div>
      </div>

      <!-- Tags & Labels Section -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
        <div class="flex items-center justify-between px-space-xs pb-space-xs">
          <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold"
            >Taxonomy Filters</span
          >
          <span class="font-label-code-sm text-[11px] text-outline">{{ tags.length }} tags</span>
        </div>
        <app-tag-cloud [tags]="tags" (select)="tagSelect.emit($event)" />
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  @Input() workspaceName = 'Acme Production';
  @Input() activeFlows = 0;
  @Input() isMutexLocked = false;
  @Input() activeLocks: Flow[] = [];
  @Input({ required: true }) tags: TagWithCount[] = [];

  @Output() tagSelect = new EventEmitter<string>();
}
