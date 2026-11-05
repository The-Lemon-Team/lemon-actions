import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map, switchMap, take, timer } from 'rxjs';
import { CodeLabComponent } from './components/code-lab/code-lab.component';
import { FlowDashboardComponent } from './components/flow-dashboard/flow-dashboard.component';
import { HomeTrackerComponent } from './components/home-tracker/home-tracker.component';
import { LayoutComponent } from './components/layout/layout.component';
import { NeuronArenaComponent } from './components/neuron-arena/neuron-arena.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FlowOrchestratorService } from './core/services/flow-orchestrator.service';
import { ProfileService } from './core/services/profile.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AsyncPipe,
    LayoutComponent,
    SidebarComponent,
    FlowDashboardComponent,
    HomeTrackerComponent,
    CodeLabComponent,
    NeuronArenaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout
      [isDark]="(theme.theme$ | async) === 'dark'"
      [appMode]="(profileService.appMode$ | async) ?? 'arena'"
      [profileName]="(profileService.activeProfile$ | async)?.displayName ?? 'Мой Дом'"
      (themeToggle)="theme.toggle()"
      (modeChange)="profileService.setAppMode($event)"
    >
      <app-sidebar
        slot="sidebar"
        [workspaceName]="(profileService.activeProfile$ | async)?.displayName ?? 'Мой Дом'"
        [tags]="(tags$ | async) ?? []"
        [activeFlows]="(activeFlows$ | async) ?? 0"
        [isMutexLocked]="(isMutexLocked$ | async) ?? false"
        [activeLocks]="(activeLocks$ | async) ?? []"
        (tagSelect)="orchestrator.selectTag($event)"
      />
      @if (((profileService.appMode$ | async) ?? 'arena') === 'arena') {
        <app-neuron-arena />
      } @else if (((profileService.appMode$ | async) ?? 'arena') === 'home') {
        <app-home-tracker />
      } @else if (((profileService.appMode$ | async) ?? 'arena') === 'code') {
        <app-code-lab />
      } @else {
        <app-flow-dashboard />
      }
    </app-layout>
    @if (toast$ | async; as message) {
      <div
        role="alert"
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-inverse-surface text-inverse-on-surface shadow-lg font-body-sm text-body-sm border border-outline-variant/30"
      >
        <span class="material-symbols-rounded text-base text-error-container">error</span>
        <span>{{ message }}</span>
      </div>
    }
  `,
})
export class AppComponent {
  protected readonly orchestrator = inject(FlowOrchestratorService);
  protected readonly profileService = inject(ProfileService);
  protected readonly theme = inject(ThemeService);

  readonly tags$ = this.orchestrator.tags$;
  readonly activeFlows$ = this.orchestrator.activeFlowsCount$;
  readonly isMutexLocked$ = this.orchestrator.mutexLocked$;
  readonly activeLocks$ = this.orchestrator.activeLocks$;

  /** Shows each API error for 5 seconds, then clears. */
  readonly toast$ = this.orchestrator.errors$.pipe(
    switchMap((msg) => timer(0, 5000).pipe(take(2), map((i) => (i === 0 ? msg : null)))),
  );
}
