import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div class="h-16 w-full px-margin flex items-center justify-between gap-gutter">
        <div class="flex items-center gap-space-lg flex-shrink-0">
          <div class="flex items-center gap-space-sm">
            <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
              <span class="material-symbols-rounded text-lg" style="font-variation-settings: 'FILL' 1">nutrition</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight">Lemon Actions</span>
            <span class="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">v2.4.0</span>
          </div>
          <nav class="hidden xl:flex items-center gap-1">
            @for (item of nav; track item; let first = $first) {
              <a
                href="#"
                class="px-3 py-1.5 rounded-lg transition-colors font-label-ui text-label-ui"
                [class]="first ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'"
                [attr.aria-current]="first ? 'page' : null"
                >{{ item }}</a
              >
            }
          </nav>
        </div>

        <div class="flex items-center gap-space-md flex-shrink-0">
          <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
            <span class="w-2 h-2 rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--c-success)/0.2)]"></span>
            <span class="font-label-code-sm text-label-code-sm text-on-surface">Cluster: US-East-1 (Healthy)</span>
          </div>
          <button type="button" class="hidden lg:flex items-center gap-space-sm px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface-variant shadow-xs hover:bg-surface-container-low hover:text-on-surface transition-colors">
            <span class="material-symbols-rounded text-base">search</span>
            <span class="font-body-sm text-body-sm">Search flows, runs...</span>
            <kbd class="font-label-code-sm text-label-code-sm bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant">⌘K</kbd>
          </button>
          <button
            type="button"
            (click)="themeToggle.emit()"
            [attr.aria-label]="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            [title]="isDark ? 'Light theme (One Light)' : 'Dark theme (One Dark)'"
            class="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-xl">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
          </button>
          <button type="button" aria-label="Notifications" class="relative p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <span class="material-symbols-rounded text-xl">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-container shadow-[0_0_0_2px_rgb(var(--c-surface))]"></span>
          </button>
          <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-rounded text-lg">person</span>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full pt-16 bg-surface min-h-screen">
      <div class="w-full max-w-[1440px] mx-auto px-margin py-space-md">
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start">
          <div class="xl:col-span-3"><ng-content select="[slot=sidebar]" /></div>
          <div class="xl:col-span-9 min-w-0"><ng-content /></div>
        </div>
      </div>
    </main>
  `,
})
export class LayoutComponent {
  @Input() isDark = false;
  @Output() themeToggle = new EventEmitter<void>();

  readonly nav = ['Flows', 'Triggers & Webhooks', 'Telemetry', 'Secrets & Env', 'Settings'];
}
