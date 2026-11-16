import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AiClientAppView,
  AiCombinatorNeuronSummaryView,
  AiStatusView,
} from '../../core/models/ai.models';

@Component({
  selector: 'app-ai-topology-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex flex-col gap-4">
      <!-- MODELS CARD -->
      <section class="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-primary">neurology</span>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              Движок Umniy Lemon
            </h2>
          </div>
          @if (status?.geminiConfigured) {
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Gemini OK
            </span>
          } @else {
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
              Fallback
            </span>
          }
        </div>

        <div class="flex flex-col gap-2 text-[11px]">
          <div>
            <div class="font-bold uppercase tracking-wider text-on-surface-variant text-[10px] mb-1">
              Text / Vision модели
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (model of status?.textModels || []; track model) {
                <span class="px-2 py-0.5 rounded-lg bg-surface-container-low border border-outline-variant/25 font-mono text-[10px] text-on-surface">
                  {{ model }}
                </span>
              } @empty {
                <span class="text-on-surface-variant">Не загружены</span>
              }
            </div>
          </div>

          <div>
            <div class="font-bold uppercase tracking-wider text-on-surface-variant text-[10px] mb-1">
              Image модели ({{ status?.imageEngine || 'flux' }})
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (model of status?.imageModels || []; track model) {
                <span class="px-2 py-0.5 rounded-lg bg-surface-container-low border border-outline-variant/25 font-mono text-[10px] text-on-surface">
                  {{ model }}
                </span>
              } @empty {
                <span class="text-on-surface-variant">Не загружены</span>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- CORE COMBINATOR AI NEURONS -->
      <section class="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-amber-500">hub</span>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              Нейроны Combinator
            </h2>
          </div>
          <button
            type="button"
            [disabled]="syncingNeurons"
            (click)="syncNeuronsClick.emit()"
            class="px-2.5 py-1 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-[11px] font-bold text-on-surface transition-colors cursor-pointer disabled:opacity-50"
          >
            {{ syncingNeurons ? '...' : 'Sync' }}
          </button>
        </div>

        <div class="flex flex-col gap-2">
          @for (n of neurons; track n.neuronId) {
            <div class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-mono text-[11px] font-bold text-on-surface truncate">{{ n.path }}</div>
                <div class="text-[10px] text-on-surface-variant">{{ n.flowIds.length }} flow(s)</div>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-primary-container text-on-primary-container">
                {{ n.channel }}
              </span>
            </div>
          } @empty {
            <div class="text-xs text-on-surface-variant py-1">
              Нажмите Sync для регистрации AI-нейронов в Core Combinator.
            </div>
          }
        </div>
      </section>

      <!-- REGISTERED AI CLIENT APPS -->
      <section class="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-base text-emerald-500">vpn_key</span>
            <h2 class="font-headline-sm text-sm font-bold text-on-surface">
              AI-клиенты ({{ clients.length }})
            </h2>
          </div>
          <button
            type="button"
            (click)="createClientClick.emit()"
            class="px-2.5 py-1 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-[11px] font-bold transition-colors cursor-pointer"
          >
            + Клиент
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          <button
            type="button"
            (click)="clientFilterSelect.emit('')"
            [class]="clientButtonClass(activeClientSlug === '')"
          >
            <span class="font-bold truncate">Все клиенты</span>
            <span class="text-[10px] font-mono opacity-75">ALL</span>
          </button>

          @for (c of clients; track c.id) {
            <button
              type="button"
              (click)="clientFilterSelect.emit(c.slug)"
              [class]="clientButtonClass(activeClientSlug === c.slug)"
            >
              <div class="min-w-0 text-left">
                <div class="font-bold truncate">{{ c.name }}</div>
                <div class="font-mono text-[10px] opacity-75 truncate">{{ c.slug }} · {{ c.apiKeyPrefix }}</div>
              </div>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container">
                {{ c.allowedTasks.length }}
              </span>
            </button>
          } @empty {
            <div class="text-[11px] text-on-surface-variant py-1">
              Список клиентов доступен при подключении Admin API Key.
            </div>
          }
        </div>
      </section>
    </aside>
  `,
})
export class AiTopologySidebarComponent {
  @Input() status: AiStatusView | null = null;
  @Input() neurons: AiCombinatorNeuronSummaryView[] = [];
  @Input() clients: AiClientAppView[] = [];
  @Input() activeClientSlug = '';
  @Input() syncingNeurons = false;

  @Output() syncNeuronsClick = new EventEmitter<void>();
  @Output() createClientClick = new EventEmitter<void>();
  @Output() clientFilterSelect = new EventEmitter<string>();

  clientButtonClass(active: boolean): string {
    return active
      ? 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs transition-colors cursor-pointer'
      : 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs border border-outline-variant/20 transition-colors cursor-pointer';
  }
}
