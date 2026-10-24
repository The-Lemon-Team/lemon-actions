import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lemon-actions:theme';

/** Light = Atom "One Light", dark = Atom "One Dark". Toggles the `dark` class on <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly themeSubject = new BehaviorSubject<Theme>(this.initialTheme());

  readonly theme$: Observable<Theme> = this.themeSubject.asObservable();

  constructor() {
    this.apply(this.themeSubject.value);
  }

  toggle(): void {
    this.set(this.themeSubject.value === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.themeSubject.next(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: keep in-memory only */
    }
  }

  private apply(theme: Theme): void {
    this.document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  private initialTheme(): Theme {
    // `?theme=dark|light` overrides the saved choice (handy for sharing/testing).
    const fromUrl = new URLSearchParams(this.document.defaultView?.location?.search ?? '').get('theme');
    if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
