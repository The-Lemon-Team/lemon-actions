import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FlowOrchestratorService } from '../../core/services/flow-orchestrator.service';
import { CommandRibbonComponent } from '../command-ribbon/command-ribbon.component';
import { FlowMetricsComponent } from '../flow-metrics/flow-metrics.component';
import { FsmTransitionEvent } from '../flow-row/flow-row.component';
import { FlowTableComponent } from '../flow-table/flow-table.component';

/** Smart container for the right column: owns the stream wiring, children stay dumb. */
@Component({
  selector: 'app-flow-dashboard',
  standalone: true,
  imports: [AsyncPipe, FlowMetricsComponent, CommandRibbonComponent, FlowTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-space-md min-w-0">
      <!-- Breadcrumb navigation & Primary CTA -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <nav
          aria-label="Breadcrumb"
          class="flex items-center gap-1.5 font-label-code-sm text-xs text-on-surface-variant flex-wrap"
        >
          <a
            href="#"
            (click)="$event.preventDefault(); onSelectFolder(null)"
            class="hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span class="material-symbols-rounded text-sm">home</span>
            <span>Home</span>
          </a>
          @for (crumb of (breadcrumbs$ | async) ?? []; track crumb.id; let last = $last) {
            <span class="text-outline">/</span>
            <span
              [class]="last ? 'text-on-surface font-bold' : 'hover:text-on-surface transition-colors cursor-pointer'"
              (click)="onSelectFolder(crumb.id)"
              >{{ crumb.name }}</span
            >
          }
        </nav>

        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95"
        >
          <span class="material-symbols-rounded text-sm">add</span>
          <span>Create Flow Channel</span>
        </button>
      </div>

      <!-- Live Flow Metrics -->
      @if (metrics$ | async; as metrics) {
        <app-flow-metrics [metrics]="metrics" />
      }

      <!-- Command Ribbon: Domains & Folders directly above table -->
      <app-command-ribbon
        [folderNodes]="(folderTree$ | async) ?? []"
        [selectedFolderId]="selectedFolderId$ | async"
        [totalCount]="(total$ | async) ?? 0"
        (select)="onSelectFolder($event)"
        (create)="onCreateFolder($event)"
      />

      <!-- Search and filter toolbar -->
      <div class="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/30 flex items-center gap-3">
        <div class="relative flex-1">
          <span class="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base"
            >search</span
          >
          <input
            #search
            type="text"
            [value]="(search$ | async) ?? ''"
            (input)="onSearch(search.value)"
            placeholder="Search active flow channels by name, tag, or architecture type..."
            class="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container transition-all"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="orchestrator.refresh()"
            title="Refresh from Engine"
            class="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span class="material-symbols-rounded text-base">sync</span>
          </button>
        </div>
      </div>

      <!-- Micro-Console Flow Table -->
      <app-flow-table
        [rows]="(rows$ | async) ?? []"
        [total]="(total$ | async) ?? 0"
        (toggle)="onToggle($event)"
        (fsmTransition)="onFsmTransition($event)"
      />
    </section>
  `,
})
export class FlowDashboardComponent {
  protected readonly orchestrator = inject(FlowOrchestratorService);

  readonly rows$ = this.orchestrator.rows$;
  readonly metrics$ = this.orchestrator.metrics$;
  readonly breadcrumbs$ = this.orchestrator.breadcrumbs$;
  readonly total$ = this.orchestrator.totalFlowsCount$;
  readonly search$ = this.orchestrator.search$;
  readonly folderTree$ = this.orchestrator.folderTree$;
  readonly selectedFolderId$ = this.orchestrator.selectedFolderId$;

  onSearch(term: string): void {
    this.orchestrator.setSearch(term);
  }

  onToggle(id: string): void {
    this.orchestrator.toggleFlow(id);
  }

  onSelectFolder(id: string | null): void {
    this.orchestrator.selectFolder(id);
  }

  onCreateFolder(data: { name: string; parentId?: string | null }): void {
    this.orchestrator.createFolder(data.name, data.parentId);
  }

  onFsmTransition(ev: FsmTransitionEvent): void {
    this.orchestrator.triggerFsmTransition(ev.flowId, ev.eventName, ev.targetState);
  }
}
