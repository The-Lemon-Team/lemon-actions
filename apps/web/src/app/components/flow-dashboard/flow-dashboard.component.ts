import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
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

      <!-- Project Filter Ribbon -->
      @if (projects$ | async; as projects) {
        @if (projects.length > 0) {
          <div class="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/30 flex flex-col gap-2">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-base text-secondary">source_environment</span>
                <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                  {{ 'projects.title' | trans }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                @if (selectedProjectId$ | async) {
                  <button
                    type="button"
                    (click)="onSelectProject(null)"
                    class="text-[11px] font-label-ui text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span class="material-symbols-rounded text-xs">close</span>
                    <span>{{ 'projects.allProjects' | trans }}</span>
                  </button>
                }
                <button
                  type="button"
                  (click)="showCreateProjectForm = !showCreateProjectForm"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-code-sm text-xs bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors"
                >
                  <span class="material-symbols-rounded text-sm">add</span>
                  <span>{{ 'projects.newProject' | trans }}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 select-none">
              <!-- ALL PROJECTS CHIP -->
              <button
                type="button"
                (click)="onSelectProject(null)"
                class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-ui text-xs transition-all active:scale-95 border cursor-pointer"
                [class]="
                  (selectedProjectId$ | async) === null
                    ? 'bg-secondary-container text-on-secondary-container font-bold border-secondary/30 shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-transparent'
                "
              >
                <span class="material-symbols-rounded text-sm">view_compact</span>
                <span>{{ 'projects.allProjects' | trans }}</span>
                <span
                  class="font-label-code-sm text-[10px] px-1.5 py-0.2 rounded-full"
                  [class]="(selectedProjectId$ | async) === null ? 'bg-on-secondary-container/20 text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'"
                  >{{ total$ | async }}</span
                >
              </button>

              <!-- EACH PROJECT CHIP -->
              @for (prj of projects; track prj.id) {
                <button
                  type="button"
                  (click)="onSelectProject(prj.id)"
                  class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-ui text-xs transition-all active:scale-95 border cursor-pointer"
                  [class]="
                    (selectedProjectId$ | async) === prj.id
                      ? 'bg-primary-container text-on-primary-container font-bold border-primary/30 shadow-xs ring-1 ring-primary/40'
                      : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-transparent'
                  "
                >
                  @if (prj.hasActiveFlow) {
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                  }
                  <span class="material-symbols-rounded text-sm">{{ prj.icon }}</span>
                  <span class="whitespace-nowrap">{{ prj.name }}</span>
                  <span
                    class="font-label-code-sm text-[10px] px-1.5 py-0.2 rounded-full"
                    [class]="(selectedProjectId$ | async) === prj.id ? 'bg-on-primary-container/20 text-on-primary-container' : 'bg-surface-container text-on-surface-variant'"
                    >{{ prj.flowCount }}</span
                  >
                </button>
              }
            </div>

            @if (showCreateProjectForm) {
              <div class="mt-1 pt-2 border-t border-outline-variant/30 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  [(ngModel)]="newProjectName"
                  (keydown.enter)="submitCreateProject()"
                  [placeholder]="'projects.newProjectPlaceholder' | trans"
                  class="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
                <button
                  type="button"
                  (click)="submitCreateProject()"
                  [disabled]="!newProjectName.trim()"
                  class="px-3 py-1.5 rounded-lg bg-primary-container hover:bg-primary-fixed-dim disabled:opacity-50 text-on-primary-container font-label-ui text-xs font-bold transition-all"
                >
                  {{ 'projects.saveProject' | trans }}
                </button>
                <button
                  type="button"
                  (click)="showCreateProjectForm = false; newProjectName = ''"
                  class="px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-ui text-xs"
                >
                  {{ 'commandRibbon.cancel' | trans }}
                </button>
              </div>
            }
          </div>
        }
      }

      <!-- Command Ribbon: Sub-Neurons of the selected project (hidden when All Projects is active) -->
      @if (selectedProject$ | async; as selectedProject) {
        <app-command-ribbon
          [projectId]="selectedProject.id"
          [projectName]="selectedProject.name"
          [folderNodes]="(folderTree$ | async) ?? []"
          [selectedFolderId]="selectedFolderId$ | async"
          [totalCount]="selectedProject.flowCount"
          (select)="onSelectFolder($event)"
          (create)="onCreateFolder($event)"
        />
      }

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
        (selectProject)="onSelectProject($event)"
        (selectNeuron)="onSelectFolder($event)"
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
          [initialFolderId]="(selectedFolderId$ | async) ?? (selectedProjectId$ | async)"
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
  readonly projects$ = this.orchestrator.projects$;
  readonly selectedProject$ = this.orchestrator.selectedProject$;
  readonly selectedProjectId$ = this.orchestrator.selectedProjectId$;

  showCreateModal = false;
  showCreateProjectForm = false;
  newProjectName = '';
  isCreatingFlow = false;
  managedFlow: Flow | null = null;

  submitCreateProject(): void {
    const name = this.newProjectName.trim();
    if (!name) return;
    this.orchestrator.createFolder(name, null);
    this.newProjectName = '';
    this.showCreateProjectForm = false;
  }

  onSelectProject(id: string | null): void {
    this.orchestrator.selectProject(id);
  }

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
