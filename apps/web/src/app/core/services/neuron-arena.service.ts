import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  filter,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaActorCategory,
  ArenaDeckAnalytics,
  ArenaDesireCard,
  ArenaDesireThread,
  ArenaParadoxField,
  ArenaPeriodSummary,
  ArenaVoiceEntry,
  ArenaVoiceIntent,
  ArenaVoiceSource,
  CombineActivitySuggestion,
  CombineHistoryCard,
  CombineIdeaOutcome,
  CombineTimeField,
  Flow,
  NeuralTrainingSample,
} from '../models/flow.models';
import { ApiService } from './api.service';
import {
  ArenaStateStore,
  buildTrainingSamples,
  computeCardDerivedStats,
  computeDeckAnalytics,
  createEmptyArenaStore,
  enrichActiveThreads,
} from './neuron-arena.helpers';
import {
  buildCombineHistoryCardFromStore,
  buildNewActorCard,
  createVoiceRecordInStore,
  replaceBoredSuggestionInStore,
  resolvePeriodInStore,
} from './neuron-arena.mutations';
import { buildArenaSelectors } from './neuron-arena.selectors';
import {
  buildCombineSuggestion,
  buildCombineTimeField,
  buildDesireCard,
  buildParadoxField,
  buildPersonaDraft,
  buildThreadFromCard,
} from './neuron-arena.builders';
import {
  buildArenaStatePayload,
  clearCachedArenaState,
  loadCachedArenaState,
  parseArenaFlows,
  saveCachedArenaState,
} from './neuron-arena.storage';
import { cancelVoicePlayback, startVoicePlayback } from './neuron-arena.voice-player';
import { ProfileService } from './profile.service';

@Injectable({ providedIn: 'root' })
export class NeuronArenaService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);

  private stateFlowId: string | null = null;
  private readonly stateSubject = new BehaviorSubject<ArenaStateStore>(loadCachedArenaState(this.profileService.currentProfileId));
  private readonly speakingVoiceIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedDesireCardIdSubject = new BehaviorSubject<string>('card-drink-beer');

  readonly speakingVoiceId$: Observable<string | null> = this.speakingVoiceIdSubject.asObservable();
  readonly selectedDesireCardId$: Observable<string> = this.selectedDesireCardIdSubject.asObservable();

  private readonly selectors = buildArenaSelectors(this.stateSubject, this.selectedDesireCardId$);

  readonly combineTimeFields$ = this.selectors.combineTimeFields$;
  readonly activeCombineField$ = this.selectors.activeCombineField$;
  readonly activeCombineSuggestions$ = this.selectors.activeCombineSuggestions$;
  readonly pinnedCombineActivities$ = this.selectors.pinnedCombineActivities$;
  readonly proposedCombineActivities$ = this.selectors.proposedCombineActivities$;
  readonly replacedCombineActivities$ = this.selectors.replacedCombineActivities$;
  readonly combineHistoryCards$ = this.selectors.combineHistoryCards$;
  readonly actors$ = this.selectors.actors$;
  readonly leadActor$ = this.selectors.leadActor$;
  readonly paradoxes$ = this.selectors.paradoxes$;
  readonly activeParadox$ = this.selectors.activeParadox$;
  readonly desireCards$ = this.selectors.desireCards$;
  readonly inspectedDesireCard$ = this.selectors.inspectedDesireCard$;
  readonly deckAnalytics$ = this.selectors.deckAnalytics$;
  readonly activeThreads$ = this.selectors.activeThreads$;
  readonly activeVoices$ = this.selectors.activeVoices$;
  readonly trainingSamples$ = this.selectors.trainingSamples$;
  readonly arenaMetrics$ = this.selectors.arenaMetrics$;

  constructor() {
    this.profileService.activeProfileId$.subscribe((profileId) => {
      this.stateSubject.next(loadCachedArenaState(this.profileService.currentProfileId));
      this.hydrateFromBackend(profileId, false);
    });
  }

  selectLeadActor(actorId: string): void {
    const state = this.stateSubject.value;
    if (!state.actors.some((a) => a.id === actorId)) return;
    this.commitState({ ...state, leadActorId: actorId });
  }

  inspectDesireCard(cardId: string): void {
    this.selectedDesireCardIdSubject.next(cardId);
  }

  selectParadoxField(paradoxId: string): void {
    const state = this.stateSubject.value;
    if (!state.paradoxes.some((p) => p.id === paradoxId)) return;
    this.commitState({ ...state, activeParadoxId: paradoxId });
  }

  playDesireCardToField(
    desireCardId: string,
    customVoiceText?: string,
    sourceMode: ArenaVoiceSource = 'MANUAL_PUPPET',
    audioDataUrl?: string,
  ): void {
    const state = this.stateSubject.value;
    const card = state.desireCards.find((c) => c.id === desireCardId);
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!card || !actor || !paradox) return;

    this.selectedDesireCardIdSubject.next(card.id);

    const existingThread = state.threads.find(
      (t) =>
        t.paradoxId === paradox.id &&
        (t.desireCardId === card.id || t.title.toLowerCase() === card.title.toLowerCase()),
    );
    if (existingThread) {
      this.supportThread(existingThread.id, customVoiceText, sourceMode, audioDataUrl);
      return;
    }

    const voiceText =
      customVoiceText?.trim() ||
      `Достаю из колоды карточку желания «${card.title}» (${card.gamesPlayed} игр в истории, ${card.winsCount} побед) и вбрасываю её в Versus Mode! ${actor.sampleVoices.counter}`;

    const newThread = buildThreadFromCard(card, actor, paradox.id);

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      newThread.id,
      card.title,
      'COUNTER_PROPOSE',
      sourceMode,
      voiceText,
      card.id,
      audioDataUrl,
    );

    const updatedParadoxes = state.paradoxes.map((p) =>
      p.id === paradox.id ? { ...p, status: 'ACTIVE_BATTLE' as const } : p,
    );

    this.commitState({
      ...state,
      paradoxes: updatedParadoxes,
      threads: [...state.threads, newThread],
      voices: [newVoice, ...state.voices],
    });
  }

  createDesireCard(input: {
    title: string;
    category: string;
    description: string;
    icon: string;
    colorTheme: ArenaAccentColor;
    tagsRaw?: string;
    playImmediately?: boolean;
    initialVoiceText?: string;
    audioDataUrl?: string;
  }): ArenaDesireCard | null {
    if (!input.title.trim()) return null;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const newCard = buildDesireCard(input, actor);

    this.commitState({ ...state, desireCards: [newCard, ...state.desireCards] });
    this.selectedDesireCardIdSubject.next(newCard.id);
    if (input.playImmediately !== false) {
      this.playDesireCardToField(newCard.id, input.initialVoiceText, 'MANUAL_PUPPET', input.audioDataUrl);
    }
    return newCard;
  }

  supportThread(
    threadId: string,
    voiceText?: string,
    sourceMode: ArenaVoiceSource = 'MANUAL_PUPPET',
    audioDataUrl?: string,
  ): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const thread = state.threads.find((t) => t.id === threadId);
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!actor || !thread || !paradox) return;

    if (thread.desireCardId) {
      this.selectedDesireCardIdSubject.next(thread.desireCardId);
    }

    const alreadySupported = thread.supporterActorIds.includes(actor.id);
    const updatedThreads = state.threads.map((t) =>
      t.id !== threadId
        ? t
        : {
            ...t,
            supporterActorIds: alreadySupported
              ? t.supporterActorIds
              : [...t.supporterActorIds, actor.id],
          },
    );

    const cleanVoice =
      (voiceText ?? '').trim() ||
      (alreadySupported
        ? `Ещё раз усиливаю голосом карточку «${thread.title}»! ${actor.sampleVoices.support}`
        : `Зашёл в поле, увидел карточку «${thread.title}» и подтверждаю её! ${actor.sampleVoices.support}`);

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      thread.id,
      thread.title,
      'SUPPORT',
      sourceMode,
      cleanVoice,
      thread.desireCardId ?? thread.id,
      audioDataUrl,
    );

    this.commitState({
      ...state,
      threads: updatedThreads,
      voices: [newVoice, ...state.voices],
    });
  }

  proposeVersusThread(input: {
    title: string;
    subtitle?: string;
    icon?: string;
    colorTheme?: ArenaAccentColor;
    initialVoiceText?: string;
    sourceMode?: ArenaVoiceSource;
    audioDataUrl?: string;
  }): void {
    const title = input.title.trim();
    if (!title) return;

    const existingCard = this.stateSubject.value.desireCards.find(
      (c) => c.title.toLowerCase() === title.toLowerCase(),
    );
    if (existingCard) {
      this.playDesireCardToField(
        existingCard.id,
        input.initialVoiceText,
        input.sourceMode ?? 'MANUAL_PUPPET',
        input.audioDataUrl,
      );
      return;
    }

    this.createDesireCard({
      title,
      category: 'Versus-Импульс',
      description: input.subtitle?.trim() || `Альтернативная карточка желания «${title}»`,
      icon: input.icon || 'bolt',
      colorTheme: input.colorTheme || 'amber',
      playImmediately: true,
      initialVoiceText: input.initialVoiceText,
      audioDataUrl: input.audioDataUrl,
    });
  }

  postActorVoice(input: {
    text: string;
    intent: ArenaVoiceIntent;
    threadId?: string | null;
    sourceMode?: ArenaVoiceSource;
    audioDataUrl?: string;
  }): void {
    const cleanText = input.text.trim();
    if (!cleanText) return;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!actor || !paradox) return;

    const targetThread = input.threadId
      ? state.threads.find((t) => t.id === input.threadId)
      : undefined;

    const updatedThreads =
      input.intent === 'SUPPORT' && targetThread
        ? state.threads.map((t) =>
            t.id !== targetThread.id || t.supporterActorIds.includes(actor.id)
              ? t
              : { ...t, supporterActorIds: [...t.supporterActorIds, actor.id] },
          )
        : state.threads;

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      targetThread?.id ?? null,
      targetThread?.title ?? null,
      input.intent,
      input.sourceMode ?? 'MANUAL_PUPPET',
      cleanText,
      targetThread?.desireCardId ?? targetThread?.id ?? null,
      input.audioDataUrl,
    );

    this.commitState({
      ...state,
      threads: updatedThreads,
      voices: [newVoice, ...state.voices],
    });
  }

  generatePersonaDraft(intent: ArenaVoiceIntent, targetThreadId?: string | null): string {
    return buildPersonaDraft(this.stateSubject.value, intent, targetThreadId);
  }

  resolvePeriodWithSummary(): ArenaPeriodSummary | null {
    const res = resolvePeriodInStore(this.stateSubject.value);
    if (!res) return null;
    this.commitState(res.nextState);
    return res.summary;
  }

  reopenPeriod(): void {
    const state = this.stateSubject.value;
    this.commitState({
      ...state,
      paradoxes: state.paradoxes.map((p) =>
        p.id === state.activeParadoxId
          ? { ...p, status: 'ACTIVE_BATTLE' as const, periodLabel: 'Период открыт · Versus Mode активен' }
          : p,
      ),
    });
  }

  createActorCard(input: {
    name: string;
    title: string;
    category: ArenaActorCategory;
    avatarIcon: string;
    accentColor: ArenaAccentColor;
    quote: string;
    paradoxPhilosophy: string;
    favoriteDesire: string;
    affinitiesRaw?: string;
  }): ArenaActorCard {
    const newActor = buildNewActorCard(input);
    const state = this.stateSubject.value;
    this.commitState({
      ...state,
      actors: [newActor, ...state.actors],
      leadActorId: newActor.id,
    });
    return newActor;
  }

  createParadoxField(input: {
    title: string;
    occasionTag: string;
    contextStory: string;
    paradoxQuestion: string;
    starterDesireCardId?: string;
    initialThreadTitle?: string;
    initialThreadIcon?: string;
  }): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const newParadox = buildParadoxField(input);
    const starterCard = input.starterDesireCardId
      ? state.desireCards.find((c) => c.id === input.starterDesireCardId)
      : state.desireCards[0];

    this.commitState({
      ...state,
      paradoxes: [newParadox, ...state.paradoxes],
      activeParadoxId: newParadox.id,
      threads:
        starterCard && actor
          ? [...state.threads, buildThreadFromCard(starterCard, actor, newParadox.id, 100, true)]
          : state.threads,
    });
  }

  selectCombineTimeField(fieldId: string): void {
    const state = this.stateSubject.value;
    if (!state.combineTimeFields.some((f) => f.id === fieldId)) return;
    this.commitState({ ...state, activeCombineFieldId: fieldId });
  }

  togglePinCombineSuggestion(suggestionId: string): void {
    const state = this.stateSubject.value;
    const nowIso = new Date().toISOString();
    const updated = state.combineSuggestions.map((s) => {
      if (s.id !== suggestionId) return s;
      const nextPinned = !s.isPinned;
      return {
        ...s,
        isPinned: nextPinned,
        pinnedAt: nextPinned ? nowIso : null,
        outcome: nextPinned && s.outcome === 'BORED_REPLACED' ? ('PENDING' as const) : s.outcome,
      };
    });
    this.commitState({ ...state, combineSuggestions: updated });
  }

  replaceBoredSuggestionWithNewCard(
    boredSuggestionId: string,
    replacementTitle = 'Слушать подкаст',
    replacementReason = 'Наскучило в процессе — решили заняться чем-то поважнее и глубже',
  ): void {
    const state = this.stateSubject.value;
    const updatedSuggestions = replaceBoredSuggestionInStore(
      state,
      boredSuggestionId,
      replacementTitle,
      replacementReason,
    );
    if (!updatedSuggestions) return;
    this.commitState({ ...state, combineSuggestions: updatedSuggestions });
  }

  rateCombineSuggestion(suggestionId: string, outcome: CombineIdeaOutcome, note?: string): void {
    const state = this.stateSubject.value;
    const updated = state.combineSuggestions.map((s) =>
      s.id !== suggestionId
        ? s
        : {
            ...s,
            outcome,
            outcomeNote:
              note ??
              (outcome === 'HIT'
                ? 'Идея оказалась супер-удачной в этом поле времени!'
                : outcome === 'BORED_REPLACED'
                  ? 'Быстро наскучило в процессе.'
                  : 'Неплохое дополнение.'),
          },
    );
    this.commitState({ ...state, combineSuggestions: updated });
  }

  proposeNewCombineSuggestion(input: {
    title: string;
    subtitle?: string;
    icon?: string;
    pitchVoice?: string;
    pinImmediately?: boolean;
  }): void {
    if (!input.title.trim()) return;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const field =
      state.combineTimeFields.find((f) => f.id === state.activeCombineFieldId) ??
      state.combineTimeFields[0];
    if (!actor || !field) return;

    this.commitState({
      ...state,
      combineSuggestions: [buildCombineSuggestion(input, actor, field), ...state.combineSuggestions],
    });
  }

  saveActiveCombineFieldToHistory(): CombineHistoryCard | null {
    const state = this.stateSubject.value;
    const historyCard = buildCombineHistoryCardFromStore(state);
    if (!historyCard) return null;

    this.commitState({
      ...state,
      combineTimeFields: state.combineTimeFields.map((f) =>
        f.id === historyCard.timeFieldId ? { ...f, status: 'SAVED_TO_HISTORY' as const } : f,
      ),
      combineHistoryCards: [historyCard, ...(state.combineHistoryCards ?? [])],
    });
    return historyCard;
  }

  createCombineTimeField(input: {
    title: string;
    baseActivity: string;
    baseIcon: string;
    durationLabel: string;
    contextDescription?: string;
  }): void {
    if (!input.baseActivity.trim()) return;
    const state = this.stateSubject.value;
    const newField = buildCombineTimeField(input);
    this.commitState({
      ...state,
      combineTimeFields: [newField, ...state.combineTimeFields],
      activeCombineFieldId: newField.id,
    });
  }

  playVoiceAudio(voice: ArenaVoiceEntry): void {
    if (this.speakingVoiceIdSubject.value === voice.id) {
      this.stopVoiceAudio();
      return;
    }
    this.stopVoiceAudio();
    this.speakingVoiceIdSubject.next(voice.id);

    const actor = this.stateSubject.value.actors.find((a) => a.id === voice.actorId);
    startVoicePlayback(voice, actor, () => {
      if (this.speakingVoiceIdSubject.value === voice.id) this.speakingVoiceIdSubject.next(null);
    });
  }

  stopVoiceAudio(): void {
    cancelVoicePlayback();
    this.speakingVoiceIdSubject.next(null);
  }

  resetDemoArena(): void {
    clearCachedArenaState(this.profileService.currentProfileId);
    this.hydrateFromBackend(this.profileService.currentProfileId, true);
  }

  private hydrateFromBackend(profileId: string, forceOverwrite: boolean): void {
    this.api
      .getFlows({ profileId, scope: 'arena' })
      .pipe(catchError(() => of([] as Flow[])))
      .subscribe((flows) => {
        const { store, stateFlowId } = parseArenaFlows(flows);
        if (stateFlowId) this.stateFlowId = stateFlowId;
        if (!store) return;

        const current = this.stateSubject.value;
        if (!forceOverwrite && current.actors.length >= 30 && current.paradoxes.length > 0) return;
        this.commitState(store, false);
      });
  }

  private commitState(next: ArenaStateStore, syncBackend = true): void {
    this.stateSubject.next(next);
    saveCachedArenaState(this.profileService.currentProfileId, next);

    if (syncBackend && this.stateFlowId) {
      this.api
        .updateFlow(this.stateFlowId, { config: { arenaState: buildArenaStatePayload(next) } })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }
}
