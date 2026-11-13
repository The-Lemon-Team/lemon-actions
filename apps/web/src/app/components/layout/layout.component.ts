import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AppMode } from '../../core/models/flow.models';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [TranslatePipe, LanguageSwitcherComponent, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div class="h-16 w-full px-margin flex items-center justify-between gap-gutter">
        <div class="flex items-center gap-space-lg flex-shrink-0">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
              <span class="material-symbols-rounded text-lg" style="font-variation-settings: 'FILL' 1">nutrition</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight">{{ 'app.title' | trans }}</span>
            <span class="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">{{ 'app.version' | trans }}</span>
          </div>

          <!-- Mode Navigation: /actions, /registrar, /home, /code, /core, /arena -->
          <nav aria-label="Apps Navigation" class="flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant/25">
            <a
              routerLink="/projectarium"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('projectarium')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'projectarium'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">domain</span>
              <span>Projectarium</span>
              <span class="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[9px] font-extrabold uppercase">Cockpit</span>
            </a>
            <a
              routerLink="/actions"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('actions')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'actions'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">style</span>
              <span>Lemon Actions</span>
            </a>
            <a
              routerLink="/registrar"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('registrar')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'registrar'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">verified_user</span>
              <span>Port Shield</span>
              <span class="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold uppercase">Live</span>
            </a>
            <a
              routerLink="/home"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('home')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'home'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">home</span>
              <span>Lemon Home</span>
            </a>
            <a
              routerLink="/code"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('code')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'code'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">terminal</span>
              <span>Lemon Code</span>
            </a>
            <a
              routerLink="/core"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('core')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'core'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">hub</span>
              <span>Core Console</span>
            </a>
            <a
              routerLink="/arena"
              routerLinkActive="bg-primary-container text-on-primary-container shadow-xs"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="modeChange.emit('arena')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-label-ui text-xs font-bold no-underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              [class]="
                appMode === 'arena'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">diversity_3</span>
              <span>Neuron Arena</span>
            </a>
          </nav>
        </div>

        <div class="flex items-center gap-space-md flex-shrink-0">
          <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
            <span class="w-2 h-2 rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--c-success)/0.2)]"></span>
            <span class="font-label-code-sm text-label-code-sm text-on-surface">{{ 'cluster.status' | trans }}</span>
          </div>

          <!-- Language Switcher (RU / EN) -->
          <app-language-switcher />

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
        [class]="
          appMode === 'arena'
            ? 'px-3 sm:px-6 max-w-[1800px]'
            : 'max-w-[1440px] px-margin'
        "
      >
        <div
          [class]="
            appMode !== 'arena'
              ? 'grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start'
              : 'w-full'
          "
        >
          @if (appMode !== 'arena') {
            <div class="xl:col-span-3"><ng-content select="[slot=sidebar]" /></div>
          }
          <div
            [class]="
              appMode !== 'arena'
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
  @Input() appMode: AppMode = 'home';
  @Input() profileName = 'Мой Дом';
  @Output() themeToggle = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<AppMode>();
}
