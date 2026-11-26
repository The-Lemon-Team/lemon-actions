import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActiveShardTarget,
  RegisteredShardView,
  ShardAnalyticsSummary,
} from '../../core/models/project-stand.models';

/**
 * Presentational view for Shards Topology, Health, NATS Telemetry & Retention Actions.
 */
@Component({
  selector: 'app-shard-topology',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-5" data-testid="shard-topology-panel">
      <!-- HEADER & CONTROLS -->
      <div class="p-4 rounded-3xl bg-surface-container-low border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-rounded text-xl">hub</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Shards Topology &amp; Health
            </h2>
            <p class="text-xs text-on-surface-variant">
              Федеративный реестр проектных шардов (Port Shield), NATS-метрики, reduction rate и управление ретеншном
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-container-lowest border border-outline-variant text-xs">
            <span class="text-on-surface-variant">Retention (дн.):</span>
            <input
              type="number"
              min="1"
              max="3650"
              [(ngModel)]="retentionDays"
              class="w-14 bg-transparent font-mono font-bold text-on-surface focus:outline-none text-right"
            />
          </div>

          @if (activeShardId) {
            <button
              type="button"
              data-testid="shard-reset-main-btn"
              (click)="resetToMain.emit()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500 bg-amber-50 text-amber-900 text-xs font-bold cursor-pointer"
            >
              <span class="material-symbols-rounded text-sm">undo</span>
              <span>Вернуться в Main Shard</span>
            </button>
          }

          <button
            type="button"
            data-testid="shard-refresh-btn"
            (click)="refresh.emit()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim text-xs font-bold cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">refresh</span>
            <span>Обновить</span>
          </button>
        </div>
      </div>

      @if (feedbackMessage) {
        <div
          data-testid="shard-feedback-banner"
          class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant text-xs font-mono text-on-surface"
        >
          {{ feedbackMessage }}
        </div>
      }

      <!-- SUMMARY KPIS -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-1">
          <span class="text-[11px] font-mono text-on-surface-variant">Зарегистрировано шардов</span>
          <span class="text-2xl font-bold font-mono text-on-surface">{{ shards.length }}</span>
          <span class="text-[10px] text-on-surface-variant">core-shard в Port Shield</span>
        </div>

        <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-1">
          <span class="text-[11px] font-mono text-on-surface-variant">Здоровые / Деградировавшие</span>
          <span class="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {{ getHealthyCount() }} / {{ getDegradedCount() }}
          </span>
          <span class="text-[10px] text-on-surface-variant">по статусу и NATS</span>
        </div>

        <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-1">
          <span class="text-[11px] font-mono text-on-surface-variant">Федеративных событий</span>
          <span class="text-2xl font-bold font-mono text-primary">{{ analytics?.totalFlowEvents ?? 0 }}</span>
          <span class="text-[10px] text-on-surface-variant">принято из NATS JetStream</span>
        </div>

        <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-1">
          <span class="text-[11px] font-mono text-on-surface-variant">Активный контекст Console</span>
          <span class="text-sm font-bold font-mono text-on-surface truncate">
            {{ activeShardId || 'Main Shard (Logical)' }}
          </span>
          <span class="text-[10px] text-on-surface-variant">цель для /core</span>
        </div>
      </div>

      <!-- SHARD CARDS -->
      @if (shards.length === 0) {
        <div class="p-8 rounded-3xl bg-surface-container-low border border-outline-variant text-center flex flex-col items-center gap-2">
          <span class="material-symbols-rounded text-3xl text-on-surface-variant">dns</span>
          <p class="text-sm font-bold text-on-surface">Выделенные проектные шарды не зарегистрированы</p>
          <p class="text-xs text-on-surface-variant max-w-lg">
            Все проекты сейчас обслуживаются через Main Shard (Tier A: shared-logical). Запустите выделенный шард (например,
            <code class="font-mono">npm run start:watchers-shard</code>), чтобы увидеть его здесь.
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          @for (shard of shards; track shard.instanceId) {
            <article
              [attr.data-testid]="'shard-card-' + shard.projectSlug"
              class="p-5 rounded-3xl bg-surface-container-low border border-outline-variant flex flex-col gap-4 shadow-2xs"
            >
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-headline-sm text-base font-bold text-on-surface truncate">
                      {{ shard.projectName || shard.projectSlug }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-primary-container text-on-primary-container">
                      {{ shard.tier }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                      [class]="getStatusBadgeClass(shard.status)"
                    >
                      {{ shard.status }}
                    </span>
                  </div>
                  <div class="text-xs font-mono text-on-surface-variant truncate">
                    {{ shard.shardId }} · {{ shard.apiBaseUrl }}
                  </div>
                </div>

                @if (shard.pingLatencyMs !== undefined) {
                  <span class="px-2.5 py-1 rounded-xl bg-surface-container-lowest border border-outline-variant text-xs font-mono font-bold text-on-surface">
                    {{ shard.pingLatencyMs }} ms
                  </span>
                }
              </div>

              <!-- Telemetry Grid -->
              @if (getShardAnalytics(shard); as a) {
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant">
                    <div class="text-[10px] text-on-surface-variant">Active Flows</div>
                    <div class="font-mono font-bold text-sm text-on-surface">
                      {{ a.latestSnapshot?.['flows']?.['active'] ?? 0 }}
                    </div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant">
                    <div class="text-[10px] text-on-surface-variant">Reduction Rate</div>
                    <div class="font-mono font-bold text-sm text-primary">
                      {{ a.latestSnapshot?.['optimizer']?.['reductionRatePct'] ?? 0 }}%
                    </div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant">
                    <div class="text-[10px] text-on-surface-variant">Scheduler Tick</div>
                    <div class="font-mono font-bold text-sm text-on-surface">
                      {{ a.latestSnapshot?.['scheduler']?.['lastTickDurationMs'] ?? 0 }} ms
                    </div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant">
                    <div class="text-[10px] text-on-surface-variant">Bus Events</div>
                    <div class="font-mono font-bold text-sm text-on-surface">
                      {{ a.totalFlowEvents }}
                    </div>
                  </div>
                </div>

                @if (a.recentAlerts.length > 0) {
                  <div class="flex flex-col gap-1.5 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs">
                    <div class="font-bold flex items-center gap-1">
                      <span class="material-symbols-rounded text-sm">warning</span>
                      <span>Последние алерты ({{ a.recentAlerts.length }})</span>
                    </div>
                    @for (alert of a.recentAlerts.slice(0, 3); track alert.timestamp + alert.topic) {
                      <div class="font-mono text-[11px] truncate">
                        • {{ alert.message }}
                      </div>
                    }
                  </div>
                }
              }

              <!-- Capabilities & Reducers -->
              <div class="flex items-center gap-1.5 flex-wrap">
                @for (cap of shard.capabilities; track cap) {
                  <span class="px-2 py-0.5 rounded-lg bg-surface-container text-[10px] font-mono text-on-surface-variant">
                    {{ cap }}
                  </span>
                }
                @for (red of shard.customReducers; track red) {
                  <span class="px-2 py-0.5 rounded-lg bg-secondary-container text-[10px] font-mono text-on-secondary-container">
                    reducer:{{ red }}
                  </span>
                }
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant flex-wrap">
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    [attr.data-testid]="'shard-publish-metrics-' + shard.projectSlug"
                    [disabled]="busyShardId === shard.shardId"
                    (click)="publishMetrics.emit(shard)"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold text-on-surface disabled:opacity-50 cursor-pointer"
                  >
                    <span class="material-symbols-rounded text-sm">sensors</span>
                    <span>Снять метрики</span>
                  </button>

                  <button
                    type="button"
                    [attr.data-testid]="'shard-prune-retention-' + shard.projectSlug"
                    [disabled]="busyShardId === shard.shardId"
                    (click)="pruneRetention.emit({ shard, retentionDays })"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold text-on-surface disabled:opacity-50 cursor-pointer"
                  >
                    <span class="material-symbols-rounded text-sm">auto_delete</span>
                    <span>Очистить (&gt;{{ retentionDays }}д)</span>
                  </button>
                </div>

                <button
                  type="button"
                  [attr.data-testid]="'shard-switch-console-' + shard.projectSlug"
                  (click)="switchToShard.emit(toActiveTarget(shard))"
                  class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  [class]="getSwitchBtnClass(activeShardId === shard.shardId)"
                >
                  <span class="material-symbols-rounded text-sm">
                    {{ activeShardId === shard.shardId ? 'check_circle' : 'open_in_new' }}
                  </span>
                  <span>
                    {{ activeShardId === shard.shardId ? 'Активен в Core Console' : 'Открыть в Core Console' }}
                  </span>
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class ShardTopologyComponent {
  @Input() shards: RegisteredShardView[] = [];
  @Input() analytics: ShardAnalyticsSummary | null = null;
  @Input() activeShardId: string | null = null;
  @Input() busyShardId: string | null = null;
  @Input() feedbackMessage = '';

  @Output() refresh = new EventEmitter<void>();
  @Output() switchToShard = new EventEmitter<ActiveShardTarget>();
  @Output() resetToMain = new EventEmitter<void>();
  @Output() publishMetrics = new EventEmitter<RegisteredShardView>();
  @Output() pruneRetention = new EventEmitter<{ shard: RegisteredShardView; retentionDays: number }>();

  retentionDays = 30;

  getHealthyCount(): number {
    return this.shards.filter((s) => s.status === 'ONLINE' || s.status === 'ok').length;
  }

  getDegradedCount(): number {
    return this.shards.filter((s) => s.status !== 'ONLINE' && s.status !== 'ok').length;
  }

  getShardAnalytics(shard: RegisteredShardView) {
    if (shard.analytics) return shard.analytics;
    return this.analytics?.shards.find((s) => s.projectSlug === shard.projectSlug) ?? null;
  }

  toActiveTarget(shard: RegisteredShardView): ActiveShardTarget {
    return {
      shardId: shard.shardId,
      projectSlug: shard.projectSlug,
      projectName: shard.projectName,
      tier: shard.tier,
      apiBaseUrl: shard.apiBaseUrl,
    };
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'ONLINE' || status === 'ok') {
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200';
    }
    return 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-200';
  }

  getSwitchBtnClass(isActive: boolean): string {
    return isActive
      ? 'bg-emerald-600 text-white shadow-2xs'
      : 'bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container shadow-2xs';
  }
}
