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
import { catchError, forkJoin, of, take } from 'rxjs';
import {
  SeasonsFeedNodeView,
  SeasonsNoteView,
  SeasonsStatusView,
  SeasonsStreamNodeView,
  SeasonsTopologyView,
} from '../../core/models/seasons.models';
import { ProjectStandService } from '../../core/services/project-stand.service';
import { SeasonsService } from '../../core/services/seasons.service';
import { SeasonsBubbleCanvasComponent } from './seasons-bubble-canvas.component';
import {
  SeasonsCreateModalComponent,
  SeasonsCreateModalMode,
  SeasonsCreateSubmitPayload,
} from './seasons-create-modal.component';
import { SeasonsFeedInspectorComponent } from './seasons-feed-inspector.component';

@Component({
  selector: 'app-seasons-explorer',
  standalone: true,
  imports: [
    SeasonsBubbleCanvasComponent,
    SeasonsFeedInspectorComponent,
    SeasonsCreateModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5 w-full pb-14">
      <!-- TOP COMMAND BAR -->
      <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-rounded text-xl">bubble_chart</span>
            </div>
            <h1 class="font-headline-sm text-2xl font-bold text-on-surface tracking-tight">
              Lemon Seasons · Streams & Feeds
            </h1>
            @if (status(); as st) {
              <span [class]="connectionBadgeClass(st.connected)">
                <span [class]="connectionDotClass(st.connected)"></span>
                {{ st.connected ? 'Seasons Online' : 'Seasons Offline' }} · {{ st.baseUrl }}
              </span>
            }
            @if (topology(); as topo) {
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                rev #{{ topo.revision }} · {{ topo.totals.notes }} notes
              </span>
            }
          </div>
          <p class="font-body-sm text-xs text-on-surface-variant mt-1">
            Интерактивная карта Streams и Feeds: выберите bubble стрима, чтобы раскрыть внутренние фиды и управлять проксируемыми TodoList-заметками.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            [disabled]="busyAction()"
            (click)="onEnsureProjectariumNamespace()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/35 text-xs font-bold text-on-surface transition-all cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-rounded text-sm text-amber-500">lock</span>
            <span>Namespace: projectarium</span>
          </button>

          <button
            type="button"
            [disabled]="busyAction()"
            (click)="onSyncProjectariumStands()"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/35 text-xs font-bold text-on-surface transition-all cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-rounded text-sm text-primary">sync</span>
            <span>Синхронизировать стенды</span>
          </button>

          <button
            type="button"
            (click)="openCreateModal('stream')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">add_circle</span>
            <span>+ Stream</span>
          </button>

          <button
            type="button"
            (click)="openCreateModal('feed', selectedStreamSlug() || 'projectarium')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">dynamic_feed</span>
            <span>+ Feed</span>
          </button>

          <button
            type="button"
            (click)="refreshTopology()"
            title="Обновить топологию"
            class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">refresh</span>
          </button>
        </div>
      </header>

      @if (feedbackBanner(); as banner) {
        <div class="px-4 py-2.5 rounded-2xl bg-surface-container-low border border-primary/30 text-xs text-on-surface flex items-center justify-between gap-3">
          <span>{{ banner }}</span>
          <button
            type="button"
            (click)="feedbackBanner.set(null)"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span class="material-symbols-rounded text-sm">close</span>
          </button>
        </div>
      }

      <!-- MAIN WORKSPACE: BUBBLE CONTAINER + INSPECTOR -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div class="xl:col-span-7 min-w-0">
          <app-seasons-bubble-canvas
            [streams]="topology()?.streams ?? []"
            [feeds]="topology()?.feeds ?? []"
            [selectedStreamSlug]="selectedStreamSlug()"
            [selectedFeedSlug]="selectedFeedSlug()"
            [pulsingFeedSlug]="pulsingFeedSlug()"
            (streamSelect)="onStreamSelect($event)"
            (feedSelect)="onFeedSelect($event)"
            (clearSelection)="onClearSelection()"
            (createFeedInStream)="openCreateModal('feed', $event)"
          />
        </div>

        <div class="xl:col-span-5 min-w-0">
          <app-seasons-feed-inspector
            [selectedStream]="selectedStream()"
            [selectedFeed]="selectedFeed()"
            [notes]="notes()"
            [loading]="notesLoading()"
            (addFeedRequested)="openCreateModal('feed', $event)"
            (addNoteRequested)="openCreateModal('note', $event.streamSlug, $event.feedSlug)"
            (toggleTodo)="onToggleTodo($event)"
            (removeTodo)="onRemoveTodo($event)"
            (addTodo)="onAddTodo($event)"
          />
        </div>
      </div>

      <!-- MODAL DIALOG -->
      <app-seasons-create-modal
        [open]="modalOpen()"
        [mode]="modalMode()"
        [defaultStreamSlug]="modalDefaultStreamSlug()"
        [defaultFeedSlug]="modalDefaultFeedSlug()"
        [isSubmitting]="modalSubmitting()"
        (closed)="modalOpen.set(false)"
        (submitted)="onModalSubmit($event)"
      />
    </div>
  `,
})
export class SeasonsExplorerComponent implements OnInit {
  private readonly seasons = inject(SeasonsService);
  private readonly projectStandService = inject(ProjectStandService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<SeasonsStatusView | null>(null);
  readonly topology = signal<SeasonsTopologyView | null>(null);
  readonly selectedStreamSlug = signal<string | null>(null);
  readonly selectedFeedSlug = signal<string | null>(null);
  readonly pulsingFeedSlug = signal<string | null>(null);
  readonly notes = signal<SeasonsNoteView[]>([]);
  readonly notesLoading = signal<boolean>(false);
  readonly busyAction = signal<boolean>(false);
  readonly feedbackBanner = signal<string | null>(null);

  readonly modalOpen = signal<boolean>(false);
  readonly modalMode = signal<SeasonsCreateModalMode>('stream');
  readonly modalDefaultStreamSlug = signal<string>('');
  readonly modalDefaultFeedSlug = signal<string>('');
  readonly modalSubmitting = signal<boolean>(false);

  readonly selectedStream = computed<SeasonsStreamNodeView | null>(() => {
    const slug = this.selectedStreamSlug();
    if (!slug) return null;
    return this.topology()?.streams.find((s) => s.slug === slug) ?? null;
  });

  readonly selectedFeed = computed<SeasonsFeedNodeView | null>(() => {
    const slug = this.selectedFeedSlug();
    if (!slug) return null;
    return this.topology()?.feeds.find((f) => f.slug === slug) ?? null;
  });

  ngOnInit(): void {
    this.loadStatus();
    this.refreshTopology();
    this.subscribeLiveEvents();
  }

  loadStatus(): void {
    this.seasons
      .getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (st) => this.status.set(st),
        error: () =>
          this.status.set({
            baseUrl: 'http://127.0.0.1:3002',
            connected: false,
            projectariumStreamSlug: 'projectarium',
          }),
      });
  }

  refreshTopology(): void {
    this.seasons
      .getTopology({ privacy: 'all' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (topo) => this.topology.set(topo),
        error: (err) =>
          this.feedbackBanner.set(
            `Не удалось загрузить топологию Lemon Seasons: ${err?.message || 'ошибка сети'}`,
          ),
      });
  }

  onStreamSelect(stream: SeasonsStreamNodeView): void {
    this.selectedStreamSlug.set(stream.slug);
    this.selectedFeedSlug.set(null);
    this.loadNotesForStream(stream.slug);
  }

  onFeedSelect(ev: { stream: SeasonsStreamNodeView; feed: SeasonsFeedNodeView }): void {
    this.selectedStreamSlug.set(ev.stream.slug);
    this.selectedFeedSlug.set(ev.feed.slug);
    this.loadNotesForFeed(ev.feed.slug);
  }

  onClearSelection(): void {
    this.selectedStreamSlug.set(null);
    this.selectedFeedSlug.set(null);
    this.notes.set([]);
  }

  openCreateModal(
    mode: SeasonsCreateModalMode,
    defaultStreamSlug = '',
    defaultFeedSlug = '',
  ): void {
    this.modalMode.set(mode);
    this.modalDefaultStreamSlug.set(defaultStreamSlug);
    this.modalDefaultFeedSlug.set(defaultFeedSlug);
    this.modalOpen.set(true);
  }

  onModalSubmit(payload: SeasonsCreateSubmitPayload): void {
    this.modalSubmitting.set(true);

    if (payload.mode === 'stream') {
      this.seasons
        .createStream({
          slug: payload.slug,
          title: payload.title,
          description: payload.description || undefined,
          icon: payload.icon,
          color: payload.color,
          privacy: payload.privacy,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.modalSubmitting.set(false);
            this.modalOpen.set(false);
            this.selectedStreamSlug.set(payload.slug);
            this.feedbackBanner.set(`Создан стрим "${payload.title}" (${payload.slug}).`);
            this.refreshTopology();
          },
          error: (err) => {
            this.modalSubmitting.set(false);
            this.feedbackBanner.set(`Ошибка создания стрима: ${err?.message || 'unknown'}`);
          },
        });
      return;
    }

    if (payload.mode === 'feed') {
      this.seasons
        .createFeed({
          slug: payload.slug,
          title: payload.title,
          description: payload.description || undefined,
          icon: payload.icon,
          color: payload.color,
          privacy: payload.privacy,
          streamSlug: payload.streamSlug || this.selectedStreamSlug() || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.modalSubmitting.set(false);
            this.modalOpen.set(false);
            this.selectedFeedSlug.set(payload.slug);
            this.feedbackBanner.set(`Добавлен feed "${payload.title}" (${payload.slug}).`);
            this.refreshTopology();
            this.loadNotesForFeed(payload.slug);
          },
          error: (err) => {
            this.modalSubmitting.set(false);
            this.feedbackBanner.set(`Ошибка создания фида: ${err?.message || 'unknown'}`);
          },
        });
      return;
    }

    // mode === 'note'
    const todoList = (payload.todoLines || []).map((line, idx) => ({
      id: `todo-${Date.now()}-${idx + 1}`,
      title: line,
      completed: false,
    }));

    this.seasons
      .ingestNote({
        title: payload.title,
        content: payload.description,
        type: payload.noteType || 'SINGLE',
        privacy: payload.privacy,
        streamSlug: payload.streamSlug || this.selectedStreamSlug() || undefined,
        feedSlug: payload.feedSlug,
        todoList: todoList.length > 0 ? todoList : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.modalSubmitting.set(false);
          this.modalOpen.set(false);
          this.feedbackBanner.set(`Заметка "${payload.title}" сохранена в Lemon Seasons.`);
          this.refreshTopology();
          if (payload.feedSlug) {
            this.selectedFeedSlug.set(payload.feedSlug);
            this.loadNotesForFeed(payload.feedSlug);
          }
        },
        error: (err) => {
          this.modalSubmitting.set(false);
          this.feedbackBanner.set(`Ошибка сохранения заметки: ${err?.message || 'unknown'}`);
        },
      });
  }

  onAddTodo(ev: { noteId: string; title: string }): void {
    this.seasons
      .proxyNoteTodos(ev.noteId, { action: 'add', title: ev.title })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.patchNoteInList(ev.noteId, res.note),
      });
  }

  onToggleTodo(ev: { noteId: string; todoId: string }): void {
    this.seasons
      .proxyNoteTodos(ev.noteId, { action: 'toggle', todoId: ev.todoId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.patchNoteInList(ev.noteId, res.note),
      });
  }

  onRemoveTodo(ev: { noteId: string; todoId: string }): void {
    this.seasons
      .proxyNoteTodos(ev.noteId, { action: 'remove', todoId: ev.todoId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.patchNoteInList(ev.noteId, res.note),
      });
  }

  onEnsureProjectariumNamespace(): void {
    this.busyAction.set(true);
    this.seasons
      .ensureProjectariumNamespace()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyAction.set(false);
          this.selectedStreamSlug.set('projectarium');
          this.feedbackBanner.set(
            'Приватный стрим "projectarium" и его фиды (todos, notes, chronicle) готовы.',
          );
          this.refreshTopology();
        },
        error: (err) => {
          this.busyAction.set(false);
          this.feedbackBanner.set(`Ошибка создания namespace: ${err?.message || 'unknown'}`);
        },
      });
  }

  onSyncProjectariumStands(): void {
    this.projectStandService.allStands$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((stands) => {
        if (!stands.length) {
          this.feedbackBanner.set('Нет активных стендов Projectarium для синхронизации.');
          return;
        }

        this.busyAction.set(true);
        const requests = stands.map((stand) =>
          this.seasons
            .syncProjectariumStand(stand.slug)
            .pipe(catchError(() => of(null))),
        );

        forkJoin(requests)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((results) => {
            const okCount = results.filter((r) => r !== null).length;
            this.busyAction.set(false);
            this.selectedStreamSlug.set('projectarium');
            this.feedbackBanner.set(
              `Синхронизировано стендов Projectarium: ${okCount}/${stands.length} (в приватный стрим projectarium).`,
            );
            this.refreshTopology();
          });
      });
  }

  connectionBadgeClass(connected: boolean): string {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold';
    return connected
      ? `${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`
      : `${base} bg-error/15 text-error`;
  }

  connectionDotClass(connected: boolean): string {
    return connected
      ? 'w-1.5 h-1.5 rounded-full bg-emerald-500'
      : 'w-1.5 h-1.5 rounded-full bg-error';
  }

  private loadNotesForFeed(feedSlug: string): void {
    this.notesLoading.set(true);
    this.seasons
      .getFeedNotes(feedSlug, { limit: 30, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notes.set(page.items || []);
          this.notesLoading.set(false);
        },
        error: () => {
          this.notes.set([]);
          this.notesLoading.set(false);
        },
      });
  }

  private loadNotesForStream(streamSlug: string): void {
    this.notesLoading.set(true);
    this.seasons
      .getStreamNotes(streamSlug, { limit: 25, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notes.set(page.items || []);
          this.notesLoading.set(false);
        },
        error: () => {
          this.notes.set([]);
          this.notesLoading.set(false);
        },
      });
  }

  private patchNoteInList(noteId: string, updatedNote: SeasonsNoteView): void {
    this.notes.update((items) =>
      items.map((item) => (item.id === noteId ? { ...item, ...updatedNote } : item)),
    );
  }

  private subscribeLiveEvents(): void {
    this.seasons
      .connectEventsStream()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((packet) => {
        if (packet.kind === 'topology') {
          this.refreshTopology();
          return;
        }
        if (packet.kind === 'note' && packet.event.feedSlug) {
          this.pulsingFeedSlug.set(packet.event.feedSlug);
          setTimeout(() => {
            if (this.pulsingFeedSlug() === packet.event.feedSlug) {
              this.pulsingFeedSlug.set(null);
            }
          }, 1800);

          if (this.selectedFeedSlug() === packet.event.feedSlug) {
            this.loadNotesForFeed(packet.event.feedSlug);
          }
        }
      });
  }
}
