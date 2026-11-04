import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FlowStatus } from '../../core/models/flow.models';

@Component({
  selector: 'app-flow-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full w-max font-label-code-sm text-xs whitespace-nowrap flex-shrink-0"
      [class]="pillClass"
    >
      <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" [class]="dotClass" [class.animate-pulse]="isPulse"></span>
      <span>{{ displayLabel }}</span>
    </div>
  `,
})
export class FlowStatusBadgeComponent {
  protected readonly i18n = inject(I18nService);

  @Input() status: FlowStatus = FlowStatus.INACTIVE;
  @Input() label?: string;
  @Input() variant?: 'active' | 'paused' | 'idle' | 'warning' | 'success';

  get resolvedVariant(): 'active' | 'paused' | 'idle' {
    if (this.variant === 'success' || this.variant === 'active') return 'active';
    if (this.variant === 'warning' || this.variant === 'paused') return 'paused';
    if (this.variant === 'idle') return 'idle';

    if (this.status === FlowStatus.ACTIVE || this.status === FlowStatus.PROCESSING) return 'active';
    if (this.status === FlowStatus.PAUSED) return 'paused';
    return 'idle';
  }

  get pillClass(): string {
    switch (this.resolvedVariant) {
      case 'active':
        return 'bg-success-container text-on-success-container';
      case 'paused':
        return 'bg-warning-container text-on-warning-container';
      default:
        return 'bg-surface-container text-on-surface-variant';
    }
  }

  get dotClass(): string {
    switch (this.resolvedVariant) {
      case 'active':
        return 'bg-success';
      case 'paused':
        return 'bg-warning';
      default:
        return 'bg-tertiary';
    }
  }

  get isPulse(): boolean {
    return this.resolvedVariant === 'active';
  }

  get displayLabel(): string {
    if (this.label) {
      return this.i18n.translateFsmLabel(this.label);
    }
    switch (this.resolvedVariant) {
      case 'active':
        return this.i18n.translateFlowStatus(FlowStatus.ACTIVE);
      case 'paused':
        return this.i18n.translateFlowStatus(FlowStatus.PAUSED);
      default:
        return this.i18n.translateFlowStatus(FlowStatus.INACTIVE);
    }
  }
}
