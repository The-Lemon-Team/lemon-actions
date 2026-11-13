import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ActionCondition,
  ActionEffect,
  ActionTrigger,
  LemonCardColor,
  LemonWorkerCard,
} from '../../core/models/worker.models';
import { FlowOrchestratorService } from '../../core/services/flow-orchestrator.service';
import { Flow, Folder } from '../../core/models/flow.models';

@Component({
  selector: 'app-create-worker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
      appModalOverlay
      (overlayClose)="onCancel()"
      aria-labelledby="create-worker-modal-title"
    >
      <div
        class="relative w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden my-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- MODAL HEADER -->
        <header class="px-6 py-4.5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
              <span class="material-symbols-rounded text-lg">bolt</span>
            </div>
            <div>
              <h2 id="create-worker-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                Новый воркер Lemon Actions
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Свяжите поток, настройте правило «Когда — Если — Что» и подключите вебхук
              </p>
            </div>
          </div>

          <!-- Explicit Header Close Button -->
          <button
            type="button"
            (click)="onCancel()"
            aria-label="Закрыть"
            class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </header>

        <!-- MODAL BODY (Scrollable form) -->
        <div class="px-6 py-5 overflow-y-auto flex flex-col gap-5 text-sm">

          <!-- 1. ИМЯ И НЕЙРОН (ПАПКА) -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                1. Имя воркера и Нейрон (Папка)
              </label>
              <!-- Color Selector -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-on-surface-variant">Цвет Keep:</span>
                @for (c of availableColors; track c) {
                  <button
                    type="button"
                    (click)="selectedColor = c"
                    class="w-4.5 h-4.5 rounded-full border border-black/15 transition-transform"
                    [class.ring-2]="selectedColor === c"
                    [class.ring-primary]="selectedColor === c"
                    [class.scale-125]="selectedColor === c"
                    [ngClass]="getColorBg(c)"
                    [title]="c"
                  ></button>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1">Название воркера</label>
                <input
                  type="text"
                  [(ngModel)]="name"
                  placeholder="Например: Daily Reports Dispatcher"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-medium"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1">Целевой Нейрон (Папка)</label>
                <select
                  [(ngModel)]="selectedNeuronPath"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-medium"
                >
                  <option value="workspace.reports">📁 workspace.reports</option>
                  <option value="workspace.core">📁 workspace.core</option>
                  <option value="workspace.analytics">📁 workspace.analytics</option>
                  <option value="home.supplies">📁 home.supplies</option>
                  <option value="agent.cron">📁 agent.cron</option>
                  @for (f of (folders$ | async) ?? []; track f.id) {
                    <option [value]="f.path">📁 {{ f.path }}</option>
                  }
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Описание назначения</label>
              <input
                type="text"
                [(ngModel)]="description"
                placeholder="Что делает данный воркер при срабатывании..."
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
              />
            </div>
          </section>

          <!-- 2. КОГДА (Триггер) -->
          <section class="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container-low/40 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <span class="font-headline-sm text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm">schedule</span>
                2. КОГДА: Триггер запуска
              </span>
              <!-- Trigger kind tabs -->
              <div class="flex items-center gap-1 p-0.5 rounded-lg bg-surface-container-high/60 border border-outline-variant/20">
                <button
                  type="button"
                  (click)="triggerKind = 'TIMER'"
                  class="px-2 py-0.5 rounded-md text-[11px] font-bold transition-all"
                  [class]="triggerKind === 'TIMER' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Таймер / Расписание
                </button>
                <button
                  type="button"
                  (click)="triggerKind = 'WATCHER'"
                  class="px-2 py-0.5 rounded-md text-[11px] font-bold transition-all"
                  [class]="triggerKind === 'WATCHER' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Наблюдатель папки
                </button>
                <button
                  type="button"
                  (click)="triggerKind = 'MANUAL'"
                  class="px-2 py-0.5 rounded-md text-[11px] font-bold transition-all"
                  [class]="triggerKind === 'MANUAL' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Ручной пуск
                </button>
              </div>
            </div>

            @if (triggerKind === 'TIMER') {
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs text-on-surface-variant">Готовые пресеты:</span>
                  <button
                    type="button"
                    (click)="setTimerPreset('5min', 'Каждые 5 минут', '*/5 * * * *', 300000)"
                    class="px-2 py-0.5 rounded-md border text-xs font-label-code-sm hover:bg-surface-container-high transition-colors"
                    [class.border-primary]="timerPreset === '5min'"
                  >
                    ⏱ 5 мин
                  </button>
                  <button
                    type="button"
                    (click)="setTimerPreset('15min', 'Каждые 15 минут', '*/15 * * * *', 900000)"
                    class="px-2 py-0.5 rounded-md border text-xs font-label-code-sm hover:bg-surface-container-high transition-colors"
                    [class.border-primary]="timerPreset === '15min'"
                  >
                    ⏱ 15 мин
                  </button>
                  <button
                    type="button"
                    (click)="setTimerPreset('1hour', 'Каждый час', '0 * * * *', 3600000)"
                    class="px-2 py-0.5 rounded-md border text-xs font-label-code-sm hover:bg-surface-container-high transition-colors"
                    [class.border-primary]="timerPreset === '1hour'"
                  >
                    ⏱ 1 час
                  </button>
                  <button
                    type="button"
                    (click)="setTimerPreset('morning', 'Каждое утро в 09:00', '0 9 * * *', 86400000)"
                    class="px-2 py-0.5 rounded-md border text-xs font-label-code-sm hover:bg-surface-container-high transition-colors"
                    [class.border-primary]="timerPreset === 'morning'"
                  >
                    🌅 В 09:00
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <label class="block text-[11px] text-on-surface-variant mb-0.5">Метка расписания</label>
                    <input
                      type="text"
                      [(ngModel)]="timerLabel"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] text-on-surface-variant mb-0.5">Cron-выражение</label>
                    <input
                      type="text"
                      [(ngModel)]="timerCron"
                      placeholder="e.g. 0 9 * * *"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs font-label-code-sm text-on-surface"
                    />
                  </div>
                </div>
              </div>
            } @else if (triggerKind === 'WATCHER') {
              <div class="text-xs text-on-surface-variant flex items-center gap-2">
                <span class="material-symbols-rounded text-sm text-sky-600">visibility</span>
                <span>Срабатывает при создании/изменении заметок в Нейроне <strong>{{ selectedNeuronPath }}</strong></span>
              </div>
            } @else {
              <div class="text-xs text-on-surface-variant flex items-center gap-2">
                <span class="material-symbols-rounded text-sm text-slate-600">touch_app</span>
                <span>Запуск только по кнопке с карточки или вызову внешнего API</span>
              </div>
            }
          </section>

          <!-- 3. ЕСЛИ (Конструктор связей и условий) -->
          <section class="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container-low/40 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <span class="font-headline-sm text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm">lock_clock</span>
                3. ЕСЛИ: Конструктор связей с потоками
              </span>
              <span class="text-[11px] text-on-surface-variant">Проверка условий перед запуском</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1">Связать с Потоком / Мьютексом</label>
                <input
                  type="text"
                  [(ngModel)]="streamConnectionKey"
                  placeholder="Например: mutex-analytics-sync"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-label-code-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1">Тип проверки</label>
                <select
                  [(ngModel)]="conditionType"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-medium"
                >
                  <option value="MUTEX">Мьютекс: Запустить, только если поток свободен</option>
                  <option value="COOLDOWN">Cooldown: Ограничить частоту запусков</option>
                  <option value="CIRCUIT_BREAKER">Circuit Breaker: Отключать при 3 ошибках</option>
                  <option value="NONE">Без условий: Запускать всегда</option>
                </select>
              </div>
            </div>
          </section>

          <!-- 4. ЧТО (Безопасный Webhook Call) -->
          <section class="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container-low/40 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <span class="font-headline-sm text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span class="material-symbols-rounded text-sm">webhook</span>
                4. ЧТО: Безопасный Webhook Call
              </span>
              <span class="text-[11px] text-emerald-600 font-medium">Безопасное внешнее исполнение</span>
            </div>

            <div class="grid grid-cols-4 gap-2">
              <div class="col-span-1">
                <label class="block text-xs font-medium text-on-surface-variant mb-1">Метод</label>
                <select
                  [(ngModel)]="webhookMethod"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-bold text-xs"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div class="col-span-3">
                <label class="block text-xs font-medium text-on-surface-variant mb-1">URL вебхука</label>
                <input
                  type="text"
                  [(ngModel)]="webhookUrl"
                  placeholder="https://api.external-service.com/hooks/run"
                  class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-label-code-sm text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>
            </div>

            <p class="text-[11px] text-on-surface-variant/80 italic">
              💡 При срабатывании триггера ядро Lemon Actions сделает HTTP-запрос, передаст контекст Нейрона и залогирует время ответа и статус в историю карточки.
            </p>
          </section>

        </div>

        <!-- MODAL FOOTER -->
        <footer class="px-6 py-3.5 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div class="text-xs text-on-surface-variant font-label-code-sm">
            <span>Карточка в стиле Google Keep</span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Explicit Cancel Button -->
            <button
              type="button"
              (click)="onCancel()"
              class="px-4 py-1.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container-high text-on-surface font-headline-sm text-xs font-semibold transition-colors"
            >
              Отмена
            </button>

            <!-- Submit Button -->
            <button
              type="button"
              (click)="onSubmit()"
              [disabled]="!isValid"
              class="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim font-headline-sm text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Создать карточку
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class CreateWorkerModalComponent {
  private readonly orchestrator = inject(FlowOrchestratorService);

  readonly folders$ = this.orchestrator.folders$;

  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<Omit<LemonWorkerCard, 'id' | 'createdAt' | 'updatedAt' | 'telemetry'>>();

  name = '';
  description = '';
  selectedNeuronPath = 'workspace.reports';
  selectedColor: LemonCardColor = 'lemon';

  triggerKind: 'TIMER' | 'WATCHER' | 'MANUAL' = 'TIMER';
  timerPreset = '15min';
  timerLabel = 'Каждые 15 минут';
  timerCron = '*/15 * * * *';
  timerIntervalMs = 900000;

  streamConnectionKey = 'mutex-actions-sync';
  conditionType: 'MUTEX' | 'COOLDOWN' | 'CIRCUIT_BREAKER' | 'NONE' = 'MUTEX';

  webhookMethod: 'POST' | 'GET' | 'PUT' = 'POST';
  webhookUrl = 'https://api.external-service.com/hooks/intake';

  readonly availableColors: LemonCardColor[] = [
    'default',
    'lemon',
    'amber',
    'sage',
    'lavender',
    'sky',
    'rose',
    'slate',
  ];

  get isValid(): boolean {
    return this.name.trim().length > 0 && this.webhookUrl.trim().length > 0;
  }

  setTimerPreset(preset: string, label: string, cron: string, intervalMs: number): void {
    this.timerPreset = preset;
    this.timerLabel = label;
    this.timerCron = cron;
    this.timerIntervalMs = intervalMs;
  }

  onCancel(): void {
    this.resetForm();
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.isValid) return;

    let trigger: ActionTrigger;
    if (this.triggerKind === 'TIMER') {
      trigger = {
        kind: 'TIMER',
        cron: this.timerCron,
        intervalMs: this.timerIntervalMs,
        label: this.timerLabel,
      };
    } else if (this.triggerKind === 'WATCHER') {
      trigger = {
        kind: 'WATCHER',
        targetNeuronId: 'folder-' + this.selectedNeuronPath.replace(/\./g, '-'),
        targetNeuronPath: this.selectedNeuronPath,
        events: ['NOTE_CREATED', 'NOTE_UPDATED'],
      };
    } else {
      trigger = {
        kind: 'MANUAL',
        buttonLabel: 'Запустить ' + this.name,
      };
    }

    let condition: ActionCondition | undefined;
    if (this.conditionType === 'MUTEX') {
      condition = {
        kind: 'MUTEX',
        lockKey: this.streamConnectionKey.trim() || 'mutex-worker-lock',
        onConflict: 'skip',
      };
    } else if (this.conditionType === 'COOLDOWN') {
      condition = {
        kind: 'COOLDOWN',
        cooldownMs: 60000,
        maxRunsPerHour: 30,
      };
    } else if (this.conditionType === 'CIRCUIT_BREAKER') {
      condition = {
        kind: 'CIRCUIT_BREAKER',
        maxConsecutiveFailures: 3,
        resetTimeoutMs: 120000,
      };
    }

    const action: ActionEffect = {
      kind: 'HTTP_REQUEST',
      method: this.webhookMethod,
      url: this.webhookUrl.trim(),
      body: {
        neuron: this.selectedNeuronPath,
        triggeredBy: this.name,
        timestamp: new Date().toISOString(),
      },
    };

    const workerPayload: Omit<LemonWorkerCard, 'id' | 'createdAt' | 'updatedAt' | 'telemetry'> = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      neuronId: 'folder-' + this.selectedNeuronPath.replace(/\./g, '-'),
      neuronPath: this.selectedNeuronPath,
      color: this.selectedColor,
      isPinned: false,
      order: 99,
      tags: ['worker', this.selectedNeuronPath.split('.').pop() || 'action'],
      status: 'IDLE',
      rule: {
        trigger,
        condition,
        action,
      },
    };

    this.create.emit(workerPayload);
    this.resetForm();
    this.close.emit();
  }

  private resetForm(): void {
    this.name = '';
    this.description = '';
    this.selectedColor = 'lemon';
    this.triggerKind = 'TIMER';
    this.setTimerPreset('15min', 'Каждые 15 минут', '*/15 * * * *', 900000);
    this.streamConnectionKey = 'mutex-actions-sync';
    this.conditionType = 'MUTEX';
    this.webhookMethod = 'POST';
    this.webhookUrl = 'https://api.external-service.com/hooks/intake';
  }

  getColorBg(color: LemonCardColor): string {
    switch (color) {
      case 'lemon':
        return 'bg-[#ffe176]';
      case 'amber':
        return 'bg-[#ffb74d]';
      case 'sage':
        return 'bg-[#a5d6a7]';
      case 'lavender':
        return 'bg-[#ce93d8]';
      case 'sky':
        return 'bg-[#81d4fa]';
      case 'rose':
        return 'bg-[#ef9a9a]';
      case 'slate':
        return 'bg-[#b0bec5]';
      default:
        return 'bg-[#ffffff]';
    }
  }
}
