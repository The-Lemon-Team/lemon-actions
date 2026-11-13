import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CodingAgentFacade } from '../core/services/coding-agent-facade.service';
import { SessionHeaderComponent } from '../components/session-header/session-header.component';
import { StreamOptimizerGaugeComponent } from '../components/stream-optimizer-gauge/stream-optimizer-gauge.component';
import { DailyDigestTimelineComponent } from '../components/daily-digest-timeline/daily-digest-timeline.component';
import { SessionHistoryComponent } from '../components/session-history/session-history.component';
import { DecisionLogComponent } from '../components/decision-log/decision-log.component';
import { EodCommitModalComponent } from '../components/eod-commit-modal/eod-commit-modal.component';
import { DecisionModalComponent } from '../components/decision-modal/decision-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AsyncPipe,
    SessionHeaderComponent,
    StreamOptimizerGaugeComponent,
    DailyDigestTimelineComponent,
    SessionHistoryComponent,
    DecisionLogComponent,
    EodCommitModalComponent,
    DecisionModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-surface p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      <!-- Session Header -->
      <app-session-header
        (openCommitModal)="showCommitModal.set(true)"
        (openDecisionModal)="showDecisionModal.set(true)"
      />

      <!-- Stream Optimizer KPI & Live Gauge -->
      <app-stream-optimizer-gauge />

      <!-- Main Two-Column Workflow Workspace -->
      <main class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left: Daily Digest Timeline & Session History -->
        <div class="lg:col-span-7 flex flex-col gap-6">
          <app-daily-digest-timeline (openCommitModal)="showCommitModal.set(true)" />
          <app-session-history />
        </div>

        <!-- Right: Architectural Decisions & Coding Memory -->
        <div class="lg:col-span-5 flex flex-col gap-6">
          <app-decision-log (openDecisionModal)="showDecisionModal.set(true)" />
        </div>
      </main>

      <!-- Toast Notifications -->
      @if (facade.toast$ | async; as toast) {
        <div
          role="alert"
          class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-inverse-surface text-inverse-on-surface shadow-xl text-xs font-medium border border-outline-variant/30 animate-fade-in"
        >
          <span class="material-symbols-rounded text-base text-primary-container">info</span>
          <span>{{ toast }}</span>
        </div>
      }

      <!-- Modals -->
      @if (showCommitModal()) {
        <app-eod-commit-modal (dismissed)="showCommitModal.set(false)" />
      }

      @if (showDecisionModal()) {
        <app-decision-modal (dismissed)="showDecisionModal.set(false)" />
      }
    </div>
  `,
})
export class AppComponent {
  protected readonly facade = inject(CodingAgentFacade);

  readonly showCommitModal = signal<boolean>(false);
  readonly showDecisionModal = signal<boolean>(false);
}
