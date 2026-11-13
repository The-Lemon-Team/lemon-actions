import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Flow, TagWithCount } from '../../core/models/flow.models';
import { TagCloudComponent } from '../tag-cloud/tag-cloud.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [TagCloudComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex flex-col gap-space-md">
      <!-- Workspace Switcher -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30">
        <div class="flex items-center justify-between gap-space-sm cursor-pointer select-none group">
          <div class="flex items-center gap-space-sm min-w-0">
            <div
              class="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0 text-on-surface"
            >
              <span class="material-symbols-rounded text-lg" style="font-variation-settings: 'FILL' 1">lan</span>
            </div>
            <div class="min-w-0 flex flex-col">
              <span class="font-headline-sm text-sm text-on-surface truncate tracking-tight font-bold">{{
                workspaceName
              }}</span>
              <div class="flex items-center gap-1.5 pt-0.5">
                <span class="relative flex h-2 w-2">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/70 opacity-75"
                  ></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span class="font-label-code-sm text-xs text-on-surface-variant">
                  {{ activeFlows }} {{ 'sidebar.channelsActive' | trans }}
                </span>
              </div>
            </div>
          </div>
          <span
            class="material-symbols-rounded text-on-surface-variant group-hover:text-on-surface transition-colors text-base"
            >unfold_more</span
          >
        </div>
      </div>

      <!-- System Concurrency & Mutex Guard Status Card -->
      <div
        class="rounded-xl p-space-md shadow-sm border transition-all"
        [class]="
          isMutexLocked
            ? 'bg-warning/10 border-warning/40 shadow-[0_0_12px_rgb(var(--c-warning)/0.15)]'
            : 'bg-surface-container-lowest border-outline-variant/30'
        "
      >
        <div class="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div class="flex items-center gap-1.5">
            <span
              class="material-symbols-rounded text-base"
              [class]="isMutexLocked ? 'text-warning animate-pulse' : 'text-success'"
            >
              {{ isMutexLocked ? 'lock' : 'verified_user' }}
            </span>
            <span class="font-label-ui text-xs uppercase tracking-wider font-bold text-on-surface">
              {{ isMutexLocked ? ('sidebar.mutexLockedEngaged' | trans) : ('sidebar.systemGuardClear' | trans) }}
            </span>
          </div>
          <span
            class="font-label-code-sm text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            [class]="isMutexLocked ? 'bg-warning text-on-warning' : 'bg-success-container text-on-success-container'"
          >
            {{ isMutexLocked ? ('sidebar.lockedBadge' | trans) : ('sidebar.readyBadge' | trans) }}
          </span>
        </div>

        <div class="pt-2.5 flex flex-col gap-1.5 font-body-sm text-xs">
          @if (isMutexLocked) {
            <p class="text-on-surface font-medium leading-relaxed">
              {{ 'sidebar.exclusiveLockDesc' | trans }}
            </p>
            @for (lock of activeLocks; track lock.id) {
              <div
                class="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container text-on-surface font-label-code-sm text-xs"
              >
                <span class="material-symbols-rounded text-xs text-warning">lock</span>
                <span class="font-bold truncate">{{ i18n.translateFlow(lock).name }}</span>
              </div>
            }
            <p class="text-on-surface-variant text-[11px] leading-tight">
              {{ 'sidebar.dependentRulesDesc' | trans }}
            </p>
          } @else {
            <p class="text-on-surface-variant leading-relaxed">
              {{ 'sidebar.noConflictsDesc' | trans }}
            </p>
          }
        </div>
      </div>

      <!-- Tags & Labels Section -->
      <div
        class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm transition-all"
        [class.pb-2]="isCollapsed"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-1.5 px-space-xs pb-1 border-b border-outline-variant/15">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="material-symbols-rounded text-sm text-primary/80" style="font-variation-settings: 'FILL' 1">
              sell
            </span>
            <span class="font-label-ui text-xs uppercase tracking-wider text-on-surface-variant font-bold truncate">
              {{ 'sidebar.taxonomyFilters' | trans }}
            </span>
            <span
              class="font-label-code-sm text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container text-on-surface-variant font-bold"
            >
              {{ tags.length }}
            </span>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <!-- Active tag quick chip in header -->
            @if (selectedTag; as sel) {
              <div
                class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-code-sm text-[11px] shadow-xs ring-1 ring-primary/20"
                [title]="sel.name"
              >
                <span class="font-bold truncate max-w-[80px] sm:max-w-[120px]">#{{ sel.name }}</span>
                <button
                  type="button"
                  (click)="clearFilter($event)"
                  [title]="'sidebar.clearTagFilter' | trans"
                  [attr.aria-label]="'sidebar.clearTagFilter' | trans"
                  class="w-4 h-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span class="material-symbols-rounded text-xs">close</span>
                </button>
              </div>
            }

            <!-- Mobile View Mode Toggle (Strip vs Grid) -->
            <button
              type="button"
              (click)="toggleMobileViewMode($event)"
              [title]="(isMobileGrid ? 'sidebar.viewModeStrip' : 'sidebar.viewModeGrid') | trans"
              [attr.aria-label]="(isMobileGrid ? 'sidebar.viewModeStrip' : 'sidebar.viewModeGrid') | trans"
              class="xl:hidden p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-base">
                {{ isMobileGrid ? 'view_carousel' : 'grid_view' }}
              </span>
            </button>

            <!-- Collapse / Expand Button -->
            <button
              type="button"
              (click)="toggleCollapse()"
              [title]="(isCollapsed ? 'sidebar.expandTaxonomy' : 'sidebar.collapseTaxonomy') | trans"
              [attr.aria-label]="(isCollapsed ? 'sidebar.expandTaxonomy' : 'sidebar.collapseTaxonomy') | trans"
              class="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span
                class="material-symbols-rounded text-base transition-transform duration-200"
                [class.rotate-180]="isCollapsed"
              >
                expand_less
              </span>
            </button>
          </div>
        </div>

        @if (!isCollapsed) {
          <!-- Mobile Strip View (active on screens < xl when isMobileGrid is false) -->
          <div [class]="isMobileGrid ? 'hidden' : 'block xl:hidden'">
            <div class="flex items-center gap-1.5 min-w-0">
              <app-tag-cloud
                class="min-w-0 flex-1 overflow-hidden"
                layout="strip"
                [tags]="stripTags"
                (select)="onTagSelect($event)"
              />
              @if (tags.length > 5) {
                <button
                  type="button"
                  (click)="isMobileGrid = true"
                  class="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-code-sm text-[11px] transition-colors border border-outline-variant/30 cursor-pointer"
                  [title]="'sidebar.showAllTags' | trans"
                >
                  <span class="material-symbols-rounded text-xs">grid_view</span>
                  <span>+{{ tags.length - 5 > 0 ? tags.length - 5 : tags.length }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Grid View (default on desktop xl:, or on mobile when isMobileGrid is true) -->
          <div [class]="isMobileGrid ? 'flex flex-col gap-space-sm' : 'hidden xl:flex flex-col gap-space-sm'">
            <!-- Search field if tags > 6 -->
            @if (tags.length > 6) {
              <div class="relative">
                <span class="material-symbols-rounded absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-outline">
                  search
                </span>
                <input
                  type="text"
                  [placeholder]="'sidebar.searchTagsPlaceholder' | trans"
                  [value]="searchQuery"
                  (input)="onSearchInput($event)"
                  class="w-full pl-8 pr-7 py-1 rounded-lg bg-surface-container-low border border-outline-variant/40 text-on-surface placeholder:text-outline font-body-sm text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-colors"
                />
                @if (searchQuery) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-rounded text-xs">close</span>
                  </button>
                }
              </div>
            }

            <!-- Tags Cloud or Empty Search State -->
            @if (gridTags.length > 0) {
              <div class="max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                <app-tag-cloud [tags]="gridTags" layout="wrap" (select)="onTagSelect($event)" />
              </div>
            } @else {
              <div
                class="py-3 text-center text-xs text-on-surface-variant font-body-sm flex flex-col items-center gap-1"
              >
                <span>{{ 'sidebar.noTagsFound' | trans }}</span>
                @if (searchQuery) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="text-primary hover:underline text-[11px] font-semibold cursor-pointer"
                  >
                    {{ 'sidebar.clearTagFilter' | trans }}
                  </button>
                }
              </div>
            }

            <!-- Bottom Actions -->
            <div class="flex items-center justify-between pt-1">
              @if (tags.length > limit && !searchQuery) {
                <button
                  type="button"
                  (click)="showAll = !showAll"
                  class="inline-flex items-center gap-1 text-[11px] font-label-ui font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <span class="material-symbols-rounded text-xs">{{ showAll ? 'expand_less' : 'expand_more' }}</span>
                  <span>{{ (showAll ? 'sidebar.showFewerTags' : 'sidebar.showAllTags') | trans }}</span>
                  @if (!showAll) {
                    <span class="text-on-surface-variant font-normal">({{ tags.length }})</span>
                  }
                </button>
              } @else {
                <span></span>
              }

              <!-- Mobile switch back to strip -->
              <button
                type="button"
                (click)="isMobileGrid = false"
                class="xl:hidden inline-flex items-center gap-1 text-[11px] font-label-ui font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span class="material-symbols-rounded text-xs">view_carousel</span>
                <span>{{ 'sidebar.viewModeStrip' | trans }}</span>
              </button>
            </div>
          </div>
        }
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  protected readonly i18n = inject(I18nService);

  @Input() workspaceName = 'Acme Production';
  @Input() activeFlows = 0;
  @Input() isMutexLocked = false;
  @Input() activeLocks: Flow[] = [];
  @Input({ required: true }) tags: TagWithCount[] = [];

  @Output() tagSelect = new EventEmitter<string>();
  @Output() tagClear = new EventEmitter<void>();

  readonly limit = 8;
  isCollapsed = false;
  isMobileGrid = false;
  showAll = false;
  searchQuery = '';

  get selectedTag(): TagWithCount | null {
    return this.tags.find((t) => t.isSelected) ?? null;
  }

  get stripTags(): TagWithCount[] {
    const sel = this.selectedTag;
    if (!sel) return this.tags;
    return [sel, ...this.tags.filter((t) => t.id !== sel.id)];
  }

  get gridTags(): TagWithCount[] {
    const q = this.searchQuery.trim().toLowerCase();
    let list = this.tags;
    if (q) {
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (!q && !this.showAll && list.length > this.limit) {
      const top = list.slice(0, this.limit);
      const sel = this.selectedTag;
      if (sel && !top.some((t) => t.id === sel.id)) {
        return [sel, ...top.slice(0, this.limit - 1)];
      }
      return top;
    }
    return list;
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleMobileViewMode(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMobileGrid = !this.isMobileGrid;
  }

  onTagSelect(tagName: string): void {
    this.tagSelect.emit(tagName);
  }

  clearFilter(event?: Event): void {
    if (event) event.stopPropagation();
    if (this.selectedTag) {
      this.tagSelect.emit(this.selectedTag.name);
      this.tagClear.emit();
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target?.value ?? '';
  }

  clearSearch(): void {
    this.searchQuery = '';
  }
}
