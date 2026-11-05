import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { ArenaDesireCard, ArenaVoiceIntent, ArenaVoiceSource } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';

@Component({
  selector: 'app-arena-voice-studio',
  standalone: true,
  imports: [AsyncPipe, FormsModule, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- 3. LEAD CHARACTER VOICE STUDIO -->
    @if (arena.leadActor$ | async; as lead) {
      <section
        class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border-2 border-primary/50 flex flex-col gap-space-md"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
          <div class="flex items-center gap-3">
            <app-actor-avatar
              [avatar]="lead.avatarIcon"
              containerClass="w-16 h-16 rounded-2xl shadow-sm ring-2 ring-primary flex-shrink-0"
            />
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-code-sm text-[10px] font-bold uppercase">
                  Активный Голос Поля
                </span>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">
                  Вы говорите от имени: {{ lead.name }}
                </h3>
                <span class="font-label-code-sm text-xs text-on-surface-variant">
                  ({{ lead.title }} · {{ lead.categoryLabel }})
                </span>
              </div>
              <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Оставьте войс сами, запишите с микрофона или сгенерируйте реплику в характере персонажа.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/25 self-start lg:self-center">
            <button
              type="button"
              (click)="voiceSourceMode.set('MANUAL_PUPPET')"
              class="px-2.5 py-1.5 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1"
              [class]="
                voiceSourceMode() === 'MANUAL_PUPPET'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-sm">edit_note</span>
              <span>Сами (Ручной войс)</span>
            </button>
            <button
              type="button"
              (click)="voiceSourceMode.set('NEURAL_DRAFT')"
              class="px-2.5 py-1.5 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1"
              [class]="
                voiceSourceMode() === 'NEURAL_DRAFT'
                  ? 'bg-primary-container text-on-primary-container shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-sm">auto_awesome</span>
              <span>Нейро-Черновик</span>
            </button>
            <button
              type="button"
              (click)="toggleMicRecording()"
              class="px-2.5 py-1.5 rounded-lg font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1"
              [class]="
                isRecordingMic()
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-sm">{{ isRecordingMic() ? 'stop_circle' : 'mic' }}</span>
              <span>{{ isRecordingMic() ? 'Стоп запись...' : 'Микрофон' }}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
          <div class="lg:col-span-5 flex flex-col gap-2.5">
            <span class="font-label-ui text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              1. Что делает {{ lead.name }} в поле?
            </span>
            <div class="grid grid-cols-2 gap-2">
              @for (item of intentButtons; track item.id) {
                <button
                  type="button"
                  (click)="setVoiceIntent(item.id)"
                  class="p-2.5 rounded-xl border text-left transition-all"
                  [class]="
                    voiceIntent() === item.id
                      ? 'border-primary bg-primary-container/30 text-on-surface font-bold'
                      : 'border-outline-variant/30 bg-surface-container-low/50 text-on-surface-variant hover:text-on-surface'
                  "
                >
                  <div class="flex items-center gap-1.5 font-label-ui text-xs font-bold">
                    <span class="material-symbols-rounded text-base" [class]="item.iconColor">{{ item.icon }}</span>
                    <span>{{ item.label }}</span>
                  </div>
                  <div class="font-body-sm text-[11px] opacity-80 mt-0.5">{{ item.sub }}</div>
                </button>
              }
            </div>

            @if (voiceIntent() === 'SUPPORT') {
              <label class="flex flex-col gap-1 mt-1">
                <span class="font-label-ui text-xs font-semibold text-on-surface">
                  Какую карточку в поле подтверждает {{ lead.name }}?
                </span>
                <select
                  [(ngModel)]="selectedTargetThreadId"
                  class="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                >
                  @for (th of (arena.activeThreads$ | async) ?? []; track th.id) {
                    <option [value]="th.id">
                      {{ th.title }} (сейчас {{ th.votesCount }} гол. · {{ th.sharePercent }}%)
                    </option>
                  }
                </select>
              </label>
            }

            @if (voiceIntent() === 'COUNTER_PROPOSE') {
              <div class="flex flex-col gap-2 mt-1 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
                <span class="font-label-ui text-xs font-bold text-on-surface">
                  Выберите Карточку Желания из колоды или введите новую:
                </span>
                <div class="flex flex-wrap gap-1.5">
                  @for (card of (arena.desireCards$ | async) ?? []; track card.id) {
                    <button
                      type="button"
                      (click)="selectCardForVersusProposal(card)"
                      class="px-2.5 py-1 rounded-lg font-label-ui text-xs font-semibold transition-all border inline-flex items-center gap-1"
                      [class]="
                        versusProposalTitle === card.title
                          ? 'bg-primary text-on-primary border-primary shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:border-primary'
                      "
                    >
                      <span class="material-symbols-rounded text-sm">{{ card.icon }}</span>
                      <span>{{ card.title }}</span>
                      <span class="opacity-70 text-[10px]">({{ card.winsCount }}W/{{ card.gamesPlayed }}G)</span>
                    </button>
                  }
                </div>
                <input
                  type="text"
                  [(ngModel)]="versusProposalTitle"
                  placeholder="Или впишите новую карточку желания..."
                  class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface"
                />
              </div>
            }
          </div>

          <div class="lg:col-span-7 flex flex-col gap-2.5">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="font-label-ui text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                2. Войс / Реплика от имени «{{ lead.name }}»
              </span>
              <button
                type="button"
                (click)="fillWithPersonaDraft()"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-container/50 hover:bg-primary-container text-on-primary-container font-label-ui text-xs font-bold transition-colors"
              >
                <span class="material-symbols-rounded text-sm">psychology</span>
                <span>⚡ Сгенерировать мысль как {{ lead.name }}</span>
              </button>
            </div>

            <textarea
              [(ngModel)]="voiceInputText"
              rows="3"
              [placeholder]="'Напишите войс от лица персонажа «' + lead.name + '» или нажмите кнопку генерации мысли выше...'"
              class="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 focus:border-primary focus:bg-surface-container-lowest focus:outline-none font-body-sm text-sm text-on-surface"
            ></textarea>

            @if (recordedAudioDataUrl()) {
              <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <span class="font-label-ui font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span class="material-symbols-rounded text-base">mic</span>
                  Голосовой аудио-войс записан и будет прикреплён к реплике!
                </span>
                <button
                  type="button"
                  (click)="recordedAudioDataUrl.set(undefined)"
                  class="text-rose-600 font-bold hover:underline"
                >
                  Удалить аудио
                </button>
              </div>
            }

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div class="flex items-center gap-1.5 text-[11px] font-label-code-sm text-on-surface-variant">
                <span class="material-symbols-rounded text-sm text-primary">neurology</span>
                <span>Слепок запишется в нейрон + пополнит историю карточки желания</span>
              </div>

              <button
                type="button"
                (click)="submitLeadVoice()"
                class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-95 active:scale-98 transition-all"
              >
                <span class="material-symbols-rounded text-base">record_voice_over</span>
                <span>
                  {{
                    voiceIntent() === 'COUNTER_PROPOSE'
                      ? 'Вбросить Карточку в Поле + Войс'
                      : voiceIntent() === 'SUPPORT'
                        ? 'Подтвердить Тред + Оставить Войс'
                        : 'Отправить Войс от имени Персонажа'
                  }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    }
  `,
})
export class ArenaVoiceStudioComponent {
  protected readonly arena = inject(NeuronArenaService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly voiceSourceMode = signal<ArenaVoiceSource>('MANUAL_PUPPET');
  readonly voiceIntent = signal<ArenaVoiceIntent>('SUPPORT');
  readonly isRecordingMic = signal(false);
  readonly recordedAudioDataUrl = signal<string | undefined>(undefined);

  selectedTargetThreadId = 'thread-drink-beer';
  versusProposalTitle = 'Поиграть в настольную игру';
  voiceInputText = '';

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  readonly intentButtons: { id: ArenaVoiceIntent; label: string; sub: string; icon: string; iconColor: string }[] = [
    { id: 'SUPPORT', label: 'Поддержать тред', sub: 'Подтвердить карточку в поле', icon: 'thumb_up', iconColor: 'text-emerald-600' },
    { id: 'COUNTER_PROPOSE', label: 'Versus-Хотелка', sub: 'Предложить другую карточку', icon: 'swords', iconColor: 'text-amber-600' },
    { id: 'PARADOX_OPINION', label: 'Мнение на парадокс', sub: 'Философский взгляд героя', icon: 'psychology_alt', iconColor: 'text-indigo-600' },
    { id: 'ANALYTICS', label: 'Аналитика карточек', sub: 'Разбор шансов и истории', icon: 'query_stats', iconColor: 'text-violet-600' },
  ];

  constructor() {
    // При смене Главного Персонажа в режиме «Нейро-Черновик» подставляем реплику в его характере.
    this.arena.leadActor$
      .pipe(
        map((actor) => actor.id),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.voiceSourceMode() === 'NEURAL_DRAFT') {
          this.fillWithPersonaDraft();
          this.cdr.markForCheck();
        }
      });
  }

  setVoiceIntent(intent: ArenaVoiceIntent): void {
    this.voiceIntent.set(intent);
    if (this.voiceSourceMode() === 'NEURAL_DRAFT') {
      this.fillWithPersonaDraft();
    }
  }

  selectCardForVersusProposal(card: ArenaDesireCard): void {
    this.versusProposalTitle = card.title;
  }

  fillWithPersonaDraft(): void {
    this.voiceInputText = this.arena.generatePersonaDraft(this.voiceIntent(), this.selectedTargetThreadId);
  }

  submitLeadVoice(): void {
    const intent = this.voiceIntent();
    const source = this.recordedAudioDataUrl() ? 'AUDIO_VOICE' : this.voiceSourceMode();

    if (intent === 'COUNTER_PROPOSE') {
      this.arena.proposeVersusThread({
        title: this.versusProposalTitle || 'Поиграть в настольную игру',
        initialVoiceText: this.voiceInputText,
        sourceMode: source,
        audioDataUrl: this.recordedAudioDataUrl(),
      });
    } else if (intent === 'SUPPORT') {
      this.arena.supportThread(this.selectedTargetThreadId, this.voiceInputText, source, this.recordedAudioDataUrl());
    } else {
      const text = this.voiceInputText.trim() || this.arena.generatePersonaDraft(intent, this.selectedTargetThreadId);
      this.arena.postActorVoice({
        text,
        intent,
        sourceMode: source,
        audioDataUrl: this.recordedAudioDataUrl(),
      });
    }

    this.voiceInputText = '';
    this.recordedAudioDataUrl.set(undefined);
  }

  async toggleMicRecording(): Promise<void> {
    if (this.isRecordingMic()) {
      this.mediaRecorder?.stop();
      this.isRecordingMic.set(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            this.recordedAudioDataUrl.set(reader.result);
            this.voiceSourceMode.set('AUDIO_VOICE');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecordingMic.set(true);
    } catch {
      this.isRecordingMic.set(false);
    }
  }
}
