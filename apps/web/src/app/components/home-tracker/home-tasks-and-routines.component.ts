import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HomeTrackerService } from '../../core/services/home-tracker.service';

@Component({
  selector: 'app-home-tasks-and-routines',
  standalone: true,
  imports: [AsyncPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-space-lg">
      @if (showTasksSection) {
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <!-- Left Column: Room Tasks & Todo List -->
          <div class="lg:col-span-6 flex flex-col gap-space-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-lg text-primary">checklist</span>
                <h2 class="font-headline-sm text-base font-bold text-on-surface">
                  Дела и Todo: {{ (home.selectedRoom$ | async) === 'ALL' ? 'Все зоны дома' : (home.selectedRoom$ | async) }}
                </h2>
              </div>
              <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Чек-лист обслуживания
              </span>
            </div>

            <div class="bg-surface-container-lowest rounded-2xl p-2.5 shadow-xs border border-outline-variant/25 flex items-center gap-2">
              <input
                type="text"
                [(ngModel)]="newTaskTitle"
                (keyup.enter)="addNewTask()"
                placeholder="Добавить дело в эту комнату (нажмите Enter)..."
                class="flex-1 px-3 py-1.5 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-outline border border-transparent focus:border-primary focus:bg-surface-container-lowest focus:outline-none"
              />
              <button
                type="button"
                (click)="addNewTask()"
                class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-90 flex-shrink-0"
              >
                + Добавить
              </button>
            </div>

            <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-2">
              @for (task of (home.tasksForSelectedRoom$ | async) ?? []; track task.id) {
                <div
                  class="flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all"
                  [class]="task.done ? 'bg-surface-container-low/40 opacity-60' : 'bg-surface-container-low hover:bg-surface-container'"
                >
                  <label class="flex items-center gap-2.5 min-w-0 cursor-pointer select-none flex-1">
                    <input
                      type="checkbox"
                      [checked]="task.done"
                      (change)="home.toggleRoomTask(task.id)"
                      class="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span class="font-body-sm text-xs text-on-surface truncate" [class.line-through]="task.done">
                      {{ task.title }}
                    </span>
                  </label>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full"
                      [class]="
                        task.priority === 'high'
                          ? 'bg-rose-100 text-rose-700 font-bold'
                          : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-surface-container text-on-surface-variant'
                      "
                    >
                      {{ task.room }}
                    </span>
                    <button
                      type="button"
                      (click)="home.deleteRoomTask(task.id)"
                      class="p-1 rounded text-outline hover:text-rose-600 transition-colors"
                      title="Удалить задачу"
                    >
                      <span class="material-symbols-rounded text-sm">close</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-6 font-body-sm text-xs text-on-surface-variant">
                  В этой зоне пока нет запланированных дел. Добавьте задачу выше!
                </div>
              }
            </div>
          </div>

          <!-- Right Column: Scheduled Household Routines (home.routines) -->
          <div class="lg:col-span-6 flex flex-col gap-space-sm">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-lg text-on-surface-variant">schedule</span>
              <h2 class="font-headline-sm text-base font-bold text-on-surface">
                Расписания и рутины дома
              </h2>
              <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                home.routines
              </span>
            </div>

            <div class="flex flex-col gap-3">
              @for (routine of (home.routineWidgets$ | async) ?? []; track routine.flow.id) {
                <div
                  class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                      <div
                        class="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0"
                      >
                        <span class="material-symbols-rounded text-lg">{{ routine.icon }}</span>
                      </div>
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <h3 class="font-headline-sm text-sm font-bold text-on-surface">
                            {{ routine.flow.name }}
                          </h3>
                          <span
                            class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold"
                          >
                            Scheduled Mutex · {{ routine.scheduleLabel }}
                          </span>
                        </div>
                        <p class="font-body-sm text-xs text-on-surface-variant mt-1">
                          {{ routine.flow.description }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                    <span class="font-label-code-sm text-xs text-on-surface-variant">
                      Зона: {{ routine.room }} · Статус окна: {{ routine.flow.status }}
                    </span>
                    <button
                      type="button"
                      (click)="home.completeRoutine(routine.flow.id, 'Выполнено пользователем в окне расписания')"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-success-container hover:text-on-success-container text-on-surface font-label-ui text-xs font-bold transition-colors"
                    >
                      <span class="material-symbols-rounded text-sm">task_alt</span>
                      <span>Отметить выполнение</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      }

      <!-- Live Chronicle of Home Events (flow_events) -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-rounded text-lg text-on-surface-variant">history</span>
          <h2 class="font-headline-sm text-base font-bold text-on-surface">
            Хроника событий дома
          </h2>
          <span class="font-label-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
            flow_events · порции, покупки и рутины
          </span>
        </div>

        <div
          class="bg-surface-container-lowest rounded-2xl p-space-md shadow-xs border border-outline-variant/25 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto"
        >
          @for (act of (home.activities$ | async) ?? []; track act.id) {
            <div
              class="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/15"
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                [class]="
                  act.eventType === 'DEPLETED'
                    ? 'bg-warning/20 text-warning'
                    : act.eventType === 'RESTOCKED'
                      ? 'bg-success-container text-on-success-container'
                      : 'bg-primary-container text-on-primary-container'
                "
              >
                <span class="material-symbols-rounded text-base">{{ act.icon }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-label-ui text-xs font-bold text-on-surface truncate">
                    {{ act.flowName }}
                  </span>
                  <span class="font-label-code-sm text-[10px] text-outline flex-shrink-0">
                    {{ act.eventType }}
                  </span>
                </div>
                <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  {{ act.note }}
                </p>
              </div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class HomeTasksAndRoutinesComponent {
  protected readonly home = inject(HomeTrackerService);

  @Input() showTasksSection = true;

  newTaskTitle = '';
  newTaskPriority: 'low' | 'medium' | 'high' = 'medium';

  addNewTask(): void {
    if (!this.newTaskTitle.trim()) return;
    const room = this.home.currentRoom === 'ALL' ? 'Кухня' : this.home.currentRoom;
    this.home.addRoomTask(room, this.newTaskTitle, this.newTaskPriority);
    this.newTaskTitle = '';
  }
}
