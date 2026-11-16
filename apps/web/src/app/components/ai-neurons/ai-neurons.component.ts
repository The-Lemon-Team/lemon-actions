import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import {
  AiClientAppView,
  AiEventImpulseView,
  AiRequestLogView,
  AiRequestStatus,
  AiStatusView,
  AiStudioMode,
  AiStudioResultUnion,
  AiTaskType,
  AiUsageStatsView,
  CreatedAiClientView,
} from '../../core/models/ai.models';
import { AiService } from '../../core/services/ai.service';
import {
  AiCreateClientModalComponent,
  AiCreateClientPayload,
} from './ai-create-client-modal.component';
import {
  AiGenerateStudioComponent,
  AnalyzeImageSubmit,
  GenerateImagesSubmit,
  GenerateNoteSubmit,
  GenerateTextSubmit,
  ParseQuickAddSubmit,
  RemixImageSubmit,
} from './ai-generate-studio.component';
import {
  AiHistoryFilterChange,
  AiHistoryListComponent,
} from './ai-history-list.component';
import { AiLogDetailModalComponent } from './ai-log-detail-modal.component';
import { AiTopologySidebarComponent } from './ai-topology-sidebar.component';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-ai-neurons',
  standalone: true,
  imports: [
    FormsModule,
    AiTopologySidebarComponent,
    AiGenerateStudioComponent,
    AiHistoryListComponent,
    AiLogDetailModalComponent,
    AiCreateClientModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5 w-full pb-14">
      <!-- TOP COMMAND BAR -->
      <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-rounded text-xl">auto_awesome</span>
            </div>
            <h1 class="font-headline-sm text-2xl font-bold text-on-surface tracking-tight">
              AI-neurons · Umniy Lemon
            </h1>

            @if (status(); as st) {
              <span [class]="connectionBadgeClass(st.connected && st.authenticated)">
                <span [class]="connectionDotClass(st.connected && st.authenticated)"></span>
                {{
                  !st.connected
                    ? 'Umniy Lemon Offline'
                    : st.authenticated
                      ? 'Umniy Lemon Online'
                      : 'API Key Required'
                }}
                · {{ st.baseUrl }}
              </span>
              @if (st.neuronsSynced) {
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-container text-on-primary-container">
                  Neurons Synced
                </span>
              }
            }
          </div>
          <p class="font-body-sm text-xs text-on-surface-variant mt-1">
            Единый реактивный шлюз генерации контента (текст, заметки, картинки, remix, vision) и история запросов Umniy Lemon через &#64;lemon/ai-neurons.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            (click)="createClientOpen.set(true)"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/35 text-xs font-bold text-on-surface transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm text-emerald-500">vpn_key</span>
            <span>+ AI-клиент</span>
          </button>

          <button
            type="button"
            (click)="refreshAll()"
            title="Обновить состояние и историю"
            class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">refresh</span>
          </button>
        </div>
      </header>

      <!-- API KEY AUTH FALLBACK BAR -->
      @if (status(); as st) {
        @if (st.connected && !st.authenticated) {
          <div class="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2 text-on-surface">
              <span class="material-symbols-rounded text-amber-500">lock</span>
              <span>Umniy Lemon требует действующий X-Ai-Api-Key для истории, генерации и списка клиентов.</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <input
                type="password"
                [(ngModel)]="manualApiKey"
                placeholder="lai_admin_..."
                class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 font-mono text-xs w-56"
              />
              <button
                type="button"
                [disabled]="busyAction() || !manualApiKey.trim()"
                (click)="onSaveApiKey()"
                class="px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary-container font-bold cursor-pointer disabled:opacity-50"
              >
                Подключить ключ
              </button>
            </div>
          </div>
        }
      }

      <!-- ONE-TIME API KEY BANNER -->
      @if (createdClientBanner(); as cli) {
        <div class="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-xs text-on-surface flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="material-symbols-rounded text-emerald-500">key</span>
            <span class="font-bold">Создан AI-клиент {{ cli.slug }} — сохраните X-Ai-Api-Key (показывается один раз):</span>
            <code class="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] select-all">
              {{ cli.apiKey }}
            </code>
          </div>
          <button
            type="button"
            (click)="createdClientBanner.set(null)"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

      @if (feedbackBanner(); as banner) {
        <div class="px-4 py-2.5 rounded-2xl bg-surface-container-low border border-primary/30 text-xs text-on-surface flex items-center justify-between gap-3">
          <span>{{ banner }}</span>
          <button
            type="button"
            (click)="feedbackBanner.set(null)"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

      <!-- STATS STRIP -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Всего запросов</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats()?.totalRequests ?? historyTotal() }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Успешных</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ successCount() }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Средняя латентность</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats()?.avgLatencyMs ?? 0 }} ms</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Всего токенов</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ stats()?.tokens?.total ?? 0 }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Генераций картинок</div>
          <div class="text-lg font-bold text-on-surface font-mono">{{ imageTaskCount() }}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low border border-outline-variant/25 px-3.5 py-2.5">
          <div class="text-[10px] font-bold uppercase tracking-wider text-primary">Последний импульс</div>
          <div class="text-xs font-bold text-on-surface font-mono truncate mt-1">
            {{ lastImpulse()?.type || 'Ожидание...' }}
          </div>
        </div>
      </div>

      <!-- WORKSPACE GRID -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div class="xl:col-span-3">
          <app-ai-topology-sidebar
            [status]="status()"
            [neurons]="status()?.combinatorNeurons || []"
            [clients]="clients()"
            [activeClientSlug]="activeClientSlug()"
            [syncingNeurons]="busyAction()"
            (syncNeuronsClick)="onSyncNeurons()"
            (createClientClick)="createClientOpen.set(true)"
            (clientFilterSelect)="onSelectClientFilter($event)"
          />
        </div>

        <div class="xl:col-span-9 min-w-0 flex flex-col gap-5">
          <app-ai-generate-studio
            [isGenerating]="isGenerating()"
            [lastResult]="lastStudioResult()"
            [errorMessage]="studioError()"
            [prefillAssetId]="studioPrefillAssetId()"
            [prefillMode]="studioPrefillMode()"
            [mediaFullUrlBuilder]="mediaFullUrl"
            (generateText)="onGenerateText($event)"
            (generateNote)="onGenerateNote($event)"
            (parseQuickAdd)="onParseQuickAdd($event)"
            (generateImages)="onGenerateImages($event)"
            (remixImage)="onRemixImage($event)"
            (analyzeImage)="onAnalyzeImage($event)"
          />

          <app-ai-history-list
            [items]="filteredHistoryItems()"
            [total]="historyTotal()"
            [hasMore]="historyHasMore()"
            [isLoading]="historyLoading()"
            [activeTaskType]="activeTaskType()"
            [activeStatus]="activeStatus()"
            [searchText]="searchText()"
            [mediaThumbUrlBuilder]="mediaThumbUrl"
            (filterChange)="onFilterChange($event)"
            (loadMoreClick)="onLoadMore()"
            (selectLog)="selectedLog.set($event)"
          />
        </div>
      </div>

      <!-- LOG DETAIL MODAL -->
      <app-ai-log-detail-modal
        [log]="selectedLog()"
        [mediaFullUrlBuilder]="mediaFullUrl"
        (closeModal)="selectedLog.set(null)"
        (remixAsset)="onRemixFromModal($event)"
      />

      <!-- CREATE AI CLIENT MODAL -->
      <app-ai-create-client-modal
        [open]="createClientOpen()"
        [isSubmitting]="busyAction()"
        (closeModal)="createClientOpen.set(false)"
        (submitClient)="onCreateClient($event)"
      />
    </div>
  `,
})
export class AiNeuronsComponent implements OnInit {
  private readonly aiService = inject(AiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<AiStatusView | null>(null);
  readonly stats = signal<AiUsageStatsView | null>(null);
  readonly clients = signal<AiClientAppView[]>([]);
  readonly historyItems = signal<AiRequestLogView[]>([]);
  readonly historyTotal = signal(0);
  readonly historyLoading = signal(false);

  readonly activeClientSlug = signal('');
  readonly activeTaskType = signal<AiTaskType | ''>('');
  readonly activeStatus = signal<AiRequestStatus | ''>('');
  readonly searchText = signal('');

  readonly isGenerating = signal(false);
  readonly lastStudioResult = signal<AiStudioResultUnion | null>(null);
  readonly studioError = signal<string | null>(null);
  readonly studioPrefillAssetId = signal<string | null>(null);
  readonly studioPrefillMode = signal<AiStudioMode | null>(null);

  readonly selectedLog = signal<AiRequestLogView | null>(null);
  readonly createClientOpen = signal(false);
  readonly createdClientBanner = signal<CreatedAiClientView | null>(null);
  readonly feedbackBanner = signal<string | null>(null);
  readonly busyAction = signal(false);
  readonly lastImpulse = signal<AiEventImpulseView | null>(null);

  manualApiKey = '';

  readonly historyHasMore = computed(
    () => this.historyItems().length < this.historyTotal(),
  );

  readonly filteredHistoryItems = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const items = this.historyItems();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.taskType,
        item.model,
        item.provider,
        item.clientSlug,
        JSON.stringify(item.inputPayload || {}),
        JSON.stringify(item.outputPayload || {}),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  readonly successCount = computed(() => {
    const byStatus = this.stats()?.byStatus || [];
    return byStatus.find((s) => s.status === 'SUCCESS')?.count ?? 0;
  });

  readonly imageTaskCount = computed(() => {
    const byTask = this.stats()?.byTask || [];
    return byTask
      .filter((t) => t.taskType === 'IMAGE_GENERATE' || t.taskType === 'IMAGE_REMIX')
      .reduce((sum, t) => sum + t.count, 0);
  });

  readonly mediaThumbUrl = (assetId: string) => this.aiService.mediaThumbUrl(assetId);
  readonly mediaFullUrl = (assetId: string) => this.aiService.mediaFullUrl(assetId);

  ngOnInit(): void {
    this.refreshAll();
    this.connectSseStream();
  }

  refreshAll(): void {
    this.historyLoading.set(true);
    forkJoin({
      status: this.aiService.getStatus().pipe(catchError(() => of(null))),
      stats: this.aiService.getHistoryStats().pipe(catchError(() => of(null))),
      clients: this.aiService.listClients().pipe(catchError(() => of([] as AiClientAppView[]))),
      history: this.aiService
        .getHistory({
          clientSlug: this.activeClientSlug() || undefined,
          taskType: this.activeTaskType() || undefined,
          status: this.activeStatus() || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        })
        .pipe(catchError(() => of({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 }))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ status, stats, clients, history }) => {
        if (status) this.status.set(status);
        if (stats) this.stats.set(stats);
        this.clients.set(clients);
        this.historyItems.set(history.items);
        this.historyTotal.set(history.total);
        this.historyLoading.set(false);
      });
  }

  onSaveApiKey(): void {
    const key = this.manualApiKey.trim();
    if (!key) return;
    this.busyAction.set(true);
    this.aiService
      .setApiKey(key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyAction.set(false);
          this.manualApiKey = '';
          this.feedbackBanner.set('API-ключ Umniy Lemon успешно подключён.');
          this.refreshAll();
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(err?.error?.message || 'Ключ отклонён Umniy Lemon.');
        },
      });
  }

  onSyncNeurons(): void {
    this.busyAction.set(true);
    this.aiService
      .ensureNeurons()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busyAction.set(false);
          const current = this.status();
          if (current) {
            this.status.set({
              ...current,
              neuronsSynced: res.synced,
              combinatorNeurons: res.neurons,
            });
          }
          this.feedbackBanner.set(
            res.synced
              ? `Синхронизировано ${res.neurons.length} AI-нейронов с Core Combinator.`
              : 'Не удалось синхронизировать нейроны (проверьте Core Combinator API).',
          );
        },
        error: () => {
          this.busyAction.set(false);
          this.feedbackBanner.set('Ошибка синхронизации AI-нейронов.');
        },
      });
  }

  onSelectClientFilter(slug: string): void {
    this.activeClientSlug.set(slug);
    this.loadHistoryPage(true);
  }

  onFilterChange(change: AiHistoryFilterChange): void {
    this.activeTaskType.set(change.taskType);
    this.activeStatus.set(change.status);
    this.searchText.set(change.search);
    this.loadHistoryPage(true);
  }

  onLoadMore(): void {
    this.loadHistoryPage(false);
  }

  onGenerateText(dto: GenerateTextSubmit): void {
    this.runStudioTask(() => this.aiService.generateText(dto), (data) => ({
      kind: 'text',
      data,
    }));
  }

  onGenerateNote(dto: GenerateNoteSubmit): void {
    this.runStudioTask(() => this.aiService.generateNote(dto), (data) => ({
      kind: 'note',
      data,
    }));
  }

  onParseQuickAdd(dto: ParseQuickAddSubmit): void {
    this.runStudioTask(() => this.aiService.parseQuickAdd(dto), (data) => ({
      kind: 'quick-add',
      data,
    }));
  }

  onGenerateImages(dto: GenerateImagesSubmit): void {
    this.runStudioTask(() => this.aiService.generateImages(dto), (data) => ({
      kind: 'images',
      data,
    }));
  }

  onRemixImage(dto: RemixImageSubmit): void {
    this.runStudioTask(() => this.aiService.remixImage(dto), (data) => ({
      kind: 'remix',
      data,
    }));
  }

  onAnalyzeImage(dto: AnalyzeImageSubmit): void {
    this.runStudioTask(() => this.aiService.analyzeImage(dto), (data) => ({
      kind: 'vision',
      data,
    }));
  }

  onRemixFromModal(assetId: string): void {
    this.selectedLog.set(null);
    this.studioPrefillAssetId.set(assetId);
    this.studioPrefillMode.set('remix');
  }

  onCreateClient(payload: AiCreateClientPayload): void {
    this.busyAction.set(true);
    this.aiService
      .createClient(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.busyAction.set(false);
          this.createClientOpen.set(false);
          this.createdClientBanner.set(created);
          this.clients.update((list) => [...list, created]);
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(err?.error?.message || 'Не удалось создать AI-клиента.');
        },
      });
  }

  connectionBadgeClass(online: boolean): string {
    return online
      ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400';
  }

  connectionDotClass(online: boolean): string {
    return online
      ? 'w-2 h-2 rounded-full bg-emerald-500'
      : 'w-2 h-2 rounded-full bg-amber-500';
  }

  private runStudioTask<T>(
    obsFactory: () => Observable<T>,
    mapResult: (res: T) => AiStudioResultUnion,
  ): void {
    this.isGenerating.set(true);
    this.studioError.set(null);
    obsFactory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: T) => {
          this.isGenerating.set(false);
          this.lastStudioResult.set(mapResult(res));
          this.loadHistoryPage(true);
          this.refreshStatsOnly();
        },
        error: (err: any) => {
          this.isGenerating.set(false);
          this.studioError.set(err?.error?.message || err?.message || 'Ошибка выполнения AI-запроса');
        },
      });
  }

  private loadHistoryPage(reset: boolean): void {
    const offset = reset ? 0 : this.historyItems().length;
    this.historyLoading.set(true);
    this.aiService
      .getHistory({
        clientSlug: this.activeClientSlug() || undefined,
        taskType: this.activeTaskType() || undefined,
        status: this.activeStatus() || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .pipe(
        catchError(() => of({ items: [], total: 0, limit: PAGE_SIZE, offset })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.historyLoading.set(false);
        this.historyTotal.set(page.total);
        if (reset) {
          this.historyItems.set(page.items);
        } else {
          const existing = new Set(this.historyItems().map((i) => i.id));
          const unique = page.items.filter((i) => !existing.has(i.id));
          this.historyItems.set([...this.historyItems(), ...unique]);
        }
      });
  }

  private refreshStatsOnly(): void {
    this.aiService
      .getHistoryStats()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((stats) => {
        if (stats) this.stats.set(stats);
      });
  }

  private connectSseStream(): void {
    this.aiService
      .connectEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((packet) => {
        this.lastImpulse.set(packet.impulse);
      });
  }
}
