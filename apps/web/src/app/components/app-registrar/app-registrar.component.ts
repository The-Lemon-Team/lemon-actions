import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceHealthService } from '../../core/services/service-health.service';
import {
  AppEnvironment,
  AppNetworkMode,
  ServiceHealthItemState,
} from '../../core/models/health-checker.models';

@Component({
  selector: 'app-registrar-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (healthService.projection$ | async; as proj) {
      <div class="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-16">

        <!-- 1. SHIELD HEADER HERO -->
        <header class="relative p-6 md:p-8 rounded-3xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-primary-container/10 border border-outline-variant/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md flex-shrink-0">
              <span class="material-symbols-rounded text-3xl">verified_user</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="font-headline-sm text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
                  Lemon App Registrar & Port Shield
                </h1>
                <span class="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-black uppercase tracking-wider font-label-code-sm">
                  STANDALONE PACKAGE
                </span>
              </div>
              <p class="font-body-sm text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
                Шилд-регистратор приложений и живой пул сервисов. Выдаёт изолированные порты и токены инстансов для автономных агентов, исключая замещение портов в средах Dev, Staging, Prod и сетях Tailscale.
              </p>
            </div>
          </div>

          <!-- Live Shield Badges -->
          <div class="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <div class="px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-black/30 border border-black/[0.06] flex items-center gap-2.5 shadow-2xs">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div class="flex flex-col">
                <span class="font-headline-sm text-xs font-bold text-on-surface">{{ proj.healthyCount }} из {{ proj.totalServices }} Активны</span>
                <span class="font-label-code-sm text-[10px] text-on-surface-variant font-medium">Шилд портов активен</span>
              </div>
            </div>

            <button
              type="button"
              (click)="healthService.pingAll()"
              [disabled]="isPinging$ | async"
              class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold font-headline-sm shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <span class="material-symbols-rounded text-base" [class.animate-spin]="isPinging$ | async">
                {{ (isPinging$ | async) ? 'refresh' : 'network_check' }}
              </span>
              <span>{{ (isPinging$ | async) ? 'Проверка...' : 'Пинг всех' }}</span>
            </button>
          </div>
        </header>

        <!-- 2. REGISTRATION FORM (Форма регистрации приложений агента) -->
        <section class="p-6 rounded-3xl bg-surface-container-low/70 border border-outline-variant/30 flex flex-col gap-4 shadow-2xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
                <span class="material-symbols-rounded text-lg">app_registration</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-sm font-bold text-on-surface">
                  Зарегистрировать приложение агента
                </h3>
                <p class="font-body-sm text-xs text-on-surface-variant">
                  Выделите порт, привяжите среду (Dev/Stg/Prod) и маршрут (Localhost / Tailscale)
                </p>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-code-sm text-[11px] font-medium">
              Пул портов: 4301+ • Circuit Breaker: 5 сбоев
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <!-- App Name Input -->
            <div class="lg:col-span-1">
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Имя приложения агента</label>
              <input
                type="text"
                [(ngModel)]="newAppName"
                placeholder="e.g. data-analyzer-01, crawler..."
                class="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface font-medium placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <!-- Custom Port (Optional) -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Порт (авто: 4301+)</label>
              <input
                type="number"
                [(ngModel)]="newAppPort"
                placeholder="4301+"
                class="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-label-code-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <!-- Environment Selector -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Окружение</label>
              <div class="flex items-center gap-1 p-0.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/20">
                <button
                  type="button"
                  (click)="newEnvironment = 'dev'"
                  class="flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'dev' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Dev
                </button>
                <button
                  type="button"
                  (click)="newEnvironment = 'staging'"
                  class="flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'staging' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Stg
                </button>
                <button
                  type="button"
                  (click)="newEnvironment = 'production'"
                  class="flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'production' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Prod
                </button>
              </div>
            </div>

            <!-- Network Mode Selector -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Сетевой маршрут</label>
              <select
                [(ngModel)]="newNetworkMode"
                class="w-full px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="local">💻 Localhost</option>
                <option value="tailscale-lan">🔒 Tailscale LAN (100.x)</option>
                <option value="tailscale-funnel">🌐 Tailscale Funnel (HTTPS)</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end pt-1">
            <button
              type="button"
              (click)="onRegisterApp()"
              [disabled]="!newAppName.trim()"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold font-headline-sm shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-rounded text-base">rocket_launch</span>
              <span>Зарегистрировать приложение и выдать токен</span>
            </button>
          </div>
        </section>

        <!-- 3. LIVE POOL CARD -->
        <article class="p-6 md:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-5">
          <!-- Filter Ribbon -->
          <div class="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2">Фильтр сред:</span>
              <button
                type="button"
                (click)="filterEnv = 'ALL'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                [class]="filterEnv === 'ALL' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
              >
                Все ({{ proj.services.length }})
              </button>
              <button
                type="button"
                (click)="filterEnv = 'dev'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'dev' ? 'bg-teal-500/20 text-teal-900 dark:text-teal-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                <span>DEV</span>
              </button>
              <button
                type="button"
                (click)="filterEnv = 'staging'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'staging' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>STAGING</span>
              </button>
              <button
                type="button"
                (click)="filterEnv = 'production'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'production' ? 'bg-purple-500/20 text-purple-900 dark:text-purple-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>PRODUCTION</span>
              </button>
            </div>

            <div class="flex items-center gap-1.5 text-xs text-on-surface-variant font-label-code-sm pr-2">
              <span>Сеть:</span>
              <select
                [(ngModel)]="filterNetwork"
                class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none"
              >
                <option value="ALL">Все сети</option>
                <option value="local">💻 Localhost</option>
                <option value="tailscale-lan">🔒 Tailscale LAN</option>
                <option value="tailscale-funnel">🌐 Tailscale Funnel</option>
              </select>
            </div>
          </div>

          <!-- Services List -->
          <div class="flex flex-col gap-3">
            @for (svc of filteredServices(proj.services); track svc.context.id) {
              <div
                class="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-4.5 rounded-2xl bg-surface-container-low/40 border transition-all hover:shadow-xs"
                [ngClass]="svc.currentStatus === 'DEGRADED' ? 'border-amber-400 bg-amber-50/40' : 'border-outline-variant/20'"
              >
                <!-- Left: Status dot + Icon + App Name + Badges + Token -->
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      [class.bg-emerald-500]="svc.currentStatus === 'HEALTHY'"
                      [class.bg-amber-400]="svc.currentStatus === 'CHECKING'"
                      [class.bg-rose-500]="svc.currentStatus === 'DEGRADED'"
                      [class.animate-ping]="svc.currentStatus === 'CHECKING'"
                    ></span>
                  </div>

                  <div class="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant flex-shrink-0">
                    <span class="material-symbols-rounded text-xl">{{ svc.context.icon || 'lan' }}</span>
                  </div>

                  <div class="min-w-0 flex flex-col gap-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-headline-sm text-sm font-bold text-on-surface truncate">
                        {{ svc.context.appName }}
                      </span>

                      <!-- Environment Badge -->
                      <span
                        class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-label-code-sm"
                        [ngClass]="getEnvBadgeClass(svc.context.environment)"
                      >
                        {{ svc.context.environment }}
                      </span>

                      <!-- Network Mode Badge -->
                      <span
                        class="px-2 py-0.5 rounded-md text-[10px] font-bold font-label-code-sm flex items-center gap-1"
                        [ngClass]="getNetworkBadgeClass(svc.context.networkMode)"
                      >
                        <span class="material-symbols-rounded text-xs">{{ getNetworkIcon(svc.context.networkMode) }}</span>
                        <span>{{ getNetworkLabel(svc.context.networkMode) }}</span>
                      </span>

                      <!-- Port Badge -->
                      <span class="px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container text-xs font-bold font-label-code-sm">
                        :{{ svc.context.port }}
                      </span>

                      <span class="text-[11px] text-on-surface-variant/70 font-label-code-sm" [title]="'Инстанс: ' + svc.context.instanceId">
                        {{ svc.context.instanceId }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 text-xs text-on-surface-variant/80 font-label-code-sm truncate">
                      <span class="truncate font-medium text-on-surface/90">{{ svc.context.url }}</span>
                      <span>•</span>
                      <span class="text-primary font-medium truncate" [title]="'Lease Token: ' + svc.context.leaseToken">
                        🔑 {{ svc.context.leaseToken }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Right: Failure Counter + History Dots + Action Controls -->
                <div class="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/15">
                  @if (svc.consecutiveFailures > 0) {
                    <div class="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-label-code-sm text-xs font-bold flex items-center gap-1 animate-pulse">
                      <span class="material-symbols-rounded text-sm">warning</span>
                      <span>{{ svc.consecutiveFailures }} / {{ svc.maxFailuresBeforeEviction }} сбоев</span>
                    </div>
                  } @else {
                    <div class="hidden sm:flex items-center gap-1 font-label-code-sm text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      <span class="material-symbols-rounded text-sm">check_circle</span>
                      <span>0 сбоев</span>
                    </div>
                  }

                  <div class="flex items-center gap-1" title="История последних проверок">
                    @for (item of svc.history; track item.id) {
                      <span
                        class="w-2 h-2 rounded-full transition-transform hover:scale-150"
                        [class.bg-emerald-500]="item.status === 'UP'"
                        [class.bg-rose-500]="item.status === 'DOWN'"
                        [class.bg-amber-400]="item.status === 'DEGRADED'"
                        [title]="item.statusCode + ' • ' + item.latencyMs + 'ms'"
                      ></span>
                    }
                  </div>

                  <div
                    class="px-2.5 py-1 rounded-lg bg-surface-container-high font-label-code-sm text-xs font-bold text-on-surface min-w-[54px] text-center"
                    [class.text-emerald-700]="svc.lastLatencyMs < 40"
                    [class.text-amber-700]="svc.lastLatencyMs >= 40 && svc.lastLatencyMs < 100"
                    [class.text-rose-700]="svc.lastLatencyMs >= 100"
                  >
                    {{ svc.lastLatencyMs }}ms
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      (click)="healthService.pingSingle(svc.context.id)"
                      [disabled]="svc.currentStatus === 'CHECKING'"
                      class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Проверить / Продлить аренду"
                    >
                      <span class="material-symbols-rounded text-sm" [class.animate-spin]="svc.currentStatus === 'CHECKING'">
                        refresh
                      </span>
                    </button>

                    <button
                      type="button"
                      (click)="healthService.simulateFailure(svc.context.id)"
                      class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Имитировать сбой (увеличить счётчик ошибок)"
                    >
                      <span class="material-symbols-rounded text-sm">flash_off</span>
                    </button>

                    <button
                      type="button"
                      (click)="healthService.releaseApp(svc.context.id)"
                      class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Завершить работу агента (освободить порт)"
                    >
                      <span class="material-symbols-rounded text-sm">stop_circle</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        </article>

        <!-- 4. EVICTED SERVICES ARCHIVE -->
        @if (proj.evictedServices.length > 0) {
          <section class="p-6 rounded-3xl bg-surface-container-low/50 border border-rose-500/20 flex flex-col gap-3">
            <div class="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-headline-sm text-xs font-bold uppercase tracking-wider">
              <span class="material-symbols-rounded text-base">delete_sweep</span>
              <span>Вытесненные приложения (Circuit Breaker Tripped • {{ proj.evictedServices.length }})</span>
            </div>
            <div class="flex flex-col gap-2">
              @for (ev of proj.evictedServices; track ev.context.id) {
                <div class="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest text-xs font-label-code-sm text-on-surface-variant border border-outline-variant/20">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                    <strong class="text-on-surface">{{ ev.context.appName }}</strong>
                    <span class="px-1.5 py-0.2 rounded bg-surface-container text-[10px] uppercase font-bold">{{ ev.context.environment }}</span>
                    <span>(порт :{{ ev.context.port }} освобождён)</span>
                    <span class="text-outline/40">•</span>
                    <span>Токен {{ ev.context.leaseToken }} аннулирован</span>
                  </div>
                  <span class="text-rose-600 font-semibold">{{ ev.consecutiveFailures }} сбоев подряд</span>
                </div>
              }
            </div>
          </section>
        }

        <!-- 5. CHRONICLE (Нейрон Истории) -->
        <section class="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-base text-primary">history_edu</span>
              <div>
                <h3 class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface">
                  Нейрон Истории ({{ proj.historyNeuronPath }})
                </h3>
                <p class="font-body-sm text-[11px] text-on-surface-variant">
                  Хроника жизненного цикла: среды Dev/Staging/Prod, маршруты Tailscale, выделение портов и вытеснение
                </p>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-code-sm text-[11px]">
              {{ proj.chronicle.length }} событий
            </span>
          </div>

          <div class="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            @for (item of proj.chronicle; track item.id) {
              <div class="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 text-xs font-label-code-sm">
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase flex-shrink-0"
                  [ngClass]="getEventBadgeClass(item.type)"
                >
                  {{ item.type }}
                </span>
                <span class="flex-1 truncate text-on-surface/90">
                  {{ item.message }}
                </span>
                <span class="text-[11px] text-on-surface-variant/70 flex-shrink-0">
                  {{ item.timestamp | date:'HH:mm:ss' }}
                </span>
              </div>
            }
          </div>
        </section>

      </div>
    }
  `,
})
export class AppRegistrarComponent {
  readonly healthService = inject(ServiceHealthService);
  readonly isPinging$ = this.healthService.isPinging$;

  newAppName = '';
  newAppPort?: number;
  newEnvironment: AppEnvironment = 'dev';
  newNetworkMode: AppNetworkMode = 'local';

  filterEnv: 'ALL' | AppEnvironment = 'ALL';
  filterNetwork: 'ALL' | AppNetworkMode = 'ALL';

  filteredServices(services: ServiceHealthItemState[]): ServiceHealthItemState[] {
    return services.filter((s) => {
      const matchEnv = this.filterEnv === 'ALL' || s.context.environment === this.filterEnv;
      const matchNet = this.filterNetwork === 'ALL' || s.context.networkMode === this.filterNetwork;
      return matchEnv && matchNet;
    });
  }

  onRegisterApp(): void {
    if (!this.newAppName.trim()) return;
    this.healthService.registerApp(
      this.newAppName.trim(),
      this.newAppPort,
      this.newEnvironment,
      this.newNetworkMode,
    );
    this.newAppName = '';
    this.newAppPort = undefined;
  }

  getEnvBadgeClass(env: AppEnvironment): string {
    switch (env) {
      case 'dev':
        return 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30';
      case 'staging':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30';
      case 'production':
        return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30';
    }
  }

  getNetworkBadgeClass(mode: AppNetworkMode): string {
    switch (mode) {
      case 'local':
        return 'bg-slate-500/10 text-slate-800 dark:text-slate-300 border border-slate-500/20';
      case 'tailscale-lan':
        return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30';
      case 'tailscale-funnel':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30';
    }
  }

  getNetworkIcon(mode: AppNetworkMode): string {
    switch (mode) {
      case 'local':
        return 'terminal';
      case 'tailscale-lan':
        return 'lock';
      case 'tailscale-funnel':
        return 'public';
    }
  }

  getNetworkLabel(mode: AppNetworkMode): string {
    switch (mode) {
      case 'local':
        return 'Localhost';
      case 'tailscale-lan':
        return 'TS-LAN';
      case 'tailscale-funnel':
        return 'Funnel';
    }
  }

  getEventBadgeClass(type: string): string {
    switch (type) {
      case 'ALLOCATED':
      case 'RELEASED':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
      case 'HEARTBEAT':
        return 'bg-sky-500/15 text-sky-800 dark:text-sky-300';
      case 'DEGRADED':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
      case 'EVICTED':
        return 'bg-rose-500/15 text-rose-800 dark:text-rose-300';
      default:
        return 'bg-slate-500/15 text-slate-800 dark:text-slate-300';
    }
  }
}
