import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, switchMap, take, timer } from 'rxjs';
import { LayoutComponent } from './components/layout/layout.component';
import { PwaInstallModalComponent } from './components/pwa-install-modal/pwa-install-modal.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AppMode } from './core/models/flow.models';
import { FlowOrchestratorService } from './core/services/flow-orchestrator.service';
import { ProfileService } from './core/services/profile.service';
import { PwaService } from './core/services/pwa.service';
import { ThemeService } from './core/services/theme.service';
import { APP_SHELL_MANIFEST } from './core/shell/app-shell.models';
import { APP_SHELL_MANIFEST_DATA } from './core/shell/shell.manifest';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet, LayoutComponent, SidebarComponent, PwaInstallModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout
      [isDark]="(theme.theme$ | async) === 'dark'"
      [appMode]="(profileService.appMode$ | async) ?? shellManifest.defaultMode"
      [appTitle]="shellManifest.appTitle"
      [appIcon]="shellManifest.appIcon ?? 'nutrition'"
      [profileName]="(profileService.activeProfile$ | async)?.displayName ?? 'Мой Дом'"
      [navItems]="shellManifest.navItems"
      [clusterLabel]="shellManifest.clusterLabel"
      [hideSidebar]="shellManifest.hideSidebar ?? false"
      [showInstallApp]="pwa.showInstallButton()"
      [canNativeInstall]="pwa.canNativeInstall()"
      (themeToggle)="theme.toggle()"
      (modeChange)="onModeChange($event)"
      (installApp)="pwa.triggerInstall()"
    >
      @if (!shellManifest.hideSidebar) {
        <app-sidebar
          slot="sidebar"
          [workspaceName]="(profileService.activeProfile$ | async)?.displayName ?? 'Мой Дом'"
          [tags]="(tags$ | async) ?? []"
          [activeFlows]="(activeFlows$ | async) ?? 0"
          [isMutexLocked]="(isMutexLocked$ | async) ?? false"
          [activeLocks]="(activeLocks$ | async) ?? []"
          (tagSelect)="orchestrator.selectTag($event)"
          (tagClear)="orchestrator.clearTag()"
        />
      }
      <router-outlet />
    </app-layout>

    @if (pwa.showInstallGuide()) {
      <app-pwa-install-modal
        [appTitle]="shellManifest.appTitle ?? 'Lemon Actions'"
        [appIcon]="shellManifest.appIcon ?? 'install_desktop'"
        [originUrl]="pwa.currentOrigin"
        [isSecureContext]="pwa.isSecureContext"
        (closed)="pwa.closeInstallGuide()"
      />
    }

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
export class AppComponent implements OnInit {
  protected readonly orchestrator = inject(FlowOrchestratorService);
  protected readonly profileService = inject(ProfileService);
  protected readonly pwa = inject(PwaService);
  protected readonly theme = inject(ThemeService);
  protected readonly shellManifest =
    inject(APP_SHELL_MANIFEST, { optional: true }) ?? APP_SHELL_MANIFEST_DATA;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly tags$ = this.orchestrator.tags$;
  readonly activeFlows$ = this.orchestrator.activeFlowsCount$;
  readonly isMutexLocked$ = this.orchestrator.mutexLocked$;
  readonly activeLocks$ = this.orchestrator.activeLocks$;

  /** Shows each API error for 5 seconds, then clears. */
  readonly toast$ = this.orchestrator.errors$.pipe(
    switchMap((msg) => timer(0, 5000).pipe(take(2), map((i) => (i === 0 ? msg : null)))),
  );

  ngOnInit(): void {
    this.pwa.init();
    this.syncModeFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.syncModeFromUrl(event.urlAfterRedirects || event.url);
      });
  }

  onModeChange(mode: AppMode): void {
    this.profileService.setAppMode(mode);
    this.router.navigate(['/' + mode]);
  }

  private syncModeFromUrl(url: string): void {
    const matched = this.shellManifest.navItems.find((item) => url.startsWith(item.route));
    this.profileService.setAppMode(matched?.id ?? this.shellManifest.defaultMode);
  }
}
