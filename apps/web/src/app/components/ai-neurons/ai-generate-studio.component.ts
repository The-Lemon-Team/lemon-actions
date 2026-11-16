import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AiStudioMode,
  AiStudioResultUnion,
  AiTone,
  ImageAspectRatio,
} from '../../core/models/ai.models';

export interface GenerateTextSubmit {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}

export interface GenerateNoteSubmit {
  title?: string;
  topic?: string;
  tone?: AiTone;
  category?: string;
  context?: string;
  tags?: string[];
}

export interface ParseQuickAddSubmit {
  rawText: string;
}

export interface GenerateImagesSubmit {
  prompt: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string;
  count?: number;
  tags?: string[];
}

export interface RemixImageSubmit {
  sourceAssetId: string;
  instruction: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string;
  count?: number;
}

export interface AnalyzeImageSubmit {
  sourceAssetId: string;
  instruction?: string;
}

const IMAGE_STYLES = [
  'ai-neural',
  'cinematic',
  'cyberpunk',
  'isometric-tech',
  'minimalist',
  'photorealistic',
  'podcast-neon',
  'changelog-blueprint',
  'terminal-retro',
  'oil-painting',
  'vintage',
];

const ASPECT_RATIOS: ImageAspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4'];

@Component({
  selector: 'app-ai-generate-studio',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 flex flex-col gap-4 shadow-xs">
      <!-- HEADER + MODE TABS -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-rounded text-lg text-primary">auto_awesome</span>
          <h2 class="font-headline-sm text-base font-bold text-on-surface">
            Студия генерации Umniy Lemon
          </h2>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          @for (tab of modeTabs; track tab.id) {
            <button
              type="button"
              (click)="selectMode(tab.id)"
              [class]="modeTabClass(activeMode === tab.id)"
            >
              <span class="material-symbols-rounded text-sm">{{ tab.icon }}</span>
              <span>{{ tab.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- WORKSPACE GRID: FORM (LEFT) + LIVE RESULT (RIGHT) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- INPUT FORM -->
        <div class="lg:col-span-6 flex flex-col gap-3 text-xs">
          @switch (activeMode) {
            @case ('text') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Промпт *</span>
                <textarea
                  rows="4"
                  [(ngModel)]="textPrompt"
                  placeholder="Напишите запрос для генерации текста, саммари или кода..."
                  class="px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label class="sm:col-span-2 flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">System Instruction (опц.)</span>
                  <input
                    type="text"
                    [(ngModel)]="textSystem"
                    placeholder="Например: Отвечай кратко и структурно"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Temperature ({{ textTemp }})</span>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    [(ngModel)]="textTemp"
                    class="mt-2 accent-amber-500"
                  />
                </label>
              </div>

              <button
                type="button"
                [disabled]="isGenerating || !textPrompt.trim()"
                (click)="onSubmitText()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">bolt</span>
                <span>{{ isGenerating ? 'Генерация...' : 'Сгенерировать текст' }}</span>
              </button>
            }

            @case ('note') {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Тема / Заголовок *</span>
                  <input
                    type="text"
                    [(ngModel)]="noteTopic"
                    placeholder="Архитектура AI-neurons"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Тон заметки</span>
                  <select
                    [(ngModel)]="noteTone"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="professional">professional</option>
                    <option value="creative">creative</option>
                    <option value="concise">concise</option>
                    <option value="academic">academic</option>
                  </select>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Категория</span>
                  <input
                    type="text"
                    [(ngModel)]="noteCategory"
                    placeholder="engineering / cinema / research"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Теги (через запятую)</span>
                  <input
                    type="text"
                    [(ngModel)]="noteTags"
                    placeholder="ai, lemon-core, notes"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Дополнительный контекст</span>
                <textarea
                  rows="3"
                  [(ngModel)]="noteContext"
                  placeholder="Детали, ключевые мысли, ссылки..."
                  class="px-3.5 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <button
                type="button"
                [disabled]="isGenerating || !noteTopic.trim()"
                (click)="onSubmitNote()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">edit_note</span>
                <span>{{ isGenerating ? 'Генерация...' : 'Сгенерировать Markdown-заметку' }}</span>
              </button>
            }

            @case ('quick-add') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Сырой текст / мысль / событие *</span>
                <textarea
                  rows="4"
                  [(ngModel)]="quickAddRaw"
                  placeholder="Например: В пятницу вечером релиз AI-neurons, подготовить обложку и проверить прокси на 3006"
                  class="px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <button
                type="button"
                [disabled]="isGenerating || !quickAddRaw.trim()"
                (click)="onSubmitQuickAdd()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">auto_fix_high</span>
                <span>{{ isGenerating ? 'Разбор...' : 'Разобрать Quick-Add' }}</span>
              </button>
            }

            @case ('images') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Описание изображения (Prompt) *</span>
                <textarea
                  rows="3"
                  [(ngModel)]="imagePrompt"
                  placeholder="Например: Glowing crystalline lemon core inside neural network dark cockpit"
                  class="px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <div class="flex flex-col gap-1.5">
                <span class="font-bold text-on-surface-variant">Стиль</span>
                <div class="flex flex-wrap gap-1.5">
                  @for (st of imageStyles; track st) {
                    <button
                      type="button"
                      (click)="imageStyle = st"
                      [class]="chipClass(imageStyle === st)"
                    >
                      {{ st }}
                    </button>
                  }
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Формат</span>
                  <select
                    [(ngModel)]="imageAspectRatio"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    @for (ar of aspectRatios; track ar) {
                      <option [value]="ar">{{ ar }}</option>
                    }
                  </select>
                </label>

                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Количество (1-4)</span>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    [(ngModel)]="imageCount"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>

                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Папка Media Hub</span>
                  <input
                    type="text"
                    [(ngModel)]="imageFolder"
                    placeholder="ai-neurons"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Теги (через запятую)</span>
                <input
                  type="text"
                  [(ngModel)]="imageTags"
                  placeholder="ai-neurons, cover"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <button
                type="button"
                [disabled]="isGenerating || !imagePrompt.trim()"
                (click)="onSubmitImages()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">image</span>
                <span>{{ isGenerating ? 'Генерация картинок...' : 'Сгенерировать изображения' }}</span>
              </button>
            }

            @case ('remix') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Source Asset ID (из Media Hub) *</span>
                <input
                  type="text"
                  [(ngModel)]="remixAssetId"
                  placeholder="UUID ассета из Media Hub или истории"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Инструкция для ремикса *</span>
                <textarea
                  rows="3"
                  [(ngModel)]="remixInstruction"
                  placeholder="Например: Convert into neon synthwave night city lighting"
                  class="px-3.5 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <div class="grid grid-cols-3 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Стиль</span>
                  <select
                    [(ngModel)]="remixStyle"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface"
                  >
                    @for (st of imageStyles; track st) {
                      <option [value]="st">{{ st }}</option>
                    }
                  </select>
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Формат</span>
                  <select
                    [(ngModel)]="remixAspectRatio"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface"
                  >
                    @for (ar of aspectRatios; track ar) {
                      <option [value]="ar">{{ ar }}</option>
                    }
                  </select>
                </label>
                <label class="flex flex-col gap-1">
                  <span class="font-bold text-on-surface-variant">Кол-во</span>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    [(ngModel)]="remixCount"
                    class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface"
                  />
                </label>
              </div>

              <button
                type="button"
                [disabled]="isGenerating || !remixAssetId.trim() || !remixInstruction.trim()"
                (click)="onSubmitRemix()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">shuffle</span>
                <span>{{ isGenerating ? 'Ремикс...' : 'Создать ремикс' }}</span>
              </button>
            }

            @case ('vision') {
              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Source Asset ID (из Media Hub) *</span>
                <input
                  type="text"
                  [(ngModel)]="visionAssetId"
                  placeholder="UUID ассета для анализа Gemini Vision"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label class="flex flex-col gap-1">
                <span class="font-bold text-on-surface-variant">Инструкция анализа</span>
                <textarea
                  rows="3"
                  [(ngModel)]="visionInstruction"
                  placeholder="Describe this image and suggest 5-8 semantic tags."
                  class="px-3.5 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                ></textarea>
              </label>

              <button
                type="button"
                [disabled]="isGenerating || !visionAssetId.trim()"
                (click)="onSubmitVision()"
                class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <span class="material-symbols-rounded text-base">visibility</span>
                <span>{{ isGenerating ? 'Анализ...' : 'Анализировать изображение' }}</span>
              </button>
            }
          }

          @if (errorMessage) {
            <div class="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 text-red-600 dark:text-red-400">
              {{ errorMessage }}
            </div>
          }
        </div>

        <!-- LIVE OUTPUT RESULT PANEL -->
        <div class="lg:col-span-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-4 min-h-[240px] flex flex-col gap-3 text-xs">
          <div class="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
            <span class="font-bold uppercase tracking-wider text-[10px] text-on-surface-variant">
              Результат генерации
            </span>
            @if (isGenerating) {
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse">
                Выполняется...
              </span>
            }
          </div>

          @if (lastResult; as res) {
            @switch (res.kind) {
              @case ('text') {
                <div class="flex flex-col gap-2">
                  <pre class="whitespace-pre-wrap break-words font-sans text-xs text-on-surface leading-relaxed">{{ res.data.text }}</pre>
                  <div class="text-[10px] font-mono text-on-surface-variant">requestId: {{ res.data.requestId }}</div>
                </div>
              }
              @case ('note') {
                <div class="flex flex-col gap-2">
                  <div class="text-sm font-bold text-on-surface">{{ res.data.title }}</div>
                  <div class="text-on-surface-variant italic">{{ res.data.summary }}</div>
                  <div class="flex flex-wrap gap-1">
                    @for (tag of res.data.tags; track tag) {
                      <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-mono text-[10px]">#{{ tag }}</span>
                    }
                  </div>
                  <pre class="whitespace-pre-wrap break-words font-sans text-xs text-on-surface bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/20">{{ res.data.content }}</pre>
                </div>
              }
              @case ('quick-add') {
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-bold text-on-surface">{{ res.data.title }}</span>
                    <span class="px-2 py-0.5 rounded-full bg-surface-container font-mono text-[10px] uppercase">{{ res.data.priority }}</span>
                  </div>
                  @if (res.data.eventDate) {
                    <div class="font-mono text-[11px] text-amber-600 dark:text-amber-400">Дата: {{ res.data.eventDate }}</div>
                  }
                  <p class="text-on-surface whitespace-pre-wrap">{{ res.data.content }}</p>
                  <div class="flex flex-wrap gap-1">
                    @for (tag of res.data.tags; track tag) {
                      <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-mono text-[10px]">#{{ tag }}</span>
                    }
                  </div>
                  @if (res.data.suggestedCoverPrompt) {
                    <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/25 p-2.5 flex items-center justify-between gap-2">
                      <span class="text-[11px] text-on-surface-variant truncate">{{ res.data.suggestedCoverPrompt }}</span>
                      <button
                        type="button"
                        (click)="useCoverPrompt(res.data.suggestedCoverPrompt)"
                        class="px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container text-[10px] font-bold flex-shrink-0 cursor-pointer"
                      >
                        Создать обложку
                      </button>
                    </div>
                  }
                </div>
              }
              @case ('images') {
                <div class="flex flex-col gap-3">
                  <div class="text-[11px] text-on-surface-variant">
                    <span class="font-bold text-on-surface">{{ res.data.model }}</span>
                    @if (res.data.isFallback) {
                      <span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 text-[10px] font-mono">SVG Fallback</span>
                    }
                    · {{ res.data.synthesizedPrompt }}
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (item of res.data.items; track item.id) {
                      <div class="rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-lowest flex flex-col">
                        <img
                          [src]="resolveAssetImage(item.id, item.url)"
                          [alt]="item.filename"
                          class="w-full h-36 object-cover bg-surface-container"
                        />
                        <div class="p-2 flex items-center justify-between gap-2">
                          <span class="font-mono text-[10px] text-on-surface-variant truncate">{{ item.filename }}</span>
                          @if (item.persisted) {
                            <div class="flex items-center gap-1">
                              <button
                                type="button"
                                (click)="prepareRemix(item.id)"
                                class="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-[10px] font-bold cursor-pointer"
                              >
                                Remix
                              </button>
                              <button
                                type="button"
                                (click)="prepareVision(item.id)"
                                class="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-[10px] font-bold cursor-pointer"
                              >
                                Vision
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
              @case ('remix') {
                <div class="flex flex-col gap-3">
                  <div class="text-[11px] text-on-surface-variant">
                    <span class="font-bold text-on-surface">{{ res.data.model }}</span> · {{ res.data.description }}
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (item of res.data.items; track item.id) {
                      <div class="rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-lowest">
                        <img
                          [src]="resolveAssetImage(item.id, item.url)"
                          [alt]="item.filename"
                          class="w-full h-36 object-cover bg-surface-container"
                        />
                        <div class="p-2 font-mono text-[10px] text-on-surface-variant truncate">{{ item.filename }}</div>
                      </div>
                    }
                  </div>
                </div>
              }
              @case ('vision') {
                <div class="flex flex-col gap-2.5">
                  <p class="text-on-surface leading-relaxed whitespace-pre-wrap">{{ res.data.description }}</p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (tag of res.data.tags; track tag) {
                      <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-mono text-[10px]">#{{ tag }}</span>
                    }
                  </div>
                </div>
              }
            }
          } @else {
            <div class="flex-1 flex flex-col items-center justify-center text-center py-8 text-on-surface-variant gap-2">
              <span class="material-symbols-rounded text-3xl opacity-40">psychology</span>
              <span>Выберите режим и запустите генерацию — результат появится здесь и сохранится в истории Umniy Lemon.</span>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class AiGenerateStudioComponent implements OnChanges {
  @Input() isGenerating = false;
  @Input() lastResult: AiStudioResultUnion | null = null;
  @Input() errorMessage: string | null = null;
  @Input() prefillAssetId: string | null = null;
  @Input() prefillMode: AiStudioMode | null = null;
  @Input() mediaFullUrlBuilder: (assetId: string) => string = (id) => `/api/media/assets/${id}/file/full`;

  @Output() generateText = new EventEmitter<GenerateTextSubmit>();
  @Output() generateNote = new EventEmitter<GenerateNoteSubmit>();
  @Output() parseQuickAdd = new EventEmitter<ParseQuickAddSubmit>();
  @Output() generateImages = new EventEmitter<GenerateImagesSubmit>();
  @Output() remixImage = new EventEmitter<RemixImageSubmit>();
  @Output() analyzeImage = new EventEmitter<AnalyzeImageSubmit>();

  readonly imageStyles = IMAGE_STYLES;
  readonly aspectRatios = ASPECT_RATIOS;

  readonly modeTabs: Array<{ id: AiStudioMode; label: string; icon: string }> = [
    { id: 'text', label: 'Текст', icon: 'notes' },
    { id: 'note', label: 'Заметка', icon: 'edit_note' },
    { id: 'quick-add', label: 'Quick-Add', icon: 'auto_fix_high' },
    { id: 'images', label: 'Картинки', icon: 'image' },
    { id: 'remix', label: 'Ремикс', icon: 'shuffle' },
    { id: 'vision', label: 'Vision', icon: 'visibility' },
  ];

  activeMode: AiStudioMode = 'text';

  // Text form
  textPrompt = '';
  textSystem = '';
  textTemp = 0.7;

  // Note form
  noteTopic = '';
  noteTone: AiTone = 'professional';
  noteCategory = '';
  noteTags = '';
  noteContext = '';

  // Quick-add form
  quickAddRaw = '';

  // Images form
  imagePrompt = '';
  imageStyle = 'ai-neural';
  imageAspectRatio: ImageAspectRatio = '16:9';
  imageCount = 2;
  imageFolder = 'ai-neurons';
  imageTags = 'ai-neurons';

  // Remix form
  remixAssetId = '';
  remixInstruction = '';
  remixStyle = 'ai-neural';
  remixAspectRatio: ImageAspectRatio = '16:9';
  remixCount = 2;

  // Vision form
  visionAssetId = '';
  visionInstruction = 'Describe this image concisely and suggest 5-8 semantic tags.';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prefillMode'] && this.prefillMode) {
      this.activeMode = this.prefillMode;
    }
    if (changes['prefillAssetId'] && this.prefillAssetId) {
      this.remixAssetId = this.prefillAssetId;
      this.visionAssetId = this.prefillAssetId;
    }
  }

  selectMode(mode: AiStudioMode): void {
    this.activeMode = mode;
  }

  modeTabClass(active: boolean): string {
    return active
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold transition-colors cursor-pointer'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 text-on-surface-variant text-xs font-bold transition-colors cursor-pointer';
  }

  chipClass(active: boolean): string {
    return active
      ? 'px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container font-mono text-[10px] font-bold cursor-pointer'
      : 'px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/25 text-on-surface-variant font-mono text-[10px] cursor-pointer';
  }

  resolveAssetImage(assetId: string, fallbackUrl: string): string {
    if (fallbackUrl.startsWith('data:')) return fallbackUrl;
    if (assetId && !assetId.startsWith('transient-')) {
      return this.mediaFullUrlBuilder(assetId);
    }
    return fallbackUrl;
  }

  useCoverPrompt(prompt: string): void {
    this.imagePrompt = prompt;
    this.activeMode = 'images';
  }

  prepareRemix(assetId: string): void {
    this.remixAssetId = assetId;
    this.activeMode = 'remix';
  }

  prepareVision(assetId: string): void {
    this.visionAssetId = assetId;
    this.activeMode = 'vision';
  }

  onSubmitText(): void {
    if (!this.textPrompt.trim()) return;
    this.generateText.emit({
      prompt: this.textPrompt.trim(),
      systemInstruction: this.textSystem.trim() || undefined,
      temperature: Number(this.textTemp),
    });
  }

  onSubmitNote(): void {
    if (!this.noteTopic.trim()) return;
    const tags = this.noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    this.generateNote.emit({
      topic: this.noteTopic.trim(),
      title: this.noteTopic.trim(),
      tone: this.noteTone,
      category: this.noteCategory.trim() || undefined,
      context: this.noteContext.trim() || undefined,
      tags: tags.length ? tags : undefined,
    });
  }

  onSubmitQuickAdd(): void {
    if (!this.quickAddRaw.trim()) return;
    this.parseQuickAdd.emit({ rawText: this.quickAddRaw.trim() });
  }

  onSubmitImages(): void {
    if (!this.imagePrompt.trim()) return;
    const tags = this.imageTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    this.generateImages.emit({
      prompt: this.imagePrompt.trim(),
      style: this.imageStyle,
      aspectRatio: this.imageAspectRatio,
      folderPath: this.imageFolder.trim() || 'ai-neurons',
      count: Math.min(4, Math.max(1, Number(this.imageCount) || 2)),
      tags: tags.length ? tags : undefined,
    });
  }

  onSubmitRemix(): void {
    if (!this.remixAssetId.trim() || !this.remixInstruction.trim()) return;
    this.remixImage.emit({
      sourceAssetId: this.remixAssetId.trim(),
      instruction: this.remixInstruction.trim(),
      style: this.remixStyle,
      aspectRatio: this.remixAspectRatio,
      folderPath: 'remixes',
      count: Math.min(4, Math.max(1, Number(this.remixCount) || 2)),
    });
  }

  onSubmitVision(): void {
    if (!this.visionAssetId.trim()) return;
    this.analyzeImage.emit({
      sourceAssetId: this.visionAssetId.trim(),
      instruction: this.visionInstruction.trim() || undefined,
    });
  }
}
