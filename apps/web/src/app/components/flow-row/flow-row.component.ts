import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Flow, FlowRowState, FlowStatus, FlowType } from '../../core/models/flow.models';
import { formatDuration, getFlowTypeUi } from '../../core/utils/flow-ui';
import { FlowStatusBadgeComponent } from '../flow-status-badge/flow-status-badge.component';

export interface FsmTransitionEvent {
  flowId: string;
  eventName: string;
  targetState: string;
}

@Component({
  selector: 'tr[app-flow-row]',
  standalone: true,
  imports: [AsyncPipe, FlowStatusBadgeComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'group hover:bg-primary-container/10 transition-colors border-b border-outline-variant/20',
  },
  template: `
    @if (state.flow$ | async; as flow) {
      @let display = flowDisplay(flow);

      <!-- CHECKBOX & STATUS STRIPE -->
      <td
        class="py-3 px-3 align-middle"
        [class.border-l-4]="true"
        [class.border-warning]="flow.type === FlowType.MUTEX && ((state.isActive$ | async) ?? false)"
        [class.border-success]="flow.type !== FlowType.MUTEX && ((state.isActive$ | async) ?? false)"
        [class.border-transparent]="!((state.isActive$ | async) ?? false)"
      >
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            class="rounded accent-primary-container cursor-pointer w-4 h-4"
            [attr.aria-label]="i18n.t('row.selectFlow', { name: display.name })"
          />
        </div>
      </td>

      <!-- FLOW NAME, FOLDER, PURPOSE -->
      <td class="py-3 px-3 align-middle min-w-[220px]">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <a
              href="#"
              (click)="$event.preventDefault(); manage.emit(flow.id)"
              class="font-headline-sm text-sm font-semibold text-on-surface hover:text-secondary hover:underline transition-colors"
              >{{ display.name }}</a
            >
            @if (flow.isExclusive) {
              <span
                class="material-symbols-rounded text-xs text-warning"
                [title]="'row.exclusiveMutexTooltip' | trans"
                >lock</span
              >
            }
          </div>
          <span class="text-on-surface-variant font-body-sm text-xs line-clamp-1">{{ display.description }}</span>
        </div>
      </td>

      <!-- ARCHITECTURE TYPE & CONCURRENCY BADGE -->
      <td class="py-3 px-3 align-middle whitespace-nowrap">
        <div class="flex flex-col gap-1 items-start">
          <span
            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-code-sm text-xs whitespace-nowrap"
            [class]="typeUi(flow.type).classes"
          >
            <span class="material-symbols-rounded text-xs">{{ typeUi(flow.type).icon }}</span>
            <span>{{ typeUi(flow.type).label }}</span>
          </span>
          @if (flow.isExclusive) {
            <span class="font-label-code-sm text-[10px] text-warning font-semibold tracking-wide">
              {{ 'row.exclusiveLockBadge' | trans }}
            </span>
          }
        </div>
      </td>

      <!-- STANDARDIZED TELEMETRY & LIVE STATE -->
      <td class="py-3 px-3 align-middle">
        <div class="flex flex-col gap-1.5 min-w-[200px]">
          <!-- FSM CONSOLE -->
          @if (flow.type === FlowType.FSM) {
            @let currentState = flow.config?.currentState || flow.config?.initial || 'idle';
            @let stateConfig = flow.config?.states?.[currentState];
            @let fsmVariant = currentState === 'focusing' ? 'active' : (currentState === 'break' ? 'paused' : 'idle');

            <div class="flex items-center gap-2 whitespace-nowrap">
              <app-flow-status-badge
                [variant]="fsmVariant"
                [label]="i18n.translateFsmLabel(stateConfig?.label || currentState)"
              />
              @if ((state.isActive$ | async) ?? false) {
                <span class="font-label-code-sm text-xs text-on-surface font-medium whitespace-nowrap">
                  {{ format((state.currentDuration$ | async) ?? 0) }}
                </span>
              }
            </div>

            <!-- Standardized FSM Transition Buttons -->
            @if (stateConfig?.transitions?.length) {
              <div class="flex items-center gap-1.5 flex-wrap">
                @for (t of stateConfig.transitions; track t.event) {
                  <button
                    type="button"
                    (click)="fsmTransition.emit({ flowId: flow.id, eventName: t.event, targetState: t.target })"
                    class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-ui text-xs font-semibold transition-all active:scale-95 shadow-2xs whitespace-nowrap"
                    [class]="getIntentClass(t.ui?.intent)"
                  >
                    @if (t.ui?.icon) {
                      <span class="material-symbols-rounded text-xs">{{ t.ui.icon }}</span>
                    }
                    <span>{{ i18n.translateFsmButton(t.ui?.buttonLabel || t.event) }}</span>
                  </button>
                }
              </div>
            }
          }

          <!-- MUTEX CONSOLE (STANDARDIZED CHIP) -->
          @else if (flow.type === FlowType.MUTEX) {
            <div class="flex items-center gap-2 whitespace-nowrap">
              @if (state.status$ | async; as status) {
                <app-flow-status-badge [status]="status" />
              }
              @if ((state.isActive$ | async) ?? false) {
                <span class="font-label-code-sm text-xs text-on-surface font-medium whitespace-nowrap">
                  {{ format((state.currentDuration$ | async) ?? 0) }}
                </span>
                <span class="font-label-code-sm text-[11px] text-warning font-semibold whitespace-nowrap">
                  {{ 'row.lockEngaged' | trans }}
                </span>
              }
            </div>
          }

          <!-- TIMER CONSOLE -->
          @else if (flow.type === FlowType.TIMER) {
            <div class="flex items-center gap-2 whitespace-nowrap">
              @if (state.status$ | async; as status) {
                <app-flow-status-badge [status]="status" />
              }
              @if ((state.isActive$ | async) ?? false) {
                <span class="font-label-code-sm text-xs text-on-surface font-medium whitespace-nowrap">
                  {{ format((state.currentDuration$ | async) ?? 0) }}
                </span>
              }
              <span class="font-label-code-sm text-[11px] text-outline whitespace-nowrap">
                {{ 'row.cycleSeconds' | trans: { seconds: flow.config?.intervalSeconds || 3300 } }}
              </span>
            </div>
          }

          <!-- OBSERVER / DEFAULT CONSOLE -->
          @else {
            <div class="flex items-center gap-2 whitespace-nowrap">
              @if (state.status$ | async; as status) {
                <app-flow-status-badge [status]="status" />
              }
              @if ((state.isActive$ | async) ?? false) {
                <span class="font-label-code-sm text-xs text-on-surface font-medium whitespace-nowrap">
                  {{ format((state.currentDuration$ | async) ?? 0) }}
                </span>
                <span class="font-label-code-sm text-[11px] text-secondary flex items-center gap-0.5 whitespace-nowrap">
                  <span class="material-symbols-rounded text-xs">bolt</span>
                  <span>{{ 'row.stream' | trans }}</span>
                </span>
              }
            </div>
          }

          <!-- CORE SCHEDULED MUTEX & LEASE BADGES -->
          @if (flow.orchestratorRules?.schedule?.enabled !== false && flow.orchestratorRules?.schedule?.windows?.[0]; as win) {
            <div class="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                (click)="manage.emit(flow.id)"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/35 hover:bg-primary-container text-on-primary-container font-label-code-sm text-[10px] font-semibold transition-colors cursor-pointer"
              >
                <span class="material-symbols-rounded text-[11px]">schedule</span>
                <span>{{ win.start }}–{{ win.end }}</span>
              </button>
            </div>
          } @else if (flow.orchestratorRules?.leaseTimeoutSeconds) {
            <div class="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                (click)="manage.emit(flow.id)"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-code-sm text-[10px] transition-colors cursor-pointer"
              >
                <span class="material-symbols-rounded text-[11px]">timer</span>
                <span>Lease: {{ flow.orchestratorRules.leaseTimeoutSeconds }}s</span>
              </button>
            </div>
          }
        </div>
      </td>

      <!-- TAXONOMY (STANDARDIZED PILLS) -->
      <td class="py-3 px-3 align-middle">
        <div class="flex flex-wrap gap-1 max-w-[180px]">
          @for (tag of flow.tags; track tag.id) {
            <span
              class="px-2 py-0.5 rounded-full font-label-code-sm text-[10px] whitespace-nowrap"
              [class]="
                tag.name === flow.type.toLowerCase()
                  ? 'bg-primary-container/40 text-on-secondary-fixed-variant font-semibold'
                  : 'bg-surface-container text-on-surface-variant'
              "
              >#{{ tag.name }}</span
            >
          }
        </div>
      </td>

      <!-- TACTICAL TOGGLE SWITCH & ACTIONS -->
      <td class="py-3 px-4 align-middle text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-2.5">
          <!-- Tactical Power Switch -->
          <div class="flex items-center gap-1.5">
            <span class="font-label-code-sm text-[11px] text-outline font-medium">
              {{ ((state.isActive$ | async) ?? false) ? ('row.switchOn' | trans) : ('row.switchOff' | trans) }}
            </span>
            <button
              type="button"
              (click)="toggle.emit(flow.id)"
              [attr.aria-label]="((state.isActive$ | async) ?? false) ? i18n.t('row.deactivateFlow', { name: display.name }) : i18n.t('row.activateFlow', { name: display.name })"
              [title]="((state.isActive$ | async) ?? false) ? ('row.clickToPause' | trans) : ('row.clickToActivate' | trans)"
              class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              [class]="
                ((state.isActive$ | async) ?? false)
                  ? 'bg-success shadow-[0_0_8px_rgb(var(--c-success)/0.4)]'
                  : 'bg-surface-container-high hover:bg-surface-container-highest'
              "
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface-container-lowest shadow-sm transition duration-200 ease-in-out"
                [class]="((state.isActive$ | async) ?? false) ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>

          <!-- Manage Menu -->
          <button
            type="button"
            (click)="manage.emit(flow.id)"
            [title]="'row.manageRules' | trans"
            class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-base">tune</span>
          </button>
        </div>
      </td>
    }
  `,
})
export class FlowRowComponent {
  protected readonly i18n = inject(I18nService);
  readonly FlowType = FlowType;

  @Input({ required: true }) state!: FlowRowState;
  @Output() toggle = new EventEmitter<string>();
  @Output() manage = new EventEmitter<string>();
  @Output() fsmTransition = new EventEmitter<FsmTransitionEvent>();

  typeUi(type: FlowType) {
    return getFlowTypeUi(type, this.i18n);
  }

  flowDisplay(flow: Flow) {
    return this.i18n.translateFlow(flow);
  }

  format = formatDuration;

  getIntentClass(intent?: string): string {
    switch (intent) {
      case 'primary':
        return 'bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim';
      case 'danger':
        return 'bg-error-container text-on-error-container hover:opacity-90';
      case 'secondary':
        return 'bg-secondary-container text-on-secondary-container hover:opacity-90';
      default:
        return 'bg-surface-container text-on-surface hover:bg-surface-container-high';
    }
  }
}
