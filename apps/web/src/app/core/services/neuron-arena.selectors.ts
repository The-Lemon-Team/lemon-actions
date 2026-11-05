import { Observable, combineLatest, filter, map, shareReplay } from 'rxjs';
import {
  ArenaActorCard,
  ArenaDeckAnalytics,
  ArenaDesireCard,
  ArenaDesireThread,
  ArenaParadoxField,
  ArenaVoiceEntry,
  CombineActivitySuggestion,
  CombineHistoryCard,
  CombineTimeField,
  NeuralTrainingSample,
} from '../models/flow.models';
import {
  ArenaStateStore,
  buildTrainingSamples,
  computeCardDerivedStats,
  computeDeckAnalytics,
  enrichActiveThreads,
} from './neuron-arena.helpers';

/** РџСЂРѕРёР·РІРѕРґРЅС‹Рµ СЂРµР°РєС‚РёРІРЅС‹Рµ РїРѕС‚РѕРєРё Р°СЂРµРЅС‹ РїРѕРІРµСЂС… РµРґРёРЅРѕРіРѕ BehaviorSubject СЃРѕ store. */
export function buildArenaSelectors(
  state$: Observable<ArenaStateStore>,
  selectedDesireCardId$: Observable<string>,
) {
  const combineTimeFields$: Observable<CombineTimeField[]> = state$.pipe(
    map((s) => s.combineTimeFields ?? []),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const activeCombineField$: Observable<CombineTimeField> = state$.pipe(
    map(
      (s) =>
        (s.combineTimeFields ?? []).find((f) => f.id === s.activeCombineFieldId) ??
        (s.combineTimeFields ?? [])[0],
    ),
    filter((f): f is CombineTimeField => Boolean(f)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const activeCombineSuggestions$: Observable<CombineActivitySuggestion[]> = combineLatest([
    state$,
    activeCombineField$,
  ]).pipe(
    map(([state, field]) =>
      (state.combineSuggestions ?? []).filter((c) => field && c.timeFieldId === field.id),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const pinnedCombineActivities$: Observable<CombineActivitySuggestion[]> =
    activeCombineSuggestions$.pipe(
      map((list) => list.filter((item) => item.isPinned)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  const proposedCombineActivities$: Observable<CombineActivitySuggestion[]> =
    activeCombineSuggestions$.pipe(
      map((list) => list.filter((item) => !item.isPinned && item.outcome !== 'BORED_REPLACED')),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  const replacedCombineActivities$: Observable<CombineActivitySuggestion[]> =
    activeCombineSuggestions$.pipe(
      map((list) => list.filter((item) => !item.isPinned && item.outcome === 'BORED_REPLACED')),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  const combineHistoryCards$: Observable<CombineHistoryCard[]> = state$.pipe(
    map((s) => s.combineHistoryCards ?? []),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const actors$: Observable<ArenaActorCard[]> = state$.pipe(
    map((s) =>
      s.actors.map((a) => ({
        ...a,
        isLead: a.id === s.leadActorId,
        voicesCount: s.voices.filter((v) => v.actorId === a.id).length,
      })),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const leadActor$: Observable<ArenaActorCard> = actors$.pipe(
    map((actors) => actors.find((a) => a.isLead) ?? actors[0]),
    filter((a): a is ArenaActorCard => Boolean(a)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const paradoxes$: Observable<ArenaParadoxField[]> = state$.pipe(
    map((s) => s.paradoxes),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const activeParadox$: Observable<ArenaParadoxField> = state$.pipe(
    map((s) => s.paradoxes.find((p) => p.id === s.activeParadoxId) ?? s.paradoxes[0]),
    filter((p): p is ArenaParadoxField => Boolean(p)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const desireCards$: Observable<ArenaDesireCard[]> = combineLatest([
    state$,
    activeParadox$,
  ]).pipe(
    map(([state, paradox]) => {
      const cardsMap = new Map(state.desireCards.map((c) => [c.id, c.title]));
      const activeFieldCardIds = new Set(
        state.threads
          .filter((t) => paradox && t.paradoxId === paradox.id)
          .map((t) => t.desireCardId)
          .filter((id): id is string => !!id),
      );
      return state.desireCards.map((card) =>
        computeCardDerivedStats(card, cardsMap, activeFieldCardIds),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const inspectedDesireCard$: Observable<ArenaDesireCard | null> = combineLatest([
    desireCards$,
    selectedDesireCardId$,
  ]).pipe(
    map(([cards, selectedId]) => cards.find((c) => c.id === selectedId) ?? cards[0] ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const deckAnalytics$: Observable<ArenaDeckAnalytics> = desireCards$.pipe(
    map((cards) => computeDeckAnalytics(cards)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const activeThreads$: Observable<ArenaDesireThread[]> = combineLatest([
    state$,
    actors$,
    activeParadox$,
    desireCards$,
  ]).pipe(
    map(([state, actors, paradox, desireCards]) =>
      enrichActiveThreads(state, actors, paradox, desireCards),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const activeVoices$: Observable<ArenaVoiceEntry[]> = combineLatest([
    state$,
    activeParadox$,
  ]).pipe(
    map(([state, paradox]) =>
      state.voices
        .filter((v) => paradox && v.paradoxId === paradox.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const trainingSamples$: Observable<NeuralTrainingSample[]> = combineLatest([
    state$,
    actors$,
  ]).pipe(
    map(([state, actors]) => buildTrainingSamples(state, actors)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const arenaMetrics$ = combineLatest([
    actors$,
    desireCards$,
    activeThreads$,
    activeVoices$,
    trainingSamples$,
  ]).pipe(
    map(([actors, desireCards, threads, voices, samples]) => {
      const totalVotes = threads.reduce((acc, t) => acc + t.votesCount, 0);
      const leader = threads[0] ?? null;
      return {
        actorsCount: actors.length,
        desireCardsCount: desireCards.length,
        threadsCount: threads.length,
        totalVotes,
        voicesCount: voices.length,
        trainingSamplesCount: samples.length,
        leadingThreadTitle: leader ? leader.title : 'Нет тредов',
        leadingThreadVotes: leader ? leader.votesCount : 0,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  return {
    combineTimeFields$,
    activeCombineField$,
    activeCombineSuggestions$,
    pinnedCombineActivities$,
    proposedCombineActivities$,
    replacedCombineActivities$,
    combineHistoryCards$,
    actors$,
    leadActor$,
    paradoxes$,
    activeParadox$,
    desireCards$,
    inspectedDesireCard$,
    deckAnalytics$,
    activeThreads$,
    activeVoices$,
    trainingSamples$,
    arenaMetrics$,
  };
}
