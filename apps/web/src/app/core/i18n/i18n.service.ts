import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Flow, FlowStatus, FlowType } from '../models/flow.models';
import { SupportedLocale, Translations } from './i18n.models';
import { en } from './translations/en';
import { ru } from './translations/ru';

const STORAGE_KEY = 'lemon-actions:locale';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly dictionaries: Record<SupportedLocale, Translations> = { ru, en };

  private readonly initial = this.resolveInitialLocale();
  private readonly localeSubject = new BehaviorSubject<SupportedLocale>(this.initial);

  readonly locale$: Observable<SupportedLocale> = this.localeSubject.asObservable();
  readonly localeSignal = signal<SupportedLocale>(this.initial);

  constructor() {
    this.apply(this.initial);
  }

  get currentLocale(): SupportedLocale {
    return this.localeSubject.value;
  }

  setLocale(locale: SupportedLocale): void {
    if (this.localeSubject.value === locale) return;
    this.localeSubject.next(locale);
    this.localeSignal.set(locale);
    this.apply(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }

  toggleLocale(): void {
    this.setLocale(this.currentLocale === 'ru' ? 'en' : 'ru');
  }

  /**
   * Resolves a nested key in the translation dictionary, with optional placeholder interpolation.
   * Example: t('commandRibbon.subDomainsOf', { name: 'Core' }) -> "Поддомены Core"
   */
  t(path: string, params?: Record<string, string | number>): string {
    const locale = this.localeSubject.value;
    let value = this.lookup(this.dictionaries[locale], path);

    if (value === undefined && locale !== 'en') {
      value = this.lookup(this.dictionaries.en, path);
    }

    if (value === undefined) {
      return path;
    }

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replaceAll(`{{${k}}}`, String(v));
      }
    }

    return value;
  }

  translateFolder(name: string): string {
    const dict = this.dictionaries[this.currentLocale];
    return dict.standardFolders[name] ?? name;
  }

  translateFlow(flow: Flow): { name: string; description?: string } {
    const dict = this.dictionaries[this.currentLocale];
    const std = dict.standardFlows[flow.name];
    if (std) {
      return {
        name: std.name,
        description: std.description ?? flow.description,
      };
    }
    return {
      name: flow.name,
      description: flow.description,
    };
  }

  translateFlowType(type: FlowType): string {
    const dict = this.dictionaries[this.currentLocale];
    return dict.flowTypes[type] ?? type;
  }

  translateFlowStatus(status: FlowStatus): string {
    const dict = this.dictionaries[this.currentLocale];
    return dict.flowStatuses[status] ?? status;
  }

  translateFsmLabel(label: string): string {
    const dict = this.dictionaries[this.currentLocale];
    const lower = label.toLowerCase();
    if (lower === 'idle') return dict.fsm.idle;
    if (lower === 'focusing') return dict.fsm.focusing;
    if (lower === 'on break' || lower === 'break') return dict.fsm.break;
    return label;
  }

  translateFsmButton(label: string): string {
    const dict = this.dictionaries[this.currentLocale];
    const lower = label.toLowerCase();
    if (lower === 'start focus') return dict.fsm.startFocus;
    if (lower === 'take break') return dict.fsm.takeBreak;
    if (lower === 'stop') return dict.fsm.stop;
    if (lower === 'resume') return dict.fsm.resume;
    return label;
  }

  private apply(locale: SupportedLocale): void {
    if (this.document.documentElement) {
      this.document.documentElement.lang = locale;
    }
  }

  private lookup(obj: unknown, path: string): string | undefined {
    const segments = path.split('.');
    let curr: any = obj;
    for (const seg of segments) {
      if (curr === null || curr === undefined || typeof curr !== 'object') {
        return undefined;
      }
      curr = curr[seg];
    }
    return typeof curr === 'string' ? curr : undefined;
  }

  private resolveInitialLocale(): SupportedLocale {
    const fromUrl = new URLSearchParams(this.document.defaultView?.location?.search ?? '').get('lang')
      || new URLSearchParams(this.document.defaultView?.location?.search ?? '').get('locale');
    if (fromUrl === 'ru' || fromUrl === 'en') return fromUrl;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'en') return saved;
    } catch {
      /* ignore */
    }

    const browserLang = this.document.defaultView?.navigator?.language?.toLowerCase() ?? '';
    if (browserLang.startsWith('ru')) return 'ru';

    // Default to 'ru' since Russian localization is added for this application
    return 'ru';
  }
}
