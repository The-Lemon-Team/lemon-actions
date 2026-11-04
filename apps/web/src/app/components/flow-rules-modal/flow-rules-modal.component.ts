import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Flow, FlowEventRecord, FlowSessionRecord } from '../../core/models/flow.models';
import { FlowOrchestratorService } from '../../core/services/flow-orchestrator.service';

@Component({
  selector: 'app-flow-rules-modal',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 backdrop-blur-xs p-4"
      (click)="close.emit()"
    >
      <div
        class="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- HEADER -->
        <div class="px-6 py-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container">
              <span class="material-symbols-rounded text-xl">tune</span>
            </div>
            <div>
              <h2 class="font-headline-sm text-base font-bold text-on-surface">
                {{ flow.name }}
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Правила потока (Scheduled Mutex, Lease) и непрерывная хроника событий
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="close.emit()"
            class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <!-- BODY -->
        <div class="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          <!-- 1. SCHEDULED MUTEX WINDOW -->
          <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/25 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-base text-warning">schedule</span>
                <div>
                  <h3 class="font-headline-sm text-xs font-bold text-on-surface">Scheduled Mutex (Окно расписания)</h3>
                  <p class="font-body-sm text-[11px] text-on-surface-variant">
                    Размечает начало и конец сессии во времени (flow_sessions), не отсекая поток событий нейрона
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                [(ngModel)]="scheduleEnabled"
                class="w-4 h-4 accent-primary-container rounded cursor-pointer"
              />
            </div>

            @if (scheduleEnabled) {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/20">
                <div>
                  <label class="block font-label-ui text-xs text-on-surface-variant mb-1">Начало окна (HH:mm)</label>
                  <input
                    type="time"
                    [(ngModel)]="scheduleStart"
                    class="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label class="block font-label-ui text-xs text-on-surface-variant mb-1">Окончание окна (HH:mm)</label>
                  <input
                    type="time"
                    [(ngModel)]="scheduleEnd"
                    class="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
                  />
                </div>
              </div>
            }
          </div>

          <!-- 2. EXCLUSIVITY & LEASE TIMEOUT -->
          <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/25 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="chk-exclusive"
                [(ngModel)]="isExclusive"
                class="w-4 h-4 accent-primary-container rounded cursor-pointer"
              />
              <label for="chk-exclusive" class="font-label-ui text-xs font-semibold text-on-surface cursor-pointer">
                Эксклюзивный Mutex в папке
              </label>
            </div>

            <div>
              <label class="block font-label-ui text-[11px] text-on-surface-variant mb-1">При конфликте</label>
              <select
                [(ngModel)]="onConflict"
                class="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
              >
                <option value="reject">Отклонять (409 Reject)</option>
                <option value="pause">Ставить другие на паузу (Pause)</option>
              </select>
            </div>

            <div>
              <label class="block font-label-ui text-[11px] text-on-surface-variant mb-1">Таймаут аренды (Lease, сек)</label>
              <input
                type="number"
                [(ngModel)]="leaseTimeoutSeconds"
                min="0"
                placeholder="0 (без таймаута)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
              />
            </div>
          </div>

          <!-- 3. CHRONICLE: SESSIONS & EVENTS -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Sessions History -->
            <div class="bg-surface-container-low/70 rounded-xl p-3.5 border border-outline-variant/25 flex flex-col gap-2">
              <span class="font-headline-sm text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm text-primary">history</span>
                <span>Окна сессий ({{ sessions.length }})</span>
              </span>

              <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                @for (s of sessions; track s.id) {
                  <div class="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-[11px] flex flex-col gap-0.5">
                    <div class="flex items-center justify-between font-label-code-sm">
                      <span class="text-on-surface font-semibold">{{ formatTime(s.startedAt) }}</span>
                      <span>→</span>
                      <span [class]="s.endedAt ? 'text-on-surface-variant' : 'text-success font-bold'">
                        {{ s.endedAt ? formatTime(s.endedAt) : 'ACTIVE' }}
                      </span>
                    </div>
                    @if (s.closedBy) {
                      <span class="text-[10px] text-outline font-label-code-sm">closed_by: {{ s.closedBy }}</span>
                    }
                  </div>
                } @empty {
                  <div class="py-6 text-center text-xs text-on-surface-variant">Сессий пока нет</div>
                }
              </div>
            </div>

            <!-- Unbroken Events Stream -->
            <div class="bg-surface-container-low/70 rounded-xl p-3.5 border border-outline-variant/25 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="font-headline-sm text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span class="material-symbols-rounded text-sm text-secondary">bolt</span>
                  <span>События потока ({{ events.length }})</span>
                </span>
                <button
                  type="button"
                  (click)="onSendTestEvent()"
                  class="px-2 py-0.5 rounded bg-primary-container/60 hover:bg-primary-container text-on-primary-container font-label-code-sm text-[10px] font-bold cursor-pointer"
                >
                  + Тест-сигнал
                </button>
              </div>

              <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                @for (ev of events; track ev.id) {
                  <div class="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-[11px] flex flex-col gap-0.5">
                    <div class="flex items-center justify-between">
                      <span class="font-label-code-sm font-bold text-on-surface">{{ ev.eventType }}</span>
                      <span class="font-label-code-sm text-[10px] text-outline">{{ formatTime(ev.createdAt) }}</span>
                    </div>
                    <span class="text-[10px] text-on-surface-variant font-label-code-sm">
                      source: {{ ev.source }} · active_sessions: {{ ev.activeFlowSessionIds.length }}
                    </span>
                  </div>
                } @empty {
                  <div class="py-6 text-center text-xs text-on-surface-variant">Событий пока нет</div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="px-6 py-3.5 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-end gap-2.5">
          <button
            type="button"
            (click)="close.emit()"
            class="px-4 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-semibold transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            (click)="onSave()"
            class="px-5 py-1.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-sm text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            Сохранить правила
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FlowRulesModalComponent implements OnInit {
  private readonly orchestrator = inject(FlowOrchestratorService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) flow!: Flow;
  @Output() close = new EventEmitter<void>();
  @Output() saveRules = new EventEmitter<{
    flowId: string;
    isExclusive: boolean;
    orchestratorRules: Record<string, unknown>;
  }>();

  isExclusive = false;
  onConflict: 'reject' | 'pause' = 'reject';
  leaseTimeoutSeconds = 0;

  scheduleEnabled = false;
  scheduleStart = '10:00';
  scheduleEnd = '19:00';

  sessions: FlowSessionRecord[] = [];
  events: FlowEventRecord[] = [];

  ngOnInit(): void {
    this.isExclusive = this.flow.isExclusive;
    const rules: any = this.flow.orchestratorRules ?? {};
    this.onConflict = rules.onConflict === 'pause' ? 'pause' : 'reject';
    this.leaseTimeoutSeconds = Number(rules.leaseTimeoutSeconds ?? 0);

    if (rules.schedule) {
      this.scheduleEnabled = rules.schedule.enabled !== false;
      const win = rules.schedule.windows?.[0];
      if (win) {
        this.scheduleStart = win.start || '10:00';
        this.scheduleEnd = win.end || '19:00';
      }
    }

    this.loadChronicle();
  }

  private loadChronicle(): void {
    this.orchestrator.getFlowSessions(this.flow.id).subscribe((s) => {
      this.sessions = s;
      this.cdr.markForCheck();
    });
    this.orchestrator.getFlowEvents(this.flow.id).subscribe((e) => {
      this.events = e;
      this.cdr.markForCheck();
    });
  }

  onSendTestEvent(): void {
    this.orchestrator
      .appendFlowEvent(this.flow.id, {
        source: 'core-ui',
        eventType: 'HEARTBEAT_PULSE',
        payload: { note: 'Manual pulse from Core UI' },
      })
      .subscribe(() => this.loadChronicle());
  }

  onSave(): void {
    const nextRules: Record<string, unknown> = {
      ...(this.flow.orchestratorRules ?? {}),
      onConflict: this.onConflict,
      leaseTimeoutSeconds: this.leaseTimeoutSeconds > 0 ? this.leaseTimeoutSeconds : undefined,
      schedule: this.scheduleEnabled
        ? {
            enabled: true,
            windows: [{ days: [1, 2, 3, 4, 5], start: this.scheduleStart, end: this.scheduleEnd }],
          }
        : undefined,
    };

    this.saveRules.emit({
      flowId: this.flow.id,
      isExclusive: this.isExclusive,
      orchestratorRules: nextRules,
    });
    this.close.emit();
  }

  formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  }
}
