import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateFlowPayload, FlowType, Folder } from '../../core/models/flow.models';

interface FlowTypeOption {
  type: FlowType;
  icon: string;
}

const FLOW_TYPE_OPTIONS: FlowTypeOption[] = [
  { type: FlowType.MUTEX, icon: 'lock' },
  { type: FlowType.FSM, icon: 'schema' },
  { type: FlowType.TIMER, icon: 'timer' },
  { type: FlowType.OBSERVER, icon: 'bolt' },
  { type: FlowType.CONTEXT, icon: 'psychology' },
];

const FSM_TEMPLATES: Record<string, { label: string; config: unknown }> = {
  deepWork: {
    label: 'Deep Work (Idle ➔ Focusing ➔ Break)',
    config: {
      initial: 'idle',
      states: {
        idle: {
          label: 'Idle',
          badgeColor: '#9ca3af',
          transitions: [
            { event: 'START', target: 'focusing', ui: { buttonLabel: 'Start Focus', icon: 'play_arrow', intent: 'primary' } },
          ],
        },
        focusing: {
          label: 'Focusing',
          badgeColor: '#16a34a',
          transitions: [
            { event: 'BREAK', target: 'break', ui: { buttonLabel: 'Take Break', icon: 'coffee', intent: 'secondary' } },
            { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
          ],
        },
        break: {
          label: 'On Break',
          badgeColor: '#f59e0b',
          transitions: [
            { event: 'RESUME', target: 'focusing', ui: { buttonLabel: 'Resume', icon: 'play_arrow', intent: 'primary' } },
            { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
          ],
        },
      },
    },
  },
  approval: {
    label: 'Approval Pipeline (Draft ➔ Review ➔ Approved)',
    config: {
      initial: 'draft',
      states: {
        draft: {
          label: 'Draft',
          badgeColor: '#9ca3af',
          transitions: [
            { event: 'SUBMIT', target: 'in_review', ui: { buttonLabel: 'Submit Review', icon: 'send', intent: 'primary' } },
          ],
        },
        in_review: {
          label: 'In Review',
          badgeColor: '#3b82f6',
          transitions: [
            { event: 'APPROVE', target: 'approved', ui: { buttonLabel: 'Approve', icon: 'check', intent: 'primary' } },
            { event: 'REJECT', target: 'draft', ui: { buttonLabel: 'Reject', icon: 'close', intent: 'danger' } },
          ],
        },
        approved: {
          label: 'Approved',
          badgeColor: '#16a34a',
          transitions: [
            { event: 'RESET', target: 'draft', ui: { buttonLabel: 'New Draft', icon: 'refresh', intent: 'secondary' } },
          ],
        },
      },
    },
  },
  operational: {
    label: 'Standard Switch (Standby ➔ Active)',
    config: {
      initial: 'standby',
      states: {
        standby: {
          label: 'Standby',
          badgeColor: '#9ca3af',
          transitions: [
            { event: 'ENGAGE', target: 'active', ui: { buttonLabel: 'Engage', icon: 'play_arrow', intent: 'primary' } },
          ],
        },
        active: {
          label: 'Active',
          badgeColor: '#16a34a',
          transitions: [
            { event: 'DISENGAGE', target: 'standby', ui: { buttonLabel: 'Disengage', icon: 'stop', intent: 'secondary' } },
          ],
        },
      },
    },
  },
};

@Component({
  selector: 'app-create-flow-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flow-title"
    >
      <div
        #dialogContent
        class="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col"
      >
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/40">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-container/60 text-on-primary-container flex items-center justify-center shadow-xs">
              <span class="material-symbols-rounded text-xl">alt_route</span>
            </div>
            <div>
              <h2 id="create-flow-title" class="font-headline-sm text-base text-on-surface font-bold">
                {{ 'createModal.title' | trans }}
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                {{ 'createModal.subtitle' | trans }}
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            [attr.aria-label]="'createModal.closeAria' | trans"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="submit()" class="p-6 flex flex-col gap-5 overflow-y-auto max-h-[calc(85vh-140px)]">
          <!-- Flow Name -->
          <div class="flex flex-col gap-1.5">
            <label for="flowName" class="font-label-ui text-xs font-bold text-on-surface flex items-center gap-1">
              <span>{{ 'createModal.nameLabel' | trans }}</span>
              <span class="text-error">*</span>
            </label>
            <input
              id="flowName"
              #nameInput
              type="text"
              name="name"
              [(ngModel)]="name"
              [placeholder]="'createModal.namePlaceholder' | trans"
              required
              maxlength="200"
              class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all"
            />
          </div>

          <!-- Description / Purpose -->
          <div class="flex flex-col gap-1.5">
            <label for="flowDesc" class="font-label-ui text-xs font-bold text-on-surface">
              {{ 'createModal.descLabel' | trans }}
            </label>
            <textarea
              id="flowDesc"
              name="description"
              [(ngModel)]="description"
              rows="2"
              [placeholder]="'createModal.descPlaceholder' | trans"
              class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all resize-none"
            ></textarea>
          </div>

          <!-- Architecture Type -->
          <div class="flex flex-col gap-2">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              {{ 'createModal.archTypeLabel' | trans }}
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              @for (opt of typeOptions; track opt.type) {
                <button
                  type="button"
                  (click)="selectedType = opt.type"
                  class="flex flex-col p-2.5 rounded-xl border text-left transition-all relative"
                  [class]="
                    selectedType === opt.type
                      ? 'bg-primary-container/20 border-primary-container text-on-surface ring-2 ring-primary-container shadow-xs'
                      : 'bg-surface-container-low/60 hover:bg-surface-container-low border-outline-variant/20 text-on-surface-variant'
                  "
                >
                  <div class="flex items-center gap-1.5 mb-1">
                    <span
                      class="material-symbols-rounded text-sm"
                      [class]="selectedType === opt.type ? 'text-on-primary-container font-bold' : 'text-on-surface-variant'"
                    >
                      {{ opt.icon }}
                    </span>
                    <span
                      class="font-label-ui text-xs font-semibold"
                      [class]="selectedType === opt.type ? 'text-on-surface font-bold' : 'text-on-surface'"
                    >
                      {{ getTypeLabel(opt.type) }}
                    </span>
                  </div>
                  <span class="font-body-sm text-[11px] text-on-surface-variant leading-tight">
                    {{ getTypeDescription(opt.type) }}
                  </span>
                </button>
              }
            </div>
          </div>

          <!-- Domain Folder & Concurrency Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Target Folder -->
            <div class="flex flex-col gap-1.5">
              <label for="flowFolder" class="font-label-ui text-xs font-bold text-on-surface">
                {{ 'createModal.folderLabel' | trans }}
              </label>
              <select
                id="flowFolder"
                name="folderId"
                [(ngModel)]="folderId"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low text-on-surface font-label-ui text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all"
              >
                <option [ngValue]="null">{{ 'createModal.rootOption' | trans }}</option>
                @for (folder of folders; track folder.id) {
                  <option [ngValue]="folder.id">📁 {{ folder.path }} ({{ i18n.translateFolder(folder.name) }})</option>
                }
              </select>
            </div>

            <!-- Tags -->
            <div class="flex flex-col gap-1.5">
              <label for="flowTags" class="font-label-ui text-xs font-bold text-on-surface">
                {{ 'createModal.tagsLabel' | trans }}
              </label>
              <input
                id="flowTags"
                type="text"
                name="tagsString"
                [(ngModel)]="tagsString"
                [placeholder]="'createModal.tagsPlaceholder' | trans"
                class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all"
              />
              <!-- Tag chips preview -->
              @if (parsedTags.length) {
                <div class="flex items-center gap-1 flex-wrap pt-0.5">
                  @for (tag of parsedTags; track tag) {
                    <span class="px-2 py-0.5 rounded-full font-label-code-sm text-[10px] bg-surface-container text-on-surface-variant">
                      #{{ tag }}
                    </span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Mutex & Exclusivity Controls -->
          <div class="p-3.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="font-label-ui text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span class="material-symbols-rounded text-sm text-warning">lock</span>
                  <span>{{ 'createModal.exclusiveTitle' | trans }}</span>
                </span>
                <span class="font-body-sm text-[11px] text-on-surface-variant">
                  {{ 'createModal.exclusiveDesc' | trans }}
                </span>
              </div>
              <!-- Switch toggle -->
              <button
                type="button"
                (click)="isExclusive = !isExclusive"
                class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                [class]="isExclusive ? 'bg-primary-container shadow-xs' : 'bg-surface-container-high'"
                role="switch"
                [attr.aria-checked]="isExclusive"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface-container-lowest shadow-sm transition duration-200 ease-in-out"
                  [class]="isExclusive ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>

            @if (isExclusive) {
              <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-3">
                <span class="font-label-ui text-xs text-on-surface-variant font-medium">
                  {{ 'createModal.onConflictLabel' | trans }}
                </span>
                <select
                  name="onConflict"
                  [(ngModel)]="onConflict"
                  class="px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-ui text-xs focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/20"
                >
                  <option value="reject">{{ 'createModal.onConflictReject' | trans }}</option>
                  <option value="pause">{{ 'createModal.onConflictPause' | trans }}</option>
                </select>
              </div>
            }
          </div>

          <!-- Type-Specific Dynamic Options -->
          @if (selectedType === FlowType.TIMER) {
            <div class="p-3.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col gap-2">
              <label for="timerInterval" class="font-label-ui text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm">schedule</span>
                <span>{{ 'createModal.timerIntervalLabel' | trans }}</span>
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="timerInterval"
                  type="number"
                  name="intervalSeconds"
                  [(ngModel)]="timerIntervalSeconds"
                  min="5"
                  step="5"
                  class="w-32 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-code-sm text-xs focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/20"
                />
                <div class="flex items-center gap-1.5">
                  @for (preset of [60, 300, 1800, 3300]; track preset) {
                    <button
                      type="button"
                      (click)="timerIntervalSeconds = preset"
                      class="px-2 py-1 rounded font-label-code-sm text-[10px] transition-colors"
                      [class]="
                        timerIntervalSeconds === preset
                          ? 'bg-primary-container text-on-primary-container font-bold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      "
                    >
                      {{ preset }}s
                    </button>
                  }
                </div>
              </div>
            </div>
          }

          @if (selectedType === FlowType.FSM) {
            <div class="p-3.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col gap-2.5">
              <label for="fsmTemplate" class="font-label-ui text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm">account_tree</span>
                <span>{{ 'createModal.fsmTemplateLabel' | trans }}</span>
              </label>
              <select
                id="fsmTemplate"
                name="fsmTemplate"
                [(ngModel)]="selectedFsmTemplate"
                class="w-full px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-ui text-xs focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/20"
              >
                @for (entry of fsmTemplateEntries; track entry.key) {
                  <option [value]="entry.key">{{ getFsmTemplateLabel(entry.key) }}</option>
                }
              </select>
              <p class="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
                {{ 'createModal.fsmTemplateHint' | trans }}
              </p>
            </div>
          }
        </form>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-outline-variant/20 flex items-center justify-end gap-3 bg-surface-container-low/40">
          <button
            type="button"
            (click)="close.emit()"
            class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-ui text-xs font-medium transition-colors"
          >
            {{ 'createModal.cancel' | trans }}
          </button>
          <button
            type="button"
            (click)="submit()"
            [disabled]="!name.trim() || isSubmitting"
            class="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim disabled:opacity-50 text-on-primary-container font-headline-sm text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95"
          >
            @if (isSubmitting) {
              <span class="material-symbols-rounded text-sm animate-spin">progress_activity</span>
              <span>{{ 'createModal.creating' | trans }}</span>
            } @else {
              <span class="material-symbols-rounded text-sm">add</span>
              <span>{{ 'createModal.submit' | trans }}</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CreateFlowModalComponent implements OnInit {
  private readonly hostRef = inject(ElementRef);
  protected readonly i18n = inject(I18nService);

  readonly FlowType = FlowType;
  readonly typeOptions = FLOW_TYPE_OPTIONS;
  readonly fsmTemplateEntries = Object.entries(FSM_TEMPLATES).map(([key, val]) => ({
    key,
    label: val.label,
  }));

  @Input() folders: Folder[] = [];
  @Input() initialFolderId: string | null = null;
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitFlow = new EventEmitter<CreateFlowPayload>();

  name = '';
  description = '';
  selectedType: FlowType = FlowType.MUTEX;
  folderId: string | null = null;
  tagsString = '';
  isExclusive = false;
  onConflict: 'reject' | 'pause' = 'reject';
  timerIntervalSeconds = 3300;
  selectedFsmTemplate = 'deepWork';

  ngOnInit(): void {
    if (this.initialFolderId) {
      this.folderId = this.initialFolderId;
    }
  }

  getTypeLabel(type: FlowType): string {
    switch (type) {
      case FlowType.MUTEX:
        return this.i18n.t('createModal.types.mutex.label');
      case FlowType.FSM:
        return this.i18n.t('createModal.types.fsm.label');
      case FlowType.TIMER:
        return this.i18n.t('createModal.types.timer.label');
      case FlowType.OBSERVER:
        return this.i18n.t('createModal.types.observer.label');
      case FlowType.CONTEXT:
        return this.i18n.t('createModal.types.context.label');
    }
  }

  getTypeDescription(type: FlowType): string {
    switch (type) {
      case FlowType.MUTEX:
        return this.i18n.t('createModal.types.mutex.desc');
      case FlowType.FSM:
        return this.i18n.t('createModal.types.fsm.desc');
      case FlowType.TIMER:
        return this.i18n.t('createModal.types.timer.desc');
      case FlowType.OBSERVER:
        return this.i18n.t('createModal.types.observer.desc');
      case FlowType.CONTEXT:
        return this.i18n.t('createModal.types.context.desc');
    }
  }

  getFsmTemplateLabel(key: string): string {
    switch (key) {
      case 'deepWork':
        return this.i18n.t('createModal.fsmTemplates.deepWork');
      case 'approval':
        return this.i18n.t('createModal.fsmTemplates.approval');
      case 'operational':
        return this.i18n.t('createModal.fsmTemplates.operational');
      default:
        return key;
    }
  }

  get parsedTags(): string[] {
    return this.tagsString
      .split(/[,;\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  @HostListener('click', ['$event'])
  onBackdropClick(event: MouseEvent): void {
    const dialog = this.hostRef.nativeElement.querySelector('#dialogContent') || this.hostRef.nativeElement.firstElementChild?.firstElementChild;
    if (dialog && !dialog.contains(event.target as Node)) {
      this.close.emit();
    }
  }

  submit(): void {
    if (!this.name.trim() || this.isSubmitting) return;

    let config: unknown = undefined;
    if (this.selectedType === FlowType.TIMER) {
      config = { intervalSeconds: Number(this.timerIntervalSeconds) || 3300 };
    } else if (this.selectedType === FlowType.FSM) {
      config = FSM_TEMPLATES[this.selectedFsmTemplate]?.config;
    }

    const payload: CreateFlowPayload = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      type: this.selectedType,
      isExclusive: this.isExclusive,
      folderId: this.folderId || null,
      tags: this.parsedTags.length ? this.parsedTags : undefined,
      config,
      orchestratorRules: this.isExclusive ? { onConflict: this.onConflict } : undefined,
    };

    this.submitFlow.emit(payload);
  }
}
