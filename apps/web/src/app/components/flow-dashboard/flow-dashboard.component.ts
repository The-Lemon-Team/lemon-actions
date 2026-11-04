import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateFlowPayload, Flow } from '../../core/models/flow.models';
import { FlowOrchestratorService } from '../../core/services/flow-orchestrator.service';
import { CommandRibbonComponent } from '../command-ribbon/command-ribbon.component';
import { CreateFlowModalComponent } from '../create-flow-modal/create-flow-modal.component';
import { FlowMetricsComponent } from '../flow-metrics/flow-metrics.component';
import { FsmTransitionEvent } from '../flow-row/flow-row.component';
import { FlowRulesModalComponent } from '../flow-rules-modal/flow-rules-modal.component';
import { FlowTableComponent } from '../flow-table/flow-table.component';

/** Smart container for the right column: owns the stream wiring, children stay dumb. */
@Component({
  selector: 'app-flow-dashboard',
  standalone: true,
  imports: [
    AsyncPipe,
    TranslatePipe,
    FlowMetricsComponent,
    CommandRibbonComponent,
    FlowTableComponent,
    CreateFlowModalComponent,
    FlowRulesModalComponent,
  ],
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
            <span>{{ 'dashboard.home' | trans }}</span>
          </a>
          @for (crumb of (breadcrumbs$ | async) ?? []; track crumb.id; let last = $last) {
            <span class="text-outline">/</span>
            <span
              [class]="last ? 'text-on-surface font-bold' : 'hover:text-on-surface transition-colors cursor-pointer'"
              (click)="onSelectFolder(crumb.id)"
              >{{ i18n.translateFolder(crumb.name) }}</span
            >
          }
        </nav>

        <button
          type="button"
          (click)="showCreateModal = true"
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95"
        >
          <span class="material-symbols-rounded text-sm">add</span>
          <span>{{ 'dashboard.createFlowChannel' | trans }}</span>
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
            [placeholder]="'dashboard.searchPlaceholder' | trans"
            class="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container transition-all"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="orchestrator.refresh()"
            [title]="'dashboard.refreshTitle' | trans"
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
        (manage)="onManage($event)"
        (fsmTransition)="onFsmTransition($event)"
        (createChannel)="showCreateModal = true"
      />

      <!-- Flow Rules & Chronicle Modal -->
      @if (managedFlow) {
        <app-flow-rules-modal
          [flow]="managedFlow"
          (close)="managedFlow = null"
          (saveRules)="orchestrator.saveFlowRules($event.flowId, $event.isExclusive, $event.orchestratorRules)"
        />
      }

      <!-- Create Flow Channel Modal -->
      @if (showCreateModal) {
        <app-create-flow-modal
          [folders]="(folders$ | async) ?? []"
          [initialFolderId]="selectedFolderId$ | async"
          [isSubmitting]="isCreatingFlow"
          (close)="showCreateModal = false"
          (submitFlow)="onCreateFlow($event)"
        />
      }
    </section>
  `,
})
export class FlowDashboardComponent {
  protected readonly orchestrator = inject(FlowOrchestratorService);
  protected readonly i18n = inject(I18nService);

  readonly rows$ = this.orchestrator.rows$;
  readonly flows$ = this.orchestrator.flows$;
  readonly metrics$ = this.orchestrator.metrics$;
  readonly breadcrumbs$ = this.orchestrator.breadcrumbs$;
  readonly total$ = this.orchestrator.totalFlowsCount$;
  readonly search$ = this.orchestrator.search$;
  readonly folderTree$ = this.orchestrator.folderTree$;
  readonly folders$ = this.orchestrator.folders$;
  readonly selectedFolderId$ = this.orchestrator.selectedFolderId$;

  showCreateModal = false;
  isCreatingFlow = false;
  managedFlow: Flow | null = null;

  onSearch(term: string): void {
    this.orchestrator.setSearch(term);
  }

  onToggle(id: string): void {
    this.orchestrator.toggleFlow(id);
  }

  onManage(id: string): void {
    this.flows$.subscribe((flows) => {
      const target = flows.find((f) => f.id === id);
      if (target) {
        this.managedFlow = target;
      }
    }).unsubscribe();
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

  onCreateFlow(payload: CreateFlowPayload): void {
    this.isCreatingFlow = true;
    this.orchestrator
      .createFlow(payload)
      .pipe(
        finalize(() => {
          this.isCreatingFlow = false;
        }),
      )
      .subscribe({
        next: () => {
          this.showCreateModal = false;
        },
      });
  }
}
