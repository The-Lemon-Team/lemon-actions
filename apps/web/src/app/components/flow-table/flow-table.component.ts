import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FlowRowState } from '../../core/models/flow.models';
import { FlowRowComponent, FsmTransitionEvent } from '../flow-row/flow-row.component';

@Component({
  selector: 'app-flow-table',
  standalone: true,
  imports: [FlowRowComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr class="bg-surface-container-low/75 text-on-surface-variant font-label-ui text-xs uppercase tracking-wider select-none border-b border-outline-variant/20">
              <th class="py-3 px-3 w-10">
                <input
                  type="checkbox"
                  [checked]="isAllPageSelected()"
                  [indeterminate]="isSomePageSelected()"
                  (change)="toggleSelectAllPage($any($event.target).checked)"
                  [attr.aria-label]="'table.selectAllAria' | trans"
                  class="rounded accent-primary-container cursor-pointer w-4 h-4"
                />
              </th>
              <th class="py-3 px-3">{{ 'table.colFlow' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colArchitecture' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colTelemetry' | trans }}</th>
              <th class="py-3 px-3">{{ 'table.colTaxonomy' | trans }}</th>
              <th class="py-3 px-4 text-right">{{ 'table.colPower' | trans }}</th>
            </tr>
          </thead>
          <tbody class="font-body-sm text-body-sm">
            @for (row of paginatedRows(); track row.flow.id; let odd = $odd) {
              <tr
                app-flow-row
                [state]="row"
                [isSelected]="selectedIds().has(row.flow.id)"
                [class]="odd ? 'bg-surface-container-low/20' : ''"
                (toggle)="toggle.emit($event)"
                (manage)="manage.emit($event)"
                (fsmTransition)="fsmTransition.emit($event)"
                (selectRow)="toggleSelectRow(row.flow.id, $event)"
              ></tr>
            } @empty {
              <tr>
                <td colspan="6" class="py-12 text-center text-on-surface-variant font-body-md">
                  <div class="flex flex-col items-center gap-2">
                    <span class="material-symbols-rounded text-3xl opacity-40">filter_alt_off</span>
                    <span>{{ 'table.emptyMessage' | trans }}</span>
                    <button
                      type="button"
                      (click)="createChannel.emit()"
                      class="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-ui text-xs font-semibold border border-outline-variant/30 transition-all"
                    >
                      <span class="material-symbols-rounded text-sm">add</span>
                      <span>{{ 'dashboard.createFlowChannel' | trans }}</span>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Footer: Active View, Page Size Selector, Legends, and Pagination Controls -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 font-label-code-sm text-xs text-on-surface-variant border-t border-outline-variant/20 bg-surface-container-low/30">
        <!-- Left: Counter, Selected badge, Page Size Selector -->
        <div class="flex items-center gap-3 sm:gap-4 flex-wrap w-full sm:w-auto justify-between sm:justify-start">
          <span class="font-medium text-on-surface">
            {{ 'table.activeView' | trans: { current: activeViewCurrent(), total: total } }}
          </span>

          @if (selectedCount() > 0) {
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/40 text-on-primary-container font-semibold text-[11px]">
              <span class="material-symbols-rounded text-xs">check_circle</span>
              <span>{{ 'table.selectedCount' | trans: { count: selectedCount() } }}</span>
            </span>
          }

          <div class="flex items-center gap-1.5">
            <span class="text-on-surface-variant text-[11px] hidden sm:inline">{{ 'table.pageSize' | trans }}</span>
            <div class="inline-flex rounded-lg bg-surface-container p-0.5 border border-outline-variant/20">
              @for (size of pageSizes; track size) {
                <button
                  type="button"
                  (click)="setPageSize(size)"
                  class="px-2 py-0.5 rounded text-[11px] transition-all font-medium"
                  [class]="
                    pageSize() === size
                      ? 'bg-surface-container-lowest text-on-surface font-bold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  "
                >
                  {{ size === 0 ? ('table.all' | trans) : size }}
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Right: Status Legend and Page Navigation -->
        <div class="flex items-center gap-3 sm:gap-4 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          <div class="hidden xl:flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 text-xs">
              <span class="w-2 h-2 rounded-full bg-success"></span>
              <span>{{ 'table.legendRunning' | trans }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs">
              <span class="w-2 h-2 rounded-full bg-warning"></span>
              <span>{{ 'table.legendPaused' | trans }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs">
              <span class="w-2 h-2 rounded-full bg-tertiary"></span>
              <span>{{ 'table.legendStandby' | trans }}</span>
            </span>
          </div>

          <!-- Pagination navigation buttons -->
          @if (pageSize() > 0 && totalPages() > 1) {
            <nav class="flex items-center gap-1" aria-label="Pagination">
              <button
                type="button"
                (click)="firstPage()"
                [disabled]="currentPage() <= 1"
                [attr.aria-label]="'table.firstPageAria' | trans"
                [title]="'table.firstPageAria' | trans"
                class="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <span class="material-symbols-rounded text-base">first_page</span>
              </button>
              <button
                type="button"
                (click)="prevPage()"
                [disabled]="currentPage() <= 1"
                [attr.aria-label]="'table.prevPageAria' | trans"
                [title]="'table.prevPageAria' | trans"
                class="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <span class="material-symbols-rounded text-base">chevron_left</span>
              </button>

              <div class="flex items-center gap-1 px-1">
                @for (p of visiblePages(); track $index) {
                  @if (p === '...') {
                    <span class="px-1 text-on-surface-variant select-none">…</span>
                  } @else {
                    <button
                      type="button"
                      (click)="setPage(+p)"
                      class="min-w-[26px] h-6 px-1.5 rounded text-xs font-medium transition-colors"
                      [class]="
                        currentPage() === p
                          ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                          : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                      "
                    >
                      {{ p }}
                    </button>
                  }
                }
              </div>

              <button
                type="button"
                (click)="nextPage()"
                [disabled]="currentPage() >= totalPages()"
                [attr.aria-label]="'table.nextPageAria' | trans"
                [title]="'table.nextPageAria' | trans"
                class="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <span class="material-symbols-rounded text-base">chevron_right</span>
              </button>
              <button
                type="button"
                (click)="lastPage()"
                [disabled]="currentPage() >= totalPages()"
                [attr.aria-label]="'table.lastPageAria' | trans"
                [title]="'table.lastPageAria' | trans"
                class="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <span class="material-symbols-rounded text-base">last_page</span>
              </button>
            </nav>
          }
        </div>
      </div>
    </div>
  `,
})
export class FlowTableComponent {
  private previousIdsSignature = '';

  readonly rawRows = signal<FlowRowState[]>([]);
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(this.loadStoredPageSize());
  readonly pageSizes = [10, 25, 50, 100, 0];

  readonly selectedIds = signal<Set<string>>(new Set<string>());

  @Input({ required: true }) set rows(val: FlowRowState[]) {
    const list = val ?? [];
    const currentSignature = list.length + ':' + (list[0]?.flow?.id ?? '');
    const isNewResultSet = this.previousIdsSignature !== '' && this.previousIdsSignature !== currentSignature;
    this.previousIdsSignature = currentSignature;

    this.rawRows.set(list);

    const max = this.totalPages();
    if (isNewResultSet && this.currentPage() > max) {
      this.currentPage.set(1);
    } else if (this.currentPage() > max) {
      this.currentPage.set(Math.max(1, max));
    }
  }

  @Input() total = 0;
  @Output() toggle = new EventEmitter<string>();
  @Output() manage = new EventEmitter<string>();
  @Output() fsmTransition = new EventEmitter<FsmTransitionEvent>();
  @Output() createChannel = new EventEmitter<void>();

  readonly totalPages = computed(() => {
    const len = this.rawRows().length;
    const size = this.pageSize();
    if (size <= 0 || len === 0) return 1;
    return Math.ceil(len / size);
  });

  readonly paginatedRows = computed(() => {
    const list = this.rawRows();
    const size = this.pageSize();
    if (size <= 0) return list;
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly startIndex = computed(() => {
    const len = this.rawRows().length;
    if (len === 0) return 0;
    const size = this.pageSize();
    if (size <= 0) return 1;
    const page = Math.min(this.currentPage(), this.totalPages());
    return (page - 1) * size + 1;
  });

  readonly endIndex = computed(() => {
    const len = this.rawRows().length;
    if (len === 0) return 0;
    const size = this.pageSize();
    if (size <= 0) return len;
    const page = Math.min(this.currentPage(), this.totalPages());
    return Math.min(page * size, len);
  });

  readonly activeViewCurrent = computed(() => {
    const len = this.rawRows().length;
    if (len === 0) return '0';
    const start = this.startIndex();
    const end = this.endIndex();
    return start === end ? `${start}` : `${start}-${end}`;
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly isAllPageSelected = computed(() => {
    const pageRows = this.paginatedRows();
    if (pageRows.length === 0) return false;
    const selected = this.selectedIds();
    return pageRows.every((r) => selected.has(r.flow.id));
  });

  readonly isSomePageSelected = computed(() => {
    const pageRows = this.paginatedRows();
    if (pageRows.length === 0) return false;
    const selected = this.selectedIds();
    const count = pageRows.filter((r) => selected.has(r.flow.id)).length;
    return count > 0 && count < pageRows.length;
  });

  readonly visiblePages = computed<(number | string)[]>(() => {
    const total = this.totalPages();
    const current = Math.min(this.currentPage(), total);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  setPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  firstPage(): void {
    this.setPage(1);
  }

  prevPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  lastPage(): void {
    this.setPage(this.totalPages());
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    try {
      localStorage.setItem('lemon_flow_table_page_size', String(size));
    } catch {
      // ignore
    }
  }

  toggleSelectAllPage(checked: boolean): void {
    const pageRows = this.paginatedRows();
    const next = new Set(this.selectedIds());
    if (checked) {
      for (const r of pageRows) next.add(r.flow.id);
    } else {
      for (const r of pageRows) next.delete(r.flow.id);
    }
    this.selectedIds.set(next);
  }

  toggleSelectRow(flowId: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(flowId);
    } else {
      next.delete(flowId);
    }
    this.selectedIds.set(next);
  }

  private loadStoredPageSize(): number {
    try {
      const stored = localStorage.getItem('lemon_flow_table_page_size');
      if (stored !== null) {
        const val = parseInt(stored, 10);
        if ([10, 25, 50, 100, 0].includes(val)) {
          return val;
        }
      }
    } catch {
      // ignore
    }
    return 10;
  }
}
