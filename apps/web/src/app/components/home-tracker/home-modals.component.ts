import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HomeTrackerService } from '../../core/services/home-tracker.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-home-modals',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Modal: Create New Home Widget -->
    @if (showWidgetModal) {
      <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        (click)="closeWidgetModal.emit()"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-lg font-bold text-on-surface">
              Новый виджет дома (Поток в home.*)
            </h3>
            <button
              type="button"
              (click)="closeWidgetModal.emit()"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              (click)="newWidgetKind = 'supply'"
              class="p-3 rounded-xl border text-left transition-all"
              [class]="
                newWidgetKind === 'supply'
                  ? 'border-primary bg-primary-container/30 text-on-surface font-bold'
                  : 'border-outline-variant/30 text-on-surface-variant'
              "
            >
              <div class="font-label-ui text-xs font-bold">Запас ресурса (Mutex)</div>
              <div class="font-body-sm text-[11px] opacity-80 mt-0.5">Контейнер home.supplies</div>
            </button>
            <button
              type="button"
              (click)="newWidgetKind = 'routine'"
              class="p-3 rounded-xl border text-left transition-all"
              [class]="
                newWidgetKind === 'routine'
                  ? 'border-primary bg-primary-container/30 text-on-surface font-bold'
                  : 'border-outline-variant/30 text-on-surface-variant'
              "
            >
              <div class="font-label-ui text-xs font-bold">Рутина (Scheduled Mutex)</div>
              <div class="font-body-sm text-[11px] opacity-80 mt-0.5">Контейнер home.routines</div>
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название ресурса или дела</span>
              <input
                type="text"
                [(ngModel)]="newWidgetName"
                placeholder="Напр.: Фильтры для воды / Проветривание"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Комната / Зона</span>
                <input
                  type="text"
                  [(ngModel)]="newWidgetRoom"
                  placeholder="Кухня / Ванная / Спальня"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">Иконка (Material)</span>
                <select
                  [(ngModel)]="newWidgetIcon"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                >
                  @for (opt of iconOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </label>
            </div>

            @if (newWidgetKind === 'supply') {
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Ед. изм. (кратко)</span>
                  <input
                    type="text"
                    [(ngModel)]="newWidgetUnitShort"
                    placeholder="шт / пак / кг / л / г"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1 sm:col-span-2">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Фасовка / Описание</span>
                  <input
                    type="text"
                    [(ngModel)]="newWidgetUnit"
                    placeholder="Напр.: 100 пакетиков / Пакет 2 кг"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Остаток</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetCurrentQty"
                    min="0"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Макс. ёмкость</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetMaxQty"
                    min="0.1"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Шаг порции</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetStep"
                    min="0.01"
                    step="any"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Срок расхода (дней)</span>
                  <input
                    type="number"
                    [(ngModel)]="newWidgetDays"
                    min="1"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Начало окна (HH:MM)</span>
                  <input
                    type="text"
                    [(ngModel)]="newScheduleStart"
                    placeholder="09:00"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-label-ui text-xs font-semibold text-on-surface">Конец окна (HH:MM)</span>
                  <input
                    type="text"
                    [(ngModel)]="newScheduleEnd"
                    placeholder="11:00"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
                  />
                </label>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="closeWidgetModal.emit()"
              class="px-4 py-2 rounded-xl font-label-ui text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewWidget()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Создать поток в профиле
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Register New User Profile -->
    @if (showProfileModal) {
      <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        (click)="closeProfileModal.emit()"
      >
        <div
          class="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-lg font-bold text-on-surface">
              Регистрация профиля в Lemon Home
            </h3>
            <button
              type="button"
              (click)="closeProfileModal.emit()"
              class="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <p class="font-body-sm text-xs text-on-surface-variant">
            Для нового пользователя в Core Combinator автоматически создается изолированное дерево
            <code class="font-label-code-sm">home</code>, <code class="font-label-code-sm">home.supplies</code>,
            <code class="font-label-code-sm">home.routines</code> и стартовые бытовые потоки.
          </p>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Название профиля / дома</span>
              <input
                type="text"
                [(ngModel)]="newProfileName"
                placeholder="Напр.: Квартира родителей"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="font-label-ui text-xs font-semibold text-on-surface">Уникальный handle (латиницей)</span>
              <input
                type="text"
                [(ngModel)]="newProfileHandle"
                placeholder="parents_home"
                class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface"
              />
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="closeProfileModal.emit()"
              class="px-4 py-2 rounded-xl font-label-ui text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submitNewProfile()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs"
            >
              Зарегистрировать профиль
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class HomeModalsComponent {
  private readonly home = inject(HomeTrackerService);
  private readonly profileService = inject(ProfileService);

  @Input() showWidgetModal = false;
  @Input() showProfileModal = false;

  @Output() readonly closeWidgetModal = new EventEmitter<void>();
  @Output() readonly closeProfileModal = new EventEmitter<void>();

  newWidgetKind: 'supply' | 'routine' = 'supply';
  newWidgetName = '';
  newWidgetRoom = 'Кухня';
  newWidgetIcon = 'inventory_2';
  newWidgetUnit = '1 уп.';
  newWidgetUnitShort = 'шт';
  newWidgetCurrentQty = 1;
  newWidgetMaxQty = 1;
  newWidgetStep = 1;
  newWidgetDays = 14;
  newScheduleStart = '10:00';
  newScheduleEnd = '12:00';

  newProfileName = '';
  newProfileHandle = '';

  readonly iconOptions = [
    { value: 'inventory_2', label: 'Коробка / Запас (inventory_2)' },
    { value: 'soap', label: 'Мыло (soap)' },
    { value: 'clean_hands', label: 'Влажные салфетки (clean_hands)' },
    { value: 'wash', label: 'Мытье посуды (wash)' },
    { value: 'layers', label: 'Губки поролоновые (layers)' },
    { value: 'dry', label: 'Тряпки / салфетки (dry)' },
    { value: 'sanitizer', label: 'Средство для плиты / Санокс (sanitizer)' },
    { value: 'brush', label: 'Металлические губки / щетки (brush)' },
    { value: 'local_laundry_service', label: 'Стирка / Порошок (local_laundry_service)' },
    { value: 'cleaning_services', label: 'Уборка / Клининг (cleaning_services)' },
    { value: 'emoji_food_beverage', label: 'Чай в пакетиках (emoji_food_beverage)' },
    { value: 'spa', label: 'Чай листовой / Травы (spa)' },
    { value: 'bakery_dining', label: 'Хлеб / Выпечка (bakery_dining)' },
    { value: 'soup_kitchen', label: 'Кетчуп / Соус (soup_kitchen)' },
    { value: 'dinner_dining', label: 'Утка / Мясо / Птица (dinner_dining)' },
    { value: 'lunch_dining', label: 'Сало / Закуски (lunch_dining)' },
    { value: 'nutrition', label: 'Лимон / Цитрусовые (nutrition)' },
    { value: 'local_drink', label: 'Молоко / Напитки (local_drink)' },
    { value: 'grain', label: 'Мука / Зерно (grain)' },
    { value: 'scatter_plot', label: 'Сахар / Сыпучие (scatter_plot)' },
    { value: 'rice_bowl', label: 'Гречка / Рис / Крупы (rice_bowl)' },
    { value: 'water_drop', label: 'Вода (water_drop)' },
    { value: 'yard', label: 'Растения / Сад (yard)' },
    { value: 'pets', label: 'Питомцы (pets)' },
  ];

  submitNewWidget(): void {
    if (!this.newWidgetName.trim()) return;
    this.home.createHomeWidget({
      name: this.newWidgetName,
      kind: this.newWidgetKind,
      room: this.newWidgetRoom,
      icon: this.newWidgetIcon,
      unitHint: this.newWidgetUnit,
      unit: this.newWidgetUnitShort,
      currentQty: this.newWidgetCurrentQty,
      maxQty: this.newWidgetMaxQty,
      step: this.newWidgetStep,
      expectedDays: this.newWidgetDays,
      scheduleStart: this.newScheduleStart,
      scheduleEnd: this.newScheduleEnd,
    });
    this.newWidgetName = '';
    this.closeWidgetModal.emit();
  }

  submitNewProfile(): void {
    if (!this.newProfileName.trim() || !this.newProfileHandle.trim()) return;
    this.profileService
      .registerProfile({
        displayName: this.newProfileName,
        handle: this.newProfileHandle,
        avatarIcon: 'apartment',
      })
      .subscribe(() => {
        this.newProfileName = '';
        this.newProfileHandle = '';
        this.closeProfileModal.emit();
      });
  }
}
