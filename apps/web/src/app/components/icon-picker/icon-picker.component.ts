import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ICON_CATEGORIES,
  ICON_CATALOG,
  IconCatalogItem,
  IconCategoryItem,
  QUICK_FAVORITE_ICONS,
  findIconItem,
  getIconLabel,
} from './icon-catalog';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5 w-full">
      @if (label) {
        <span class="font-label-ui text-xs font-semibold text-on-surface flex items-center justify-between">
          <span>{{ label }}</span>
          <span class="text-[11px] font-normal text-on-surface-variant font-mono opacity-80">{{ value }}</span>
        </span>
      }

      <!-- TRIGGER BUTTON: Visual display of selected icon -->
      <button
        type="button"
        (click)="openPicker()"
        class="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 hover:border-primary/60 hover:bg-surface-container transition-all group text-left cursor-pointer"
        [title]="'Изменить иконку: ' + currentLabel()"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs group-hover:bg-primary group-hover:text-on-primary transition-all"
          >
            <span class="material-symbols-rounded text-xl">{{ value || 'casino' }}</span>
          </div>

          <div class="flex flex-col min-w-0">
            <span class="text-xs font-bold text-on-surface truncate">
              {{ currentLabel() }}
            </span>
            <span class="text-[10px] font-mono text-on-surface-variant truncate">
              {{ value || 'casino' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <span
            class="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 group-hover:bg-primary group-hover:text-on-primary transition-colors"
          >
            <span class="material-symbols-rounded text-sm">palette</span>
            <span class="hidden sm:inline">Выбрать визуально</span>
          </span>
          <span class="material-symbols-rounded text-base text-on-surface-variant group-hover:text-on-surface transition-colors">
            expand_more
          </span>
        </div>
      </button>

      <!-- QUICK-SELECT POPULAR ICONS ROW -->
      @if (showQuickFavorites) {
        <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          <span class="text-[10px] text-on-surface-variant shrink-0 font-medium mr-0.5">Быстро:</span>
          @for (favName of quickFavorites; track favName) {
            <button
              type="button"
              (click)="selectQuickIcon(favName)"
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer"
              [class]="
                value === favName
                  ? 'bg-primary text-on-primary border-primary shadow-xs ring-2 ring-primary/20'
                  : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-primary/50 hover:bg-surface-container'
              "
              [title]="getLabel(favName) + ' (' + favName + ')'"
            >
              <span class="material-symbols-rounded text-base">{{ favName }}</span>
            </button>
          }
        </div>
      }
    </div>

    <!-- MODAL DIALOG: RICH VISUAL ICON BROWSER -->
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        (click)="closePicker()"
        (keydown.escape)="closePicker()"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          (click)="$event.stopPropagation()"
        >
          <!-- HEADER -->
          <div class="p-4 sm:p-5 border-b border-outline-variant/30 flex items-center justify-between gap-3 bg-surface-container-lowest">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span class="material-symbols-rounded text-2xl">palette</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Библиотека Иконок Желаний
                </h3>
                <p class="font-body-sm text-xs text-on-surface-variant">
                  Выберите визуально из {{ totalCount }} иконок или найдите по смыслу
                </p>
              </div>
            </div>

            <button
              type="button"
              (click)="closePicker()"
              class="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Закрыть"
            >
              <span class="material-symbols-rounded text-xl">close</span>
            </button>
          </div>

          <!-- SEARCH & CATEGORY FILTERS -->
          <div class="p-4 sm:px-5 sm:py-3.5 border-b border-outline-variant/30 bg-surface-container-low/50 flex flex-col gap-3">
            <!-- SEARCH INPUT -->
            <div class="relative w-full">
              <span class="material-symbols-rounded text-lg text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                #searchInput
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Поиск по названию или смыслу (пицца, настолка, картинг, баня, кино, код, кофе)..."
                class="w-full pl-9 pr-9 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-on-surface outline-hidden"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="searchQuery.set('')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-high transition-colors"
                >
                  <span class="material-symbols-rounded text-sm">close</span>
                </button>
              }
            </div>

            <!-- CATEGORY PILLS -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              @for (cat of categoriesWithCounts(); track cat.id) {
                <button
                  type="button"
                  (click)="selectedCategory.set(cat.id)"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-label-ui font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border"
                  [class]="
                    selectedCategory() === cat.id
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-primary/40'
                  "
                >
                  <span class="material-symbols-rounded text-sm">{{ cat.icon }}</span>
                  <span>{{ cat.name }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
                    [class]="selectedCategory() === cat.id ? 'bg-black/20 text-white' : 'bg-surface-container text-on-surface-variant'"
                  >
                    {{ cat.count }}
                  </span>
                </button>
              }
            </div>
          </div>

          <!-- ICON GRID BODY -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[380px] bg-surface-container-lowest">
            @if (filteredIcons().length === 0) {
              <div class="py-12 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant">
                <span class="material-symbols-rounded text-4xl opacity-50">search_off</span>
                <p class="font-headline-sm text-sm font-bold text-on-surface">Ничего не найдено</p>
                <p class="font-body-sm text-xs max-w-sm">
                  По запросу «{{ searchQuery() }}» иконок не найдено. Вы можете сбросить поиск или ввести системное имя ниже.
                </p>
                <button
                  type="button"
                  (click)="searchQuery.set(''); selectedCategory.set('all')"
                  class="mt-2 px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  Сбросить фильтры
                </button>
              </div>
            } @else {
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                @for (item of filteredIcons(); track item.name) {
                  <button
                    type="button"
                    (click)="pickTemp(item.name)"
                    (dblclick)="confirmSelection(item.name)"
                    class="relative group p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer select-none"
                    [class]="
                      tempSelectedIcon() === item.name
                        ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                        : 'bg-surface-container-low/60 border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container hover:shadow-2xs'
                    "
                    [title]="item.label + ' (' + item.name + ')\nДвойной клик — выбрать сразу'"
                  >
                    <!-- SELECTED BADGE -->
                    @if (tempSelectedIcon() === item.name) {
                      <span class="absolute top-1 right-1 material-symbols-rounded text-primary text-sm">
                        check_circle
                      </span>
                    }

                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-115"
                      [class]="tempSelectedIcon() === item.name ? 'text-primary' : 'text-on-surface'"
                    >
                      <span class="material-symbols-rounded text-2xl">{{ item.name }}</span>
                    </div>

                    <span
                      class="text-[11px] font-semibold leading-tight line-clamp-1 w-full"
                      [class]="tempSelectedIcon() === item.name ? 'text-primary font-bold' : 'text-on-surface'"
                    >
                      {{ item.label }}
                    </span>

                    <span class="text-[9px] font-mono text-on-surface-variant/70 truncate w-full">
                      {{ item.name }}
                    </span>
                  </button>
                }
              </div>
            }
          </div>

          <!-- CUSTOM MATERIAL SYMBOL INPUT BAR -->
          <div class="p-3 sm:px-5 sm:py-2.5 border-t border-outline-variant/30 bg-surface-container-low/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-xs font-label-ui font-semibold text-on-surface shrink-0 hidden md:inline">
                Любая иконка Google:
              </span>
              <div class="relative flex-1">
                <input
                  type="text"
                  [ngModel]="customSymbolInput()"
                  (ngModelChange)="customSymbolInput.set($event)"
                  placeholder="Ввести имя из Material Symbols (напр.: celebration, skate...)"
                  class="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs font-mono text-on-surface placeholder:font-sans focus:border-primary focus:ring-1 focus:ring-primary/20 outline-hidden"
                />
              </div>
            </div>

            <div class="flex items-center gap-2 justify-end shrink-0">
              <div
                class="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface border border-outline-variant/40"
                title="Предпросмотр пользовательского символа"
              >
                <span class="material-symbols-rounded text-base">{{ customSymbolInput() || 'help' }}</span>
              </div>
              <button
                type="button"
                [disabled]="!customSymbolInput().trim()"
                (click)="applyCustomSymbol()"
                class="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary disabled:opacity-40 disabled:hover:bg-surface-container-high disabled:hover:text-inherit text-xs font-bold transition-all"
              >
                Применить
              </button>
            </div>
          </div>

          <!-- FOOTER: PREVIEW & ACTIONS -->
          <div class="p-4 sm:px-5 sm:py-3.5 border-t border-outline-variant/30 bg-surface-container-lowest flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
                <span class="material-symbols-rounded text-2xl">{{ tempSelectedIcon() }}</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-bold text-on-surface truncate">
                  {{ getLabel(tempSelectedIcon()) }}
                </span>
                <span class="text-[10px] font-mono text-on-surface-variant truncate">
                  material-symbols: {{ tempSelectedIcon() }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="closePicker()"
                class="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-ui text-xs font-bold hover:bg-surface-container-highest transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                (click)="confirmSelection(tempSelectedIcon())"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:brightness-105 transition-all flex items-center gap-1.5"
              >
                <span class="material-symbols-rounded text-base">check</span>
                <span>Выбрать эту иконку</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `,
  ],
})
export class IconPickerComponent {
  @Input() value: string = 'casino';
  @Input() label: string = 'Иконка (Material)';
  @Input() showQuickFavorites: boolean = true;

  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly iconSelected = new EventEmitter<IconCatalogItem>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  readonly quickFavorites = QUICK_FAVORITE_ICONS;
  readonly totalCount = ICON_CATALOG.length;

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly selectedCategory = signal<string>('all');
  readonly tempSelectedIcon = signal<string>('casino');
  readonly customSymbolInput = signal<string>('');

  readonly currentLabel = computed(() => {
    return getIconLabel(this.value);
  });

  readonly categoriesWithCounts = computed(() => {
    const counts = new Map<string, number>();
    counts.set('all', ICON_CATALOG.length);
    for (const item of ICON_CATALOG) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return ICON_CATEGORIES.map((cat) => ({
      ...cat,
      count: counts.get(cat.id) || 0,
    }));
  });

  readonly filteredIcons = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    return ICON_CATALOG.filter((item) => {
      // 1. Category check
      if (cat !== 'all' && item.category !== cat) {
        return false;
      }

      // 2. Search query check
      if (!q) {
        return true;
      }

      if (item.name.toLowerCase().includes(q)) return true;
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.keywords.some((k) => k.toLowerCase().includes(q))) return true;

      return false;
    });
  });

  getLabel(name: string): string {
    return getIconLabel(name);
  }

  openPicker(): void {
    this.tempSelectedIcon.set(this.value || 'casino');
    this.searchQuery.set('');
    this.customSymbolInput.set('');
    this.isOpen.set(true);

    setTimeout(() => {
      this.searchInputElement?.nativeElement?.focus();
    }, 50);
  }

  closePicker(): void {
    this.isOpen.set(false);
  }

  selectQuickIcon(iconName: string): void {
    this.confirmSelection(iconName);
  }

  pickTemp(iconName: string): void {
    this.tempSelectedIcon.set(iconName);
  }

  applyCustomSymbol(): void {
    const sym = this.customSymbolInput().trim().toLowerCase().replace(/\s+/g, '_');
    if (!sym) return;
    this.confirmSelection(sym);
  }

  confirmSelection(iconName: string): void {
    const finalName = (iconName || 'casino').trim();
    this.value = finalName;
    this.valueChange.emit(finalName);

    const catalogItem = findIconItem(finalName) || {
      name: finalName,
      label: finalName,
      category: 'custom',
      keywords: [finalName],
    };
    this.iconSelected.emit(catalogItem);

    this.closePicker();
  }
}
