import { UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="i18n.toggleLocale()"
      [attr.aria-label]="i18n.t('language.ariaLabel')"
      [title]="i18n.t('language.toggleTitle')"
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-label-code-sm text-xs select-none"
    >
      <span class="material-symbols-rounded text-lg">language</span>
      <span class="font-bold tracking-wide">{{ i18n.localeSignal() | uppercase }}</span>
    </button>
  `,
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(I18nService);
}
