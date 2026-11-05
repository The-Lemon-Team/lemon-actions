import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ACTOR_AVATARS_PART_1 } from './actor-avatars-1.svg';
import { ACTOR_AVATARS_PART_2, DEFAULT_ACTOR_AVATAR_SVG } from './actor-avatars-2.svg';

const ALL_AVATARS: Record<string, string> = {
  ...ACTOR_AVATARS_PART_1,
  ...ACTOR_AVATARS_PART_2,
};

@Component({
  selector: 'app-actor-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative inline-flex items-center justify-center overflow-hidden select-none flex-shrink-0"
      [class]="containerClass"
      [innerHTML]="safeSvg"
    ></div>
  `,
})
export class ActorAvatarComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() avatar = 'alexey';
  @Input() containerClass = 'w-12 h-12 rounded-2xl shadow-xs';

  get safeSvg(): SafeHtml {
    const inner = ALL_AVATARS[this.avatar] ?? DEFAULT_ACTOR_AVATAR_SVG;
    const svg = `<svg viewBox="0 0 100 100" class="w-full h-full block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${this.avatar}">${inner}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
