import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AppMode } from '../../core/models/flow.models';
import { AppNavBadgeVariant, AppNavItem } from '../../core/shell/app-shell.models';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [TranslatePipe, LanguageSwitcherComponent, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div class="h-16 w-full px-margin flex items-center justify-between gap-gutter">
        <div class="flex items-center gap-space-md lg:gap-space-lg min-w-0 flex-1">
          <div class="flex items-center gap-space-sm flex-shrink-0">
            <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
              <span class="material-symbols-rounded text-lg" style="font-variation-settings: 'FILL' 1">{{ appIcon }}</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight whitespace-nowrap">{{ appTitle || ('app.title' | trans) }}</span>
            <span class="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">{{ 'app.version' | trans }}</span>
          </div>

          <!-- Data-driven App Header Navigation (delivered via APP_SHELL_MANIFEST) -->
          @if (navItems.length > 0) {
            <nav aria-label="Apps Navigation" class="flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant/25 overflow-x-auto min-w-0">
              @for (item of navItems; track item.id) {
                <a
                  [routerLink]="item.route"
                  routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
                  [routerLinkActiveOptions]="{ exact: false }"
                  (click)="modeChange.emit(item.id)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer whitespace-nowrap flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  [class]="navItemClass(item.id)"
                >
                  <span class="material-symbols-rounded text-base">{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                  @if (item.badge; as badge) {
                    <span [class]="badgeClass(badge.variant)">{{ badge.text }}</span>
                  }
                </a>
              }
            </nav>
          }
        </div>

        <div class="flex items-center gap-space-md flex-shrink-0">
          <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
            <span class="w-2 h-2 rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--c-success)/0.2)]"></span>
            <span class="font-label-code-sm text-label-code-sm text-on-surface">{{ clusterLabel || ('cluster.status' | trans) }}</span>
          </div>

          <!-- Language Switcher (RU / EN) -->
          <app-language-switcher />

          @if (showInstallApp) {
            <button
              type="button"
              (click)="installApp.emit()"
              [attr.aria-label]="'pwa.installTitle' | trans"
              [title]="'pwa.installTitle' | trans"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-label-ui text-xs font-semibold transition-colors"
              [class]="canNativeInstall ? 'bg-primary-container text-on-primary-container hover:opacity-90' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'"
            >
              <span class="material-symbols-rounded text-lg">install_desktop</span>
              <span class="hidden lg:inline">{{ 'pwa.installBtn' | trans }}</span>
            </button>
          }

          <button
            type="button"
            (click)="themeToggle.emit()"
            [attr.aria-label]="isDark ? ('theme.switchToLight' | trans) : ('theme.switchToDark' | trans)"
            [title]="isDark ? ('theme.light' | trans) : ('theme.dark' | trans)"
            class="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-xl">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
          </button>
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-ui text-xs font-semibold"
            title="Активный профиль пользователя"
          >
            <span class="material-symbols-rounded text-base">person</span>
            <span class="hidden sm:inline">{{ profileName }}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full pt-16 bg-surface min-h-screen">
      <div
        class="w-full mx-auto py-space-md"
        [class]="mainContainerClass"
      >
        <div
          [class]="
            showSidebar
              ? 'grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start'
              : 'w-full'
          "
        >
          @if (showSidebar) {
            <div class="xl:col-span-3"><ng-content select="[slot=sidebar]" /></div>
          }
          <div
            [class]="
              showSidebar
                ? 'xl:col-span-9 min-w-0'
                : 'w-full min-w-0'
            "
          >
            <ng-content />
          </div>
        </div>
      </div>
    </main>
  `,
})
export class LayoutComponent {
  @Input() isDark = false;
  @Input() appMode: AppMode = 'core';
  @Input() appTitle?: string;
  @Input() appIcon = 'nutrition';
  @Input() profileName = 'Мой Дом';
  @Input() navItems: readonly AppNavItem[] = [];
  @Input() clusterLabel?: string;
  @Input() hideSidebar = false;
  @Input() showInstallApp = false;
  @Input() canNativeInstall = false;
  @Output() themeToggle = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<AppMode>();
  @Output() installApp = new EventEmitter<void>();

  get showSidebar(): boolean {
    return (
      !this.hideSidebar &&
      this.appMode !== 'projectarium' &&
      this.appMode !== 'seasons' &&
      this.appMode !== 'media' &&
      this.appMode !== 'ai'
    );
  }

  get mainContainerClass(): string {
    return 'max-w-[1440px] px-margin';
  }

  navItemClass(id: AppMode): string {
    return this.appMode === id
      ? 'bg-primary-container text-on-primary-container shadow-xs'
      : 'text-on-surface-variant hover:text-on-surface';
  }

  badgeClass(variant: AppNavBadgeVariant): string {
    return variant === 'success'
      ? 'px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold uppercase'
      : 'px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[9px] font-extrabold uppercase';
  }
}
