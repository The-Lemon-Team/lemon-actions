import { Injectable, inject, signal } from '@angular/core';
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
  CloudDayNote,
  CloudItemType,
  NoteVisibility,
  Flow,
  NeuralTrainingSample,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { SEED_HERO_CLOUD_NOTES } from './hero-notes.seeds';
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

const STORAGE_NOTES_KEY = 'lemon-party:cloud-notes-v3';

function loadStoredNotes(): Record<string, CloudDayNote[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
  }
  return SEED_HERO_CLOUD_NOTES;
}

function saveStoredNotes(store: Record<string, CloudDayNote[]>): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(store));
    } catch {}
  }
}

@Injectable({ providedIn: 'root' })
export class NeuronArenaService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);

  private stateFlowId: string | null = null;
  private readonly stateSubject = new BehaviorSubject<ArenaStateStore>(loadCachedArenaState(this.profileService.currentProfileId));
  private readonly speakingVoiceIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedDesireCardIdSubject = new BehaviorSubject<string>('card-drink-beer');

  private readonly notesSubject = new BehaviorSubject<Record<string, CloudDayNote[]>>(loadStoredNotes());
  readonly notesMap$: Observable<Record<string, CloudDayNote[]>> = this.notesSubject.asObservable();

  readonly allNotes$: Observable<CloudDayNote[]> = this.notesMap$.pipe(
    map((m) => Object.values(m).flat()),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

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

  readonly showNewDesireCardModal = signal(false);
  readonly showNewActorModal = signal(false);
  readonly showNewParadoxModal = signal(false);

  openNewDesireCardModal(): void {
    this.showNewDesireCardModal.set(true);
  }

  closeNewDesireCardModal(): void {
    this.showNewDesireCardModal.set(false);
  }

  openNewActorModal(): void {
    this.showNewActorModal.set(true);
  }

  closeNewActorModal(): void {
    this.showNewActorModal.set(false);
  }

  openNewParadoxModal(): void {
    this.showNewParadoxModal.set(true);
  }

  closeNewParadoxModal(): void {
    this.showNewParadoxModal.set(false);
  }

  previewActorVoice(actor: ArenaActorCard, text?: string): void {
    const sampleText = text || actor.quote || actor.sampleVoices?.support || actor.sampleVoices?.paradox || '';
    const mockVoice: ArenaVoiceEntry = {
      id: `preview-${actor.id}-${Date.now()}`,
      actorId: actor.id,
      actorName: actor.name,
      actorTitle: actor.title,
      actorIcon: actor.avatarIcon,
      actorAccent: actor.accentColor,
      paradoxId: 'preview-paradox',
      threadId: 'preview-thread',
      intent: 'PARADOX_OPINION',
      sourceMode: 'AUDIO_VOICE',
      durationSec: 3,
      text: sampleText,
      activeNeuronSessions: [],
      createdAt: new Date().toISOString(),
    };
    this.playVoiceAudio(mockVoice);
  }

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

  voteForDesireCard(cardId: string, actorId?: string): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === (actorId || state.leadActorId)) ?? state.actors[0];
    const updatedCards = state.desireCards.map((c) => {
      if (c.id === cardId) {
        return {
          ...c,
          totalHistoricalVotes: c.totalHistoricalVotes + 1,
          winsCount: c.winsCount + 1,
        };
      }
      return c;
    });
    this.commitState({ ...state, desireCards: updatedCards });
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

  /* ================== HYBRID HERO NOTES & CLOUD PINNING SYSTEM ================== */

  /** Текущий статус модерации: Хост-Администратор / GM (Мастер Арены) */
  readonly isAdminMode = signal<boolean>(true);

  getHeroNotes(actorId: string): Observable<CloudDayNote[]> {
    return combineLatest([this.allNotes$, this.profileService.activeProfileId$]).pipe(
      map(([notes, activeProfileId]) => {
        const isAdmin = this.isAdminMode();
        return notes
          .filter(
            (n) =>
              n.actorId === actorId &&
              (n.visibility === 'PUBLIC' ||
                !n.visibility ||
                n.authorProfileId === activeProfileId ||
                (n.visibility === 'GM_ONLY' && isAdmin)),
          )
          .sort((a, b) => {
            if (Boolean(a.isPinnedToHero) !== Boolean(b.isPinnedToHero)) {
              return a.isPinnedToHero ? -1 : 1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getPinnedHeroNotes(actorId: string): Observable<CloudDayNote[]> {
    return this.getHeroNotes(actorId).pipe(
      map((notes) => notes.filter((n) => Boolean(n.isPinnedToHero))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  addHeroNote(input: {
    actorId: string;
    text: string;
    title?: string;
    type?: CloudItemType;
    visibility?: NoteVisibility;
    isPinnedToHero?: boolean;
    isPinnedToCloud?: boolean;
    tags?: string[];
  }): CloudDayNote {
    const actor = this.stateSubject.value.actors.find((a) => a.id === input.actorId);
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const nowTime = nowIso.substring(11, 16);
    const [h, m] = nowTime.split(':').map(Number);
    const timeMinutes = (h || 0) * 60 + (m || 0);

    const currentProfile = this.profileService.currentProfileId;
    const authorName = 'Вы (' + currentProfile.substring(0, 5) + ')';

    const newNote: CloudDayNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dateKey: today,
      time: nowTime,
      timeMinutes,
      type: input.type || 'thought',
      actorId: input.actorId,
      actorName: actor?.name || 'Герой',
      actorAvatar: actor?.avatarIcon || 'person',
      actorAccent: actor?.accentColor || 'amber',
      actorTitle: actor?.title || '',
      title: input.title?.trim() || undefined,
      text: input.text.trim(),
      tags: input.tags || [],
      supporters: [],
      votesCount: 0,
      createdAt: nowIso,
      authorProfileId: currentProfile,
      authorProfileName: authorName,
      visibility: input.visibility || 'PUBLIC',
      isPinnedToHero: Boolean(input.isPinnedToHero),
      isPinnedToCloud: Boolean(input.isPinnedToCloud),
    };

    const currentMap = { ...this.notesSubject.value };
    const dayNotes = currentMap[today] ? [newNote, ...currentMap[today]] : [newNote];
    currentMap[today] = dayNotes;

    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);
    return newNote;
  }

  togglePinToHero(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const nextPinned = !note.isPinnedToHero;
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, isPinnedToHero: nextPinned },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        modified = true;
        break;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  togglePinToCloud(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const nextPinned = !note.isPinnedToCloud;
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, isPinnedToCloud: nextPinned },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        modified = true;
        break;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  /**
   * Забрать себе из Общего облака / Публичного хаба:
   * Создает изолированную личную копию (PRIVATE) в профиле текущего игрока
   * с авто-прикреплением к карточке этого героя (isPinnedToHero: true).
   */
  adoptNoteToPrivate(noteId: string): CloudDayNote | null {
    const all = Object.values(this.notesSubject.value).flat();
    const original = all.find((n) => n.id === noteId);
    if (!original) return null;

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const nowTime = nowIso.substring(11, 16);
    const [h, m] = nowTime.split(':').map(Number);
    const timeMinutes = (h || 0) * 60 + (m || 0);

    const currentProfile = this.profileService.currentProfileId;
    const authorName = 'Вы (' + currentProfile.substring(0, 5) + ')';

    const adoptedNote: CloudDayNote = {
      ...original,
      id: `fork-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dateKey: today,
      time: nowTime,
      timeMinutes,
      createdAt: nowIso,
      authorProfileId: currentProfile,
      authorProfileName: authorName,
      visibility: 'PRIVATE',
      isPinnedToHero: true,
      isPinnedToCloud: false,
      forkedFromNoteId: original.id,
      forkedFromAuthorName: original.actorName || original.authorProfileName || 'Общий Хаб',
    };

    const currentMap = { ...this.notesSubject.value };
    const dayNotes = currentMap[today] ? [adoptedNote, ...currentMap[today]] : [adoptedNote];
    currentMap[today] = dayNotes;

    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);
    return adoptedNote;
  }

  deleteNote(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const filtered = currentMap[dateKey].filter((n) => n.id !== noteId);
      if (filtered.length !== currentMap[dateKey].length) {
        currentMap[dateKey] = filtered;
        modified = true;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  voteForNote(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, votesCount: (note.votesCount || 0) + 1 },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        this.notesSubject.next(currentMap);
        saveStoredNotes(currentMap);
        break;
      }
    }
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
