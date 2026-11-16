import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'manual';

/**
 * Manages Service Worker lifecycle and Desktop PWA installation state (SRP).
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly isStandalone = signal<boolean>(this.detectStandalone());
  readonly canNativeInstall = signal<boolean>(false);
  readonly swRegistered = signal<boolean>(false);
  readonly showInstallGuide = signal<boolean>(false);

  /** Hide install action once the app is already running as an installed standalone window. */
  readonly showInstallButton = computed(() => !this.isStandalone());

  get currentOrigin(): string {
    return this.document.defaultView?.location?.origin ?? '';
  }

  get isSecureContext(): boolean {
    return Boolean(this.document.defaultView?.isSecureContext);
  }

  init(): void {
    const win = this.document.defaultView;
    if (!win) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canNativeInstall.set(true);
    };

    const onAppInstalled = () => {
      this.deferredPrompt = null;
      this.canNativeInstall.set(false);
      this.isStandalone.set(true);
      this.showInstallGuide.set(false);
    };

    const mediaQuery = win.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      this.isStandalone.set(e.matches || this.detectStandalone());
    };

    win.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    win.addEventListener('appinstalled', onAppInstalled);
    mediaQuery?.addEventListener?.('change', onDisplayModeChange);

    this.destroyRef.onDestroy(() => {
      win.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      win.removeEventListener('appinstalled', onAppInstalled);
      mediaQuery?.removeEventListener?.('change', onDisplayModeChange);
    });

    this.registerServiceWorker(win);
  }

  async triggerInstall(): Promise<PwaInstallOutcome> {
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.deferredPrompt = null;
        this.canNativeInstall.set(false);
      }
      return choice.outcome;
    }

    this.showInstallGuide.set(true);
    return 'manual';
  }

  closeInstallGuide(): void {
    this.showInstallGuide.set(false);
  }

  private registerServiceWorker(win: Window): void {
    const nav = win.navigator;
    if (!nav || !('serviceWorker' in nav)) return;
    // Skip SW registration when running inside Karma unit tests
    if ((win as unknown as { __karma__?: unknown }).__karma__) return;

    const register = () => {
      nav.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => {
          this.swRegistered.set(true);
        })
        .catch(() => {
          this.swRegistered.set(false);
        });
    };

    if (this.document.readyState === 'complete') {
      register();
    } else {
      win.addEventListener('load', register, { once: true });
    }
  }

  private detectStandalone(): boolean {
    const win = this.document.defaultView;
    if (!win) return false;
    const matchStandalone = Boolean(win.matchMedia?.('(display-mode: standalone)').matches);
    const iosStandalone = Boolean((win.navigator as unknown as { standalone?: boolean })?.standalone);
    return matchStandalone || iosStandalone;
  }
}
