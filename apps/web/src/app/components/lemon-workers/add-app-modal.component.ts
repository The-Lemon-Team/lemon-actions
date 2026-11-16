import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { AppEnvironment, AppNetworkMode } from '../../core/models/health-checker.models';

@Component({
  selector: 'app-add-app-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
      appModalOverlay
      (overlayClose)="onCancel()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-app-title"
    >
      <div
        class="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden my-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- HEADER -->
        <header class="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
              <span class="material-symbols-rounded text-lg">apps</span>
            </div>
            <div>
              <h2 id="add-app-title" class="font-headline-sm text-base font-bold text-on-surface">
                Добавить приложение в стенд
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant">
                Выделите изолированный порт в Port Shield и подключите микросервис
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="onCancel()"
            aria-label="Закрыть"
            class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </header>

        <!-- FORM BODY -->
        <div class="px-6 py-5 overflow-y-auto flex flex-col gap-4 text-sm">
          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Название приложения / узла:
            </label>
            <input
              type="text"
              [(ngModel)]="appName"
              placeholder="например: Calendar - app, Media gateway port"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Роль / Назначение сервиса:
            </label>
            <input
              type="text"
              [(ngModel)]="role"
              placeholder="например: Календарный UI, Стриминг видеопотоков"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <!-- Port & Network -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-ui text-xs font-bold text-on-surface">
                Желаемый порт:
              </label>
              <input
                type="number"
                [(ngModel)]="desiredPort"
                placeholder="Авто (4320+)"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-ui text-xs font-bold text-on-surface">
                Окружение:
              </label>
              <select
                [(ngModel)]="environment"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="dev">DEV (Разработка)</option>
                <option value="staging">STAGING (Тестирование)</option>
                <option value="production">PRODUCTION (Бой)</option>
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Сетевой режим:
            </label>
            <select
              [(ngModel)]="networkMode"
              (ngModelChange)="onNetworkModeChange($event)"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
            >
              <option value="local">Localhost (Локальный хост)</option>
              <option value="lan">LAN (Удаленный хост, напр. 192.168.1.100)</option>
              <option value="tailscale-lan">Tailscale LAN (Защищённая сеть 100.64.x.x)</option>
              <option value="tailscale-funnel">Tailscale Funnel (Публичный туннель HTTPS)</option>
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2">
              <label class="font-label-ui text-xs font-bold text-on-surface">
                Хост / Адрес, где крутится сервис:
              </label>
              <div class="flex items-center gap-1 text-[10px] font-mono">
                <button
                  type="button"
                  (click)="host = 'localhost'; networkMode = 'local'"
                  class="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant cursor-pointer"
                >
                  localhost
                </button>
                <button
                  type="button"
                  (click)="host = '192.168.1.100'; networkMode = 'lan'"
                  class="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant cursor-pointer"
                >
                  192.168.1.100
                </button>
              </div>
            </div>
            <input
              type="text"
              [(ngModel)]="host"
              placeholder="localhost, 192.168.1.100, my-node.ts.net"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
          </div>

          @if (networkMode === 'local') {
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <label class="font-label-ui text-xs font-bold text-on-surface">
                  Компьютер / Рабочая станция (для привязки localhost):
                </label>
                <div class="flex items-center gap-1 text-[10px] font-mono">
                  <button
                    type="button"
                    (click)="machineName = 'PC-1'"
                    class="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant cursor-pointer"
                  >
                    PC-1
                  </button>
                  <button
                    type="button"
                    (click)="machineName = 'PC-2'"
                    class="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant cursor-pointer"
                  >
                    PC-2
                  </button>
                </div>
              </div>
              <input
                type="text"
                [(ngModel)]="machineName"
                [placeholder]="defaultMachineName || 'например: PC-1, PC-2, Laptop-Home'"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          }

          <div class="flex flex-col gap-1.5">
            <label class="font-label-ui text-xs font-bold text-on-surface">
              Кастомный URL эндпоинта (опционально):
            </label>
            <input
              type="text"
              [(ngModel)]="customUrl"
              placeholder="например: https://sportdrop-funnel.ts.net/health"
              class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
          </div>
        </div>

        <!-- FOOTER -->
        <footer class="px-6 py-4 border-t border-outline-variant/20 flex items-center justify-end gap-2 bg-surface-container-low/30">
          <button
            type="button"
            (click)="onCancel()"
            class="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!appName.trim()"
            class="px-5 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold shadow-xs transition-all disabled:opacity-40 cursor-pointer"
          >
            Выделить порт и добавить
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class AddAppModalComponent {
  @Input({ required: true }) standId!: string;
  @Input() defaultMachineName = '';

  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<{
    standId: string;
    appData: {
      appName: string;
      role: string;
      host?: string;
      desiredPort?: number;
      environment: AppEnvironment;
      networkMode: AppNetworkMode;
      machineId?: string;
      machineName?: string;
      customUrl?: string;
    };
  }>();

  appName = '';
  role = '';
  host = 'localhost';
  desiredPort?: number;
  environment: AppEnvironment = 'dev';
  networkMode: AppNetworkMode = 'local';
  machineName = '';
  customUrl = '';

  onNetworkModeChange(mode: AppNetworkMode): void {
    if (mode === 'lan' && (!this.host || this.host === 'localhost')) {
      this.host = '192.168.1.100';
    } else if (mode === 'local' && this.host === '192.168.1.100') {
      this.host = 'localhost';
    }
  }

  onCancel(): void {
    this.resetState();
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.appName.trim()) return;
    const resolvedMachineName = (this.machineName.trim() || this.defaultMachineName.trim()) || undefined;
    const resolvedMachineId = resolvedMachineName
      ? resolvedMachineName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
      : undefined;

    this.add.emit({
      standId: this.standId,
      appData: {
        appName: this.appName.trim(),
        role: this.role.trim() || 'Микросервис стенда',
        host: this.host.trim() || undefined,
        desiredPort: this.desiredPort && this.desiredPort > 0 ? this.desiredPort : undefined,
        environment: this.environment,
        networkMode: this.networkMode,
        ...(this.networkMode === 'local' && resolvedMachineId
          ? { machineId: resolvedMachineId, machineName: resolvedMachineName }
          : {}),
        customUrl: this.customUrl.trim() || undefined,
      },
    });

    this.resetState();
  }

  private resetState(): void {
    this.appName = '';
    this.role = '';
    this.host = 'localhost';
    this.desiredPort = undefined;
    this.environment = 'dev';
    this.networkMode = 'local';
    this.machineName = '';
    this.customUrl = '';
  }
}
