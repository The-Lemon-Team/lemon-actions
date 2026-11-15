import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import {
  SeasonsFeedNodeView,
  SeasonsStreamNodeView,
} from '../../core/models/seasons.models';
import {
  PositionedStreamBubble,
  computeStreamBubblesLayout,
  resolveBubbleAccent,
} from './seasons-bubble-layout.util';

export type SeasonsBubblePrivacyFilter = 'all' | 'private' | 'public';

@Component({
  selector: 'app-seasons-bubble-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes lemonBubbleFloat {
        0%, 100% {
          transform: translate(-50%, -50%) translateY(0px);
        }
        50% {
          transform: translate(-50%, -50%) translateY(-8px);
        }
      }
      .bubble-ambient-float {
        animation-name: lemonBubbleFloat;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }
      .bubble-selected-anchor {
        transform: translate(-50%, -50%) scale(1.02);
      }
    `,
  ],
  template: `
    <section class="relative w-full rounded-3xl bg-surface-container-low border border-outline-variant/30 overflow-hidden shadow-xs">
      <!-- TOP BAR INSIDE CONTAINER -->
      <div class="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-md">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-headline-sm text-sm font-bold text-on-surface">
            Streams & Feeds Bubble Map
          </span>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/15 text-primary font-semibold">
            {{ visibleStreams().length }} streams · {{ totalVisibleFeeds() }} feeds
          </span>
          @if (selectedStreamSlug) {
            <button
              type="button"
              (click)="clearSelection.emit()"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-container-high hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-xs">zoom_out_map</span>
              <span>Сбросить фокус</span>
            </button>
          }
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Privacy filter -->
          <div class="inline-flex items-center p-0.5 rounded-xl bg-surface-container border border-outline-variant/25">
            @for (opt of privacyOptions; track opt.id) {
              <button
                type="button"
                (click)="privacyFilter.set(opt.id)"
                [class]="privacyTabClass(opt.id)"
              >
                {{ opt.label }}
              </button>
            }
          </div>

          <!-- Quick search -->
          <div class="relative">
            <span class="material-symbols-rounded text-sm text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              [value]="searchText()"
              (input)="onSearchInput($event)"
              placeholder="Фильтр стримов..."
              class="pl-8 pr-3 py-1.5 w-44 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <!-- FLOATING BUBBLES STAGE -->
      <div
        class="relative w-full h-[580px] overflow-hidden select-none"
        style="background: radial-gradient(circle at 20% 25%, rgba(245, 158, 11, 0.08), transparent 45%), radial-gradient(circle at 80% 75%, rgba(59, 130, 246, 0.08), transparent 48%);"
        (click)="onStageBackgroundClick($event)"
      >
        @if (positionedBubbles().length === 0) {
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-2">
            <span class="material-symbols-rounded text-4xl text-on-surface-variant/50">bubble_chart</span>
            <p class="text-sm font-semibold text-on-surface-variant">
              Нет стримов по выбранному фильтру
            </p>
            <p class="text-xs text-on-surface-variant/80 max-w-md">
              Создайте новый приватный стрим или проверьте подключение к Lemon Seasons.
            </p>
          </div>
        }

        @for (item of positionedBubbles(); track item.stream.id; let idx = $index) {
          @let isSelected = item.stream.slug === selectedStreamSlug;
          @let isDimmed = selectedStreamSlug !== null && !isSelected;
          @let accent = accentColor(item.stream.color, idx);

          <div
            role="button"
            tabindex="0"
            (click)="onStreamBubbleClick($event, item.stream)"
            (keydown.enter)="onStreamBubbleClick($event, item.stream)"
            [attr.aria-label]="'Stream ' + item.stream.title"
            [attr.aria-expanded]="isSelected"
            [style.left.%]="item.xPercent"
            [style.top.%]="item.yPercent"
            [style.width.px]="item.diameterPx"
            [style.height.px]="item.diameterPx"
            [style.borderColor]="accent"
            [style.boxShadow]="streamShadow(accent, isSelected)"
            [style.background]="streamBackground(accent, isSelected)"
            [style.animationDelay.s]="item.floatDelaySec"
            [style.animationDuration.s]="item.floatDurationSec"
            [class]="streamBubbleClass(isSelected, isDimmed)"
          >
            @if (!isSelected) {
              <!-- COMPACT STREAM BUBBLE -->
              <div class="flex flex-col items-center justify-center text-center px-3 gap-1 pointer-events-none">
                <div class="flex items-center gap-1">
                  <span class="text-lg leading-none">{{ displayStreamIcon(item.stream.icon) }}</span>
                  @if (item.stream.privacy === 'private') {
                    <span class="material-symbols-rounded text-xs text-amber-500" title="Private stream">lock</span>
                  }
                </div>
                <span class="text-xs font-bold text-on-surface leading-tight line-clamp-2 max-w-[110px]">
                  {{ item.stream.title }}
                </span>
                <div class="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant">
                  <span>{{ item.stream.totalNotes }} notes</span>
                  <span>·</span>
                  <span>{{ item.feeds.length }} feeds</span>
                </div>
              </div>
            } @else {
              <!-- EXPANDED STREAM BUBBLE WITH HIGHLIGHTED INNER FEED BUBBLES -->
              <div class="relative w-full h-full">
                <!-- Stream badge at top center of expanded bubble -->
                <div
                  class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/90 border border-outline-variant/40 shadow-xs backdrop-blur-sm whitespace-nowrap"
                >
                  <span class="text-sm leading-none">{{ displayStreamIcon(item.stream.icon) }}</span>
                  <span class="text-xs font-bold text-on-surface">{{ item.stream.title }}</span>
                  @if (item.stream.privacy === 'private') {
                    <span class="material-symbols-rounded text-xs text-amber-500">lock</span>
                  }
                  <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                    {{ item.stream.totalNotes }}
                  </span>
                </div>

                @if (item.innerFeeds.length === 0) {
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pt-6">
                    <span class="text-xs text-on-surface-variant font-medium">
                      В этом стриме пока нет фидов
                    </span>
                    <button
                      type="button"
                      (click)="onCreateFeedClick($event, item.stream.slug)"
                      class="mt-2 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold shadow-2xs hover:shadow transition-all cursor-pointer"
                    >
                      + Добавить Feed
                    </button>
                  </div>
                }

                <!-- Inner Feed Bubbles -->
                @for (inner of item.innerFeeds; track inner.feed.id; let fIdx = $index) {
                  @let isFeedSelected = inner.feed.slug === selectedFeedSlug;
                  @let isPulsing = pulsingFeedSlug === inner.feed.slug;
                  @let feedAccent = accentColor(inner.feed.color || item.stream.color, fIdx + 2);

                  <button
                    type="button"
                    (click)="onFeedBubbleClick($event, item.stream, inner.feed)"
                    [style.left.%]="inner.relXPercent"
                    [style.top.%]="inner.relYPercent"
                    [style.width.px]="inner.sizePx"
                    [style.height.px]="inner.sizePx"
                    [style.borderColor]="feedAccent"
                    [style.background]="feedBackground(feedAccent, isFeedSelected)"
                    [style.boxShadow]="feedShadow(feedAccent, isFeedSelected, isPulsing)"
                    [style.transitionDelay.ms]="inner.delayMs"
                    [class]="feedBubbleClass(isFeedSelected, isPulsing)"
                    [title]="inner.feed.title + ' (' + inner.feed.totalNotes + ' notes)'"
                  >
                    <span class="text-sm leading-none">{{ displayFeedIcon(inner.feed.icon) }}</span>
                    <span class="text-[10px] font-bold text-on-surface leading-tight line-clamp-2 px-1">
                      {{ inner.feed.title }}
                    </span>
                    <span class="text-[9px] font-mono font-semibold text-on-surface-variant">
                      {{ inner.feed.totalNotes }}
                    </span>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class SeasonsBubbleCanvasComponent {
  readonly streamsSignal = signal<SeasonsStreamNodeView[]>([]);
  readonly feedsSignal = signal<SeasonsFeedNodeView[]>([]);
  readonly selectedStreamSignal = signal<string | null>(null);

  @Input() set streams(value: SeasonsStreamNodeView[]) {
    this.streamsSignal.set(value || []);
  }
  @Input() set feeds(value: SeasonsFeedNodeView[]) {
    this.feedsSignal.set(value || []);
  }
  @Input() set selectedStreamSlug(value: string | null) {
    this._selectedStreamSlug = value;
    this.selectedStreamSignal.set(value);
  }
  get selectedStreamSlug(): string | null {
    return this._selectedStreamSlug;
  }
  private _selectedStreamSlug: string | null = null;

  @Input() selectedFeedSlug: string | null = null;
  @Input() pulsingFeedSlug: string | null = null;

  @Output() streamSelect = new EventEmitter<SeasonsStreamNodeView>();
  @Output() feedSelect = new EventEmitter<{ stream: SeasonsStreamNodeView; feed: SeasonsFeedNodeView }>();
  @Output() clearSelection = new EventEmitter<void>();
  @Output() createFeedInStream = new EventEmitter<string>();

  readonly privacyFilter = signal<SeasonsBubblePrivacyFilter>('all');
  readonly searchText = signal<string>('');

  readonly privacyOptions: Array<{ id: SeasonsBubblePrivacyFilter; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'private', label: 'Private' },
    { id: 'public', label: 'Public' },
  ];

  readonly visibleStreams = computed(() => {
    const priv = this.privacyFilter();
    const query = this.searchText().trim().toLowerCase();
    return this.streamsSignal().filter((s) => {
      if (priv !== 'all' && s.privacy !== priv) return false;
      if (query) {
        const hay = `${s.title} ${s.slug} ${s.description || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  });

  readonly positionedBubbles = computed<PositionedStreamBubble[]>(() =>
    computeStreamBubblesLayout(
      this.visibleStreams(),
      this.feedsSignal(),
      this.selectedStreamSignal(),
    ),
  );

  readonly totalVisibleFeeds = computed(() => {
    const ids = new Set<string>();
    for (const b of this.positionedBubbles()) {
      for (const f of b.feeds) ids.add(f.id || f.slug);
    }
    return ids.size;
  });

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchText.set(val);
  }

  onStageBackgroundClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.selectedStreamSlug) {
      this.clearSelection.emit();
    }
  }

  onStreamBubbleClick(event: Event, stream: SeasonsStreamNodeView): void {
    event.stopPropagation();
    this.streamSelect.emit(stream);
  }

  onFeedBubbleClick(event: Event, stream: SeasonsStreamNodeView, feed: SeasonsFeedNodeView): void {
    event.stopPropagation();
    this.feedSelect.emit({ stream, feed });
  }

  onCreateFeedClick(event: Event, streamSlug: string): void {
    event.stopPropagation();
    this.createFeedInStream.emit(streamSlug);
  }

  accentColor(color: string | null | undefined, index: number): string {
    return resolveBubbleAccent(color, index);
  }

  displayStreamIcon(icon?: string | null): string {
    if (!icon || icon.length > 4) return '🌊';
    return icon;
  }

  displayFeedIcon(icon?: string | null): string {
    if (!icon || icon.length > 4) return '📌';
    return icon;
  }

  privacyTabClass(id: SeasonsBubblePrivacyFilter): string {
    const base = 'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer';
    return this.privacyFilter() === id
      ? `${base} bg-primary-container text-on-primary-container shadow-2xs`
      : `${base} text-on-surface-variant hover:text-on-surface`;
  }

  streamBubbleClass(isSelected: boolean, isDimmed: boolean): string {
    const base =
      'absolute rounded-full border-2 flex items-center justify-center transition-all duration-300 cursor-pointer backdrop-blur-md';
    if (isSelected) {
      return `${base} z-30 bubble-selected-anchor`;
    }
    if (isDimmed) {
      return `${base} z-10 opacity-45 hover:opacity-85 bubble-ambient-float`;
    }
    return `${base} z-10 hover:scale-105 bubble-ambient-float`;
  }

  feedBubbleClass(isSelected: boolean, isPulsing: boolean): string {
    const base =
      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer hover:scale-110 z-10';
    if (isSelected) {
      return `${base} z-20 ring-2 ring-primary ring-offset-2 ring-offset-surface scale-105`;
    }
    if (isPulsing) {
      return `${base} animate-pulse`;
    }
    return base;
  }

  streamBackground(accent: string, isSelected: boolean): string {
    return isSelected
      ? `radial-gradient(circle at 30% 25%, ${accent}33, ${accent}14 68%, rgba(15, 23, 42, 0.08))`
      : `radial-gradient(circle at 30% 30%, ${accent}28, ${accent}0d 72%)`;
  }

  streamShadow(accent: string, isSelected: boolean): string {
    return isSelected
      ? `0 0 0 4px ${accent}30, 0 20px 50px -12px ${accent}55`
      : `0 10px 25px -10px ${accent}40`;
  }

  feedBackground(accent: string, isSelected: boolean): string {
    return isSelected
      ? `radial-gradient(circle at 30% 30%, ${accent}45, ${accent}22)`
      : `radial-gradient(circle at 30% 30%, ${accent}28, ${accent}10)`;
  }

  feedShadow(accent: string, isSelected: boolean, isPulsing: boolean): string {
    if (isSelected || isPulsing) {
      return `0 0 0 3px ${accent}38, 0 8px 20px -6px ${accent}66`;
    }
    return `0 4px 12px -4px ${accent}35`;
  }
}
