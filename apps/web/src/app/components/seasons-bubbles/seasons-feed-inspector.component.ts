import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {
  SeasonsFeedNodeView,
  SeasonsNoteView,
  SeasonsStreamNodeView,
  SeasonsTodoItemView,
} from '../../core/models/seasons.models';

@Component({
  selector: 'app-seasons-feed-inspector',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="rounded-3xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col gap-4 shadow-xs h-full">
      <!-- HEADER -->
      <div class="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3.5">
        <div class="min-w-0">
          @if (selectedFeed) {
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg">{{ selectedFeed.icon && selectedFeed.icon.length <= 4 ? selectedFeed.icon : '📌' }}</span>
              <h2 class="font-headline-sm text-base font-bold text-on-surface truncate">
                {{ selectedFeed.title }}
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                {{ selectedFeed.privacy }}
              </span>
            </div>
            <p class="text-[11px] font-mono text-on-surface-variant mt-0.5 truncate">
              stream: {{ selectedStream?.slug || '—' }} · feed: {{ selectedFeed.slug }}
            </p>
          } @else if (selectedStream) {
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg">{{ selectedStream.icon && selectedStream.icon.length <= 4 ? selectedStream.icon : '🌊' }}</span>
              <h2 class="font-headline-sm text-base font-bold text-on-surface truncate">
                {{ selectedStream.title }}
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                {{ selectedStream.privacy }}
              </span>
            </div>
            <p class="text-[11px] text-on-surface-variant mt-0.5">
              Выберите bubble фида внутри стрима или добавьте новый фид.
            </p>
          } @else {
            <h2 class="font-headline-sm text-base font-bold text-on-surface">
              Инспектор Stream & Feed
            </h2>
            <p class="text-xs text-on-surface-variant mt-0.5">
              Нажмите на любой bubble стрима слева, чтобы раскрыть его фиды и заметки.
            </p>
          }
        </div>

        @if (selectedStream) {
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              (click)="addFeedRequested.emit(selectedStream.slug)"
              class="px-2.5 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold cursor-pointer transition-colors"
            >
              + Feed
            </button>
            <button
              type="button"
              (click)="addNoteRequested.emit({ streamSlug: selectedStream.slug, feedSlug: selectedFeed?.slug })"
              class="px-2.5 py-1.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-[11px] font-bold cursor-pointer transition-colors"
            >
              + Note / Todo
            </button>
          </div>
        }
      </div>

      <!-- LOADING / NOTES LIST -->
      @if (loading) {
        <div class="py-12 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
          <span class="material-symbols-rounded text-2xl animate-spin">progress_activity</span>
          <span class="text-xs">Загружаем заметки из Lemon Seasons...</span>
        </div>
      } @else if (!selectedStream && !selectedFeed) {
        <div class="py-10 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant">
          <span class="material-symbols-rounded text-3xl opacity-60">touch_app</span>
          <span class="text-xs max-w-xs">
            Кликните по большому bubble стрима, чтобы увидеть вложенные фиды, хронологии и проксируемые todo-листы.
          </span>
        </div>
      } @else if (notes.length === 0) {
        <div class="py-10 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant">
          <span class="material-symbols-rounded text-3xl opacity-60">note_stack</span>
          <span class="text-xs">Заметок пока нет</span>
          @if (selectedFeed) {
            <button
              type="button"
              (click)="addNoteRequested.emit({ streamSlug: selectedStream?.slug, feedSlug: selectedFeed.slug })"
              class="mt-1 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold cursor-pointer"
            >
              Создать первую заметку
            </button>
          }
        </div>
      } @else {
        <div class="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
          @for (note of notes; track note.id) {
            @let todos = extractTodos(note);
            <article class="rounded-2xl bg-surface-container-lowest border border-outline-variant/25 p-3.5 flex flex-col gap-2.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm">{{ note.icon || '📄' }}</span>
                    <h3 class="text-xs font-bold text-on-surface truncate">
                      {{ note.title }}
                    </h3>
                    <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-surface-container text-on-surface-variant">
                      {{ note.type }}
                    </span>
                    @if (todos.length > 0) {
                      <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {{ countCompleted(todos) }}/{{ todos.length }} todos
                      </span>
                    }
                  </div>
                  @if (note.summary) {
                    <p class="text-[11px] text-on-surface-variant mt-1 line-clamp-2">
                      {{ note.summary }}
                    </p>
                  }
                </div>
                <span class="text-[10px] font-mono text-on-surface-variant flex-shrink-0">
                  {{ (note.startDate || note.updatedAt || note.createdAt) | date: 'dd.MM HH:mm' }}
                </span>
              </div>

              <!-- PROXIED TODOLIST INSIDE NOTE -->
              @if (todos.length > 0) {
                <div class="rounded-xl bg-surface-container-low border border-outline-variant/20 p-2.5 flex flex-col gap-1.5">
                  @for (todo of todos; track todo.id) {
                    <div class="flex items-center justify-between gap-2 group">
                      <label class="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          [checked]="todo.completed"
                          (change)="toggleTodo.emit({ noteId: note.id, todoId: todo.id })"
                          class="w-3.5 h-3.5 rounded accent-primary cursor-pointer flex-shrink-0"
                        />
                        <span [class]="todoTitleClass(todo.completed)">
                          {{ todo.title }}
                        </span>
                      </label>
                      <button
                        type="button"
                        (click)="removeTodo.emit({ noteId: note.id, todoId: todo.id })"
                        class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error p-0.5 rounded transition-opacity cursor-pointer"
                        title="Удалить пункт"
                      >
                        <span class="material-symbols-rounded text-xs">close</span>
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- INLINE ADD TODO TO ANY NOTE -->
              <div class="flex items-center gap-1.5">
                <input
                  type="text"
                  [value]="draftTodoTitle(note.id)"
                  (input)="onDraftTodoInput(note.id, $event)"
                  (keydown.enter)="submitDraftTodo(note.id)"
                  placeholder="+ Добавить todo-пункт в эту заметку..."
                  class="flex-1 px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/25 text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  (click)="submitDraftTodo(note.id)"
                  class="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-[11px] font-bold text-on-surface transition-colors cursor-pointer"
                >
                  + Todo
                </button>
              </div>
            </article>
          }
        </div>
      }
    </aside>
  `,
})
export class SeasonsFeedInspectorComponent {
  @Input() selectedStream: SeasonsStreamNodeView | null = null;
  @Input() selectedFeed: SeasonsFeedNodeView | null = null;
  @Input() notes: SeasonsNoteView[] = [];
  @Input() loading = false;

  @Output() addFeedRequested = new EventEmitter<string>();
  @Output() addNoteRequested = new EventEmitter<{ streamSlug?: string; feedSlug?: string }>();
  @Output() toggleTodo = new EventEmitter<{ noteId: string; todoId: string }>();
  @Output() removeTodo = new EventEmitter<{ noteId: string; todoId: string }>();
  @Output() addTodo = new EventEmitter<{ noteId: string; title: string }>();

  private readonly todoDrafts = signal<Record<string, string>>({});

  extractTodos(note: SeasonsNoteView): SeasonsTodoItemView[] {
    const list = note.metadata?.todoList;
    return Array.isArray(list) ? list : [];
  }

  countCompleted(todos: SeasonsTodoItemView[]): number {
    return todos.filter((t) => Boolean(t.completed)).length;
  }

  todoTitleClass(completed: boolean): string {
    return completed
      ? 'text-[11px] line-through text-on-surface-variant truncate'
      : 'text-[11px] text-on-surface font-medium truncate';
  }

  draftTodoTitle(noteId: string): string {
    return this.todoDrafts()[noteId] || '';
  }

  onDraftTodoInput(noteId: string, event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.todoDrafts.update((prev) => ({ ...prev, [noteId]: value }));
  }

  submitDraftTodo(noteId: string): void {
    const title = (this.todoDrafts()[noteId] || '').trim();
    if (!title) return;
    this.addTodo.emit({ noteId, title });
    this.todoDrafts.update((prev) => ({ ...prev, [noteId]: '' }));
  }
}
