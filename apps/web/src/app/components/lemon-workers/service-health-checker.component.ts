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
  selector: 'app-service-health-checker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (healthService.projection$ | async; as proj) {
      <div class="flex flex-col gap-6 w-full">

        <!-- 1. LIVE REGISTRAR BAR (Регистратор с выбором Окружения и Tailscale) -->
        <section class="p-5 md:p-6 rounded-3xl bg-surface-container-low/70 border border-outline-variant/30 flex flex-col gap-4 shadow-2xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-2xs">
                <span class="material-symbols-rounded text-base">app_registration</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-sm font-bold text-on-surface">
                  Регистрация сервиса в Projectarium Port Shield
                </h3>
                <p class="font-body-sm text-xs text-on-surface-variant">
                  Выдаёт свободный порт (4320+), токен инстанса и регистрирует окружение (Dev, Staging, Prod) и сеть (Local, Tailscale LAN, Funnel)
                </p>
              </div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-code-sm text-[11px] self-start sm:self-auto font-medium">
              Аренда с автовытеснением (5 сбоев)
            </span>
          </div>

          <!-- Registration Controls: Name, Port, Env, Network -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <!-- App Name Input -->
            <div class="lg:col-span-1">
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Имя приложения</label>
              <input
                type="text"
                [(ngModel)]="newAppName"
                placeholder="e.g. crawler-bot, api-proxy..."
                class="w-full px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface font-medium placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <!-- Custom Port (Optional) -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Порт (авто: 4320+)</label>
              <input
                type="number"
                [(ngModel)]="newAppPort"
                placeholder="4320+"
                class="w-full px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-label-code-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <!-- Environment Selector (Dev / Staging / Prod) -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Окружение</label>
              <div class="flex items-center gap-1 p-0.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/20">
                <button
                  type="button"
                  (click)="newEnvironment = 'dev'"
                  class="flex-1 py-1 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'dev' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Dev
                </button>
                <button
                  type="button"
                  (click)="newEnvironment = 'staging'"
                  class="flex-1 py-1 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'staging' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Stg
                </button>
                <button
                  type="button"
                  (click)="newEnvironment = 'production'"
                  class="flex-1 py-1 rounded-lg text-[11px] font-bold uppercase transition-all"
                  [class]="newEnvironment === 'production' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant'"
                >
                  Prod
                </button>
              </div>
            </div>

            <!-- Network Mode (Local / TS LAN / TS Funnel) -->
            <div>
              <label class="block text-[11px] font-medium text-on-surface-variant mb-1">Сеть / Маршрут</label>
              <select
                [(ngModel)]="newNetworkMode"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              class="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold font-headline-sm shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-rounded text-base">rocket_launch</span>
              <span>Зарегистрировать и выдать токен</span>
            </button>
          </div>
        </section>

        <!-- 2. MAIN PROJECTION CARD -->
        <article
          class="relative flex flex-col justify-between rounded-3xl p-6 md:p-7 bg-[#fffde7] dark:bg-[#2e2a14] border border-[#f7d02c]/40 shadow-[0_2px_16px_rgba(247,208,44,0.12)] transition-all"
        >
          <!-- Top Row: Neuron Path & Stream Type -->
          <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-black/30 border border-black/[0.06] text-xs font-medium text-on-surface-variant shadow-2xs font-label-code-sm">
                <span class="material-symbols-rounded text-sm text-primary/80">folder</span>
                <span>{{ proj.neuronPath }}</span>
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-extrabold uppercase font-label-code-sm">
                PROJECTION STREAM
              </span>
            </div>

            <!-- Auto-refresh Switch -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="healthService.toggleAutoRefresh()"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
                [class]="proj.isAutoRefreshActive ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-white/60 dark:bg-black/20 border-black/10 text-on-surface-variant'"
              >
                <span
                  class="w-2 h-2 rounded-full"
                  [class.bg-emerald-500]="proj.isAutoRefreshActive"
                  [class.animate-ping]="proj.isAutoRefreshActive"
                  [class.bg-slate-400]="!proj.isAutoRefreshActive"
                ></span>
                <span>Автопинг: {{ proj.isAutoRefreshActive ? 'Каждые 30с' : 'Выключен' }}</span>
              </button>
            </div>
          </div>

          <!-- Title & High-level Status Metrics -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 class="font-headline-sm text-xl md:text-2xl font-bold text-on-surface tracking-tight">
                {{ proj.title }}
              </h2>
              <p class="font-body-sm text-xs text-on-surface-variant/80 mt-1">
                Активный пул приложений агентов с разделением по средам (Dev, Staging, Prod) и маршрутам Tailscale
              </p>
            </div>

            <!-- Big Stat Pill + Ping All Button -->
            <div class="flex items-center gap-3 flex-wrap">
              <div class="px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-black/30 border border-black/[0.06] flex items-center gap-3 shadow-2xs">
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="font-headline-sm text-sm font-bold text-on-surface">
                    {{ proj.healthyCount }} / {{ proj.totalServices }} UP
                  </span>
                </div>
                <span class="text-xs text-outline/40">•</span>
                <span class="font-label-code-sm text-xs text-on-surface-variant font-semibold">
                  ~{{ proj.averageLatencyMs }}ms пинг
                </span>
              </div>

              <button
                type="button"
                (click)="healthService.pingAll()"
                [disabled]="isPinging$ | async"
                class="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold font-headline-sm shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <span
                  class="material-symbols-rounded text-sm"
                  [class.animate-spin]="isPinging$ | async"
                >
                  {{ (isPinging$ | async) ? 'refresh' : 'network_check' }}
                </span>
                <span>{{ (isPinging$ | async) ? 'Проверка...' : 'Пинг всех' }}</span>
              </button>
            </div>
          </div>

          <!-- ENVIRONMENT FILTER RIBBON -->
          <div class="flex items-center justify-between gap-2 mb-4 p-2 rounded-2xl bg-white/60 dark:bg-black/20 border border-black/[0.04] flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2">Среда:</span>
              <button
                type="button"
                (click)="filterEnv = 'ALL'"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                [class]="filterEnv === 'ALL' ? 'bg-primary-container text-on-primary-container shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'"
              >
                Все ({{ proj.services.length }})
              </button>
              <button
                type="button"
                (click)="filterEnv = 'dev'"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'dev' ? 'bg-teal-500/20 text-teal-900 dark:text-teal-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                <span>DEV</span>
              </button>
              <button
                type="button"
                (click)="filterEnv = 'staging'"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'staging' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>STAGING</span>
              </button>
              <button
                type="button"
                (click)="filterEnv = 'production'"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                [class]="filterEnv === 'production' ? 'bg-purple-500/20 text-purple-900 dark:text-purple-200 shadow-2xs font-extrabold' : 'text-on-surface-variant hover:text-on-surface'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>PROD</span>
              </button>
            </div>

            <!-- Network Filter -->
            <div class="flex items-center gap-1 text-xs text-on-surface-variant font-label-code-sm pr-2">
              <span>Сеть:</span>
              <select
                [(ngModel)]="filterNetwork"
                class="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-black/30 border border-black/10 text-xs font-medium text-on-surface focus:outline-none"
              >
                <option value="ALL">Все сети</option>
                <option value="local">💻 Localhost</option>
                <option value="tailscale-lan">🔒 Tailscale LAN</option>
                <option value="tailscale-funnel">🌐 Tailscale Funnel</option>
              </select>
            </div>
          </div>

          <!-- 3. FLAT SERVICES LIST -->
          <div class="flex flex-col gap-3">
            @for (svc of filteredServices(proj.services); track svc.context.id) {
              <div
                class="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 dark:bg-black/30 border transition-all hover:shadow-xs"
                [ngClass]="svc.currentStatus === 'DEGRADED' ? 'border-amber-400 bg-amber-50/40' : 'border-black/5'"
              >
                <!-- Left: Status dot + Icon + App Name + Badges + Token -->
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Live Status Dot -->
                  <div class="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      [class.bg-emerald-500]="svc.currentStatus === 'HEALTHY'"
                      [class.bg-amber-400]="svc.currentStatus === 'CHECKING'"
                      [class.bg-rose-500]="svc.currentStatus === 'DEGRADED'"
                      [class.animate-ping]="svc.currentStatus === 'CHECKING'"
                    ></span>
                  </div>

                  <!-- Service Icon -->
                  <div class="w-9 h-9 rounded-xl bg-surface-container-high/60 flex items-center justify-center text-on-surface-variant flex-shrink-0">
                    <span class="material-symbols-rounded text-lg">{{ svc.context.icon || 'lan' }}</span>
                  </div>

                  <!-- Name, Badges, Port, URL and Token -->
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
                      <span class="px-2 py-0.5 rounded-md bg-primary-container/40 text-on-primary-container text-xs font-bold font-label-code-sm">
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
                  <!-- Failure Counter / Circuit Breaker Badge -->
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

                  <!-- Sparkline History Dots -->
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

                  <!-- Latency Pill -->
                  <div
                    class="px-2.5 py-1 rounded-lg bg-surface-container-low border border-black/[0.05] font-label-code-sm text-xs font-bold text-on-surface min-w-[54px] text-center"
                    [class.text-emerald-700]="svc.lastLatencyMs < 40"
                    [class.text-amber-700]="svc.lastLatencyMs >= 40 && svc.lastLatencyMs < 100"
                    [class.text-rose-700]="svc.lastLatencyMs >= 100"
                  >
                    {{ svc.lastLatencyMs }}ms
                  </div>

                  <!-- Interactive Buttons: Ping / Release -->
                  <div class="flex items-center gap-1">
                    <!-- Quick Ping -->
                    <button
                      type="button"
                      (click)="healthService.pingSingle(svc.context.id)"
                      [disabled]="svc.currentStatus === 'CHECKING'"
                      class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Проверить доступность (HTTP/TCP Ping)"
                    >
                      <span class="material-symbols-rounded text-sm" [class.animate-spin]="svc.currentStatus === 'CHECKING'">
                        refresh
                      </span>
                    </button>

                    <!-- Graceful Agent Shutdown (Release port & token) -->
                    <button
                      type="button"
                      (click)="healthService.releaseApp(svc.context.id)"
                      class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Завершить работу агента (освободить порт)"
                    >
                      <span class="material-symbols-rounded text-sm">stop_circle</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Bottom Footer Info -->
          <div class="mt-5 pt-3.5 border-t border-black/[0.06] flex items-center justify-between text-xs text-on-surface-variant/80 font-label-code-sm">
            <span>Обновлено: {{ proj.lastRunAt | date:'HH:mm:ss' }}</span>
            <button
              type="button"
              (click)="showContextSpec = !showContextSpec"
              class="hover:text-primary transition-colors flex items-center gap-1 font-medium"
            >
              <span class="material-symbols-rounded text-sm">data_object</span>
              <span>{{ showContextSpec ? 'Скрыть CONTEXT' : 'Показать CONTEXT спецификацию' }}</span>
            </button>
          </div>
        </article>

        <!-- 4. EVICTED SERVICES ARCHIVE (Вытесненные инстансы) -->
        @if (proj.evictedServices.length > 0) {
          <section class="p-5 rounded-3xl bg-surface-container-low/50 border border-rose-500/20 flex flex-col gap-3">
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

        <!-- 5. НЕЙРОН ИСТОРИИ (CHRONICLE / AUDIT TRAIL) -->
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

          <!-- Chronicle List -->
          <div class="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            @for (item of proj.chronicle; track item.id) {
              <div class="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/15 text-xs font-label-code-sm">
                <!-- Event Badge -->
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase flex-shrink-0"
                  [ngClass]="getEventBadgeClass(item.type)"
                >
                  {{ item.type }}
                </span>

                <!-- Message & Details -->
                <span class="flex-1 truncate text-on-surface/90">
                  {{ item.message }}
                </span>

                <!-- Timestamp -->
                <span class="text-[11px] text-on-surface-variant/70 flex-shrink-0">
                  {{ item.timestamp | date:'HH:mm:ss' }}
                </span>
              </div>
            }
          </div>
        </section>

        <!-- 6. COLLAPSIBLE CONTEXT SPECIFICATION -->
        @if (showContextSpec) {
          <div class="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-base text-primary">code_blocks</span>
                <span class="font-headline-sm text-xs font-bold uppercase tracking-wider text-on-surface">
                  Декларативный CONTEXT (Реестр ресурсов с Tailscale и Средами)
                </span>
              </div>
              <span class="text-xs text-on-surface-variant">Редактируемый JSON-контракт</span>
            </div>
            <pre class="p-4 rounded-2xl bg-surface-container-lowest text-on-surface font-label-code-sm text-xs overflow-x-auto border border-outline-variant/20">{{ contextJson }}</pre>
          </div>
        }

      </div>
    }
  `,
})
export class ServiceHealthCheckerComponent {
  readonly healthService = inject(ServiceHealthService);
  readonly isPinging$ = this.healthService.isPinging$;

  newAppName = '';
  newAppPort?: number;
  newEnvironment: AppEnvironment = 'dev';
  newNetworkMode: AppNetworkMode = 'local';

  filterEnv: 'ALL' | AppEnvironment = 'ALL';
  filterNetwork: 'ALL' | AppNetworkMode = 'ALL';

  showContextSpec = false;

  get contextJson(): string {
    return this.healthService.getContextJson();
  }

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
      case 'lan':
        return 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30';
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
      case 'lan':
        return 'lan';
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
      case 'lan':
        return 'LAN';
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
