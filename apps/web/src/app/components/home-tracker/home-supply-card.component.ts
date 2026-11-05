import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { HomeWidgetView } from '../../core/models/flow.models';
import { HomeTrackerService } from '../../core/services/home-tracker.service';

@Component({
  selector: 'app-home-supply-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border transition-all flex flex-col justify-between gap-space-md"
      [class]="
        widget.isInStock && widget.percentage >= 20
          ? 'border-outline-variant/25'
          : widget.isInStock && widget.percentage < 20
            ? 'border-rose-400 bg-rose-50/20'
            : 'border-warning/50 bg-warning/5'
      "
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            [class]="
              widget.percentage === 0
                ? 'bg-warning/20 text-warning'
                : widget.percentage < 20
                  ? 'bg-rose-100 text-rose-600'
                  : widget.percentage <= 60
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-success-container text-on-success-container'
            "
          >
            <span class="material-symbols-rounded text-xl">{{ widget.icon }}</span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-headline-sm text-base font-bold text-on-surface">{{ widget.flow.name }}</h3>
              <span
                class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                [class]="
                  widget.percentage === 0
                    ? 'bg-warning text-on-warning'
                    : widget.percentage < 20
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : widget.percentage <= 60
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-success-container text-on-success-container'
                "
              >
                {{
                  widget.percentage === 0
                    ? 'Закончилось (Mutex OFF)'
                    : widget.percentage < 20
                      ? 'Критически мало (Mutex ON)'
                      : widget.percentage <= 60
                        ? 'Средний запас (Mutex ON)'
                        : 'В достатке (Mutex ON)'
                }}
              </span>
            </div>

            @if (widget.brand) {
              <div class="font-label-ui text-xs text-primary font-bold mt-0.5 flex items-center gap-1">
                <span class="material-symbols-rounded text-xs">verified</span>
                <span>{{ widget.brand }}</span>
              </div>
            }

            <p class="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-1">
              {{ widget.flow.description }}
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="home.deleteWidget(widget.flow.id)"
          title="Удалить виджет"
          class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
        >
          <span class="material-symbols-rounded text-base">delete</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5 pt-1">
        <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden relative">
          <div
            [style.width.%]="widget.percentage"
            class="h-full rounded-full transition-all duration-300"
            [class]="
              widget.percentage === 0
                ? 'bg-transparent'
                : widget.percentage < 20
                  ? 'bg-rose-500 animate-pulse'
                  : widget.percentage <= 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
            "
          ></div>
        </div>

        <div class="flex items-center justify-between text-[11px] font-label-code-sm text-on-surface-variant">
          @if (widget.percentage === 0) {
            <span class="text-rose-600 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Исчерпано • В списке покупок!
            </span>
          } @else {
            <span>
              Запас: <strong>{{ widget.percentage }}%</strong>
              (хватит ~{{ MathRound(widget.currentQty * widget.daysPerUnit) }} дн.)
            </span>
          }
          <span>Макс: {{ widget.maxQty }} {{ widget.unit }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20 gap-2 flex-wrap">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="home.consumePortion(widget.flow.id)"
            [disabled]="widget.currentQty === 0"
            class="h-8 px-2.5 rounded-xl flex items-center justify-center font-bold text-xs transition-all border"
            [class]="
              widget.currentQty === 0
                ? 'opacity-40 cursor-not-allowed bg-surface-container border-outline-variant/20 text-on-surface-variant'
                : 'bg-surface-container-lowest border-outline-variant/30 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-xs active:scale-90'
            "
          >
            -{{ widget.step }} {{ widget.unit }}
          </button>

          <div class="min-w-[65px] px-2 py-1 text-center font-label-code-sm text-xs font-bold rounded-lg bg-surface-container text-on-surface shadow-inner">
            {{ widget.currentQty }} {{ widget.unit }}
          </div>

          <button
            type="button"
            (click)="home.addPortion(widget.flow.id)"
            class="h-8 px-2.5 rounded-xl flex items-center justify-center font-bold text-xs bg-surface-container-lowest border border-outline-variant/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 shadow-xs active:scale-90 transition-all"
          >
            +{{ widget.step }} {{ widget.unit }}
          </button>

          <button
            type="button"
            (click)="home.addPortion(widget.flow.id, widget.maxQty)"
            class="h-8 px-2 rounded-xl text-[11px] font-label-ui font-bold bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            + Пачка
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          @if (widget.isInStock) {
            <button
              type="button"
              (click)="home.markDepleted(widget.flow.id)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-warning hover:text-on-warning font-label-ui text-xs font-bold transition-colors"
            >
              <span class="material-symbols-rounded text-sm">production_quantity_limits</span>
              <span>В покупки</span>
            </button>
          } @else {
            <button
              type="button"
              (click)="home.markRestocked(widget.flow.id)"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:opacity-90 font-label-ui text-xs font-bold transition-opacity shadow-xs"
            >
              <span class="material-symbols-rounded text-sm">check_circle</span>
              <span>Купили (Включить мьютекс)</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class HomeSupplyCardComponent {
  protected readonly home = inject(HomeTrackerService);

  @Input({ required: true }) widget!: HomeWidgetView;

  MathRound(val: number): number {
    return Math.round(val);
  }
}
