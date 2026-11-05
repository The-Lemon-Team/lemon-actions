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

export interface ArenaStateStore {
  actors: ArenaActorCard[];
  leadActorId: string;
  desireCards: ArenaDesireCard[];
  paradoxes: ArenaParadoxField[];
  activeParadoxId: string;
  threads: ArenaDesireThread[];
  voices: ArenaVoiceEntry[];
  combineTimeFields: CombineTimeField[];
  activeCombineFieldId: string;
  combineSuggestions: CombineActivitySuggestion[];
  combineHistoryCards: CombineHistoryCard[];
}

export function createEmptyArenaStore(): ArenaStateStore {
  return {
    actors: [],
    leadActorId: 'actor-alexey',
    desireCards: [],
    paradoxes: [],
    activeParadoxId: 'paradox-friday-afterwork',
    threads: [],
    voices: [],
    combineTimeFields: [],
    activeCombineFieldId: 'timefield-cooking-evening',
    combineSuggestions: [],
    combineHistoryCards: [],
  };
}

export function computeCardDerivedStats(
  card: ArenaDesireCard,
  allCardsMap: Map<string, string>,
  activeFieldCardIds: Set<string>,
): ArenaDesireCard {
  const history = card.matchHistory ?? [];
  const gamesPlayed = history.length;
  const winsCount = history.filter((m) => m.outcome === 'WON').length;
  const lossesCount = gamesPlayed - winsCount;
  const winRatePercent = gamesPlayed > 0 ? Math.round((winsCount / gamesPlayed) * 100) : 0;
  const totalHistoricalVotes = history.reduce((acc, m) => acc + m.votesReceived, 0);

  const lossToWinnerCounts = new Map<string, { title: string; count: number }>();
  for (const m of history) {
    if (m.outcome === 'LOST' && m.winnerCardId && m.winnerCardId !== card.id) {
      const winnerTitle = allCardsMap.get(m.winnerCardId) ?? m.winnerCardTitle;
      const cur = lossToWinnerCounts.get(m.winnerCardId) ?? { title: winnerTitle, count: 0 };
      cur.count += 1;
      lossToWinnerCounts.set(m.winnerCardId, cur);
    }
  }

  let nemesisCardTitle: string | null = null;
  let nemesisScore: string | null = null;
  let topLossCount = 0;

  for (const [, val] of lossToWinnerCounts.entries()) {
    if (val.count > topLossCount) {
      topLossCount = val.count;
      nemesisCardTitle = val.title;
    }
  }

  if (nemesisCardTitle && topLossCount > 0) {
    nemesisScore = `Уступала карточке «${nemesisCardTitle}» в ${topLossCount} из ${lossesCount} поражений`;
  }

  let analyticsInsight = '';
  if (gamesPlayed === 0) {
    analyticsInsight = 'Новая карточка желания в колоде — ещё не участвовала в завершённых периодах.';
  } else if (nemesisCardTitle && topLossCount >= 2 && winsCount < lossesCount) {
    analyticsInsight = `Участвовала в ${gamesPlayed} играх (${winsCount} побед, ${lossesCount} пораж.), всегда ярко стартует, но в очных спорах чаще выигрывало «${nemesisCardTitle}» (${topLossCount} раз)!`;
  } else if (winRatePercent >= 65) {
    analyticsInsight = `Фаворит команды (${winsCount} побед в ${gamesPlayed} играх, ${winRatePercent}% WR). Чаще других перетягивает голоса во второй половине периода!`;
  } else {
    analyticsInsight = `Стабильный участник Versus-битв: ${gamesPlayed} игр, ${winsCount} побед (${winRatePercent}% WR), собрала суммарно ${totalHistoricalVotes} голосов поддержки.`;
  }

  return {
    ...card,
    gamesPlayed,
    winsCount,
    lossesCount,
    winRatePercent,
    totalHistoricalVotes,
    nemesisCardTitle,
    nemesisScore,
    analyticsInsight,
    isInCurrentField: activeFieldCardIds.has(card.id),
  };
}

export function computeDeckAnalytics(cards: ArenaDesireCard[]): ArenaDeckAnalytics {
  const sortedByWins = [...cards].sort(
    (a, b) => b.winsCount - a.winsCount || b.winRatePercent - a.winRatePercent,
  );
  const sortedByGames = [...cards].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  const topWinnerCard = sortedByWins[0] ?? null;
  const mostPlayedCard = sortedByGames[0] ?? null;

  const beerCard = cards.find((c) => c.id === 'card-drink-beer' || c.title.toLowerCase().includes('пив'));
  const movieCard = cards.find((c) => c.id === 'card-watch-movie' || c.title.toLowerCase().includes('кино'));

  let headlineConclusion = '';
  if (beerCard && movieCard) {
    headlineConclusion = `Карточка «${beerCard.title}» участвовала в ${beerCard.gamesPlayed} играх (${beerCard.winsCount} побед, ${beerCard.lossesCount} пораж.) и чаще других зажигает спор, однако в итоге чаще выигрывало «${movieCard.title}» (${movieCard.winsCount} побед из ${movieCard.gamesPlayed}, винрейт ${movieCard.winRatePercent}%)!`;
  } else if (topWinnerCard && mostPlayedCard) {
    headlineConclusion = `Самая частая карточка в спорах — «${mostPlayedCard.title}» (${mostPlayedCard.gamesPlayed} игр), а максимальный процент побед удерживает «${topWinnerCard.title}» (${topWinnerCard.winRatePercent}% WR).`;
  }

  const rivalryInsights = cards
    .filter((c) => c.gamesPlayed > 0)
    .map((c) => `«${c.title}»: ${c.analyticsInsight}`);

  return {
    totalGamesAnalyzed: Math.max(...cards.map((c) => c.gamesPlayed), 0),
    topWinnerCard,
    mostPlayedCard,
    headlineConclusion,
    rivalryInsights,
  };
}

export function enrichActiveThreads(
  state: ArenaStateStore,
  actors: ArenaActorCard[],
  paradox: ArenaParadoxField | undefined,
  desireCards: ArenaDesireCard[],
): ArenaDesireThread[] {
  if (!paradox) return [];
  const rawThreads = state.threads.filter((t) => t.paradoxId === paradox.id);
  const totalVotes = rawThreads.reduce((acc, t) => acc + t.supporterActorIds.length, 0);
  const maxVotes = rawThreads.reduce((max, t) => Math.max(max, t.supporterActorIds.length), 0);
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const cardMap = new Map(desireCards.map((c) => [c.id, c]));

  return rawThreads
    .map((t) => {
      const supporters = t.supporterActorIds
        .map((id) => actorMap.get(id))
        .filter((a): a is ArenaActorCard => !!a)
        .map((a) => ({
          id: a.id,
          name: a.name,
          title: a.title,
          icon: a.avatarIcon,
          accentColor: a.accentColor,
        }));
      const votesCount = supporters.length;
      const sharePercent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
      const threadVoices = state.voices
        .filter((v) => v.paradoxId === paradox.id && v.threadId === t.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const linkedCard = t.desireCardId ? cardMap.get(t.desireCardId) : undefined;

      return {
        ...t,
        supporters,
        votesCount,
        sharePercent,
        isLeading: votesCount > 0 && votesCount === maxVotes,
        isWinner: paradox.resolvedSummary?.winnerThreadId === t.id,
        voices: threadVoices,
        cardStats: linkedCard
          ? {
              gamesPlayed: linkedCard.gamesPlayed,
              winsCount: linkedCard.winsCount,
              winRatePercent: linkedCard.winRatePercent,
              nemesisCardTitle: linkedCard.nemesisCardTitle,
              analyticsInsight: linkedCard.analyticsInsight,
            }
          : undefined,
      };
    })
    .sort((a, b) => b.votesCount - a.votesCount || a.createdAt.localeCompare(b.createdAt));
}

export function buildTrainingSamples(
  state: ArenaStateStore,
  actors: ArenaActorCard[],
): NeuralTrainingSample[] {
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const paradoxMap = new Map(state.paradoxes.map((p) => [p.id, p]));

  return state.voices
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((v) => {
      const actor = actorMap.get(v.actorId);
      const paradox = paradoxMap.get(v.paradoxId);
      const competingDesires = state.threads
        .filter((t) => t.paradoxId === v.paradoxId)
        .map((t) => `${t.title} (${t.supporterActorIds.length})`);

      return {
        id: `sample-${v.id}`,
        timestamp: v.createdAt,
        actorHandle: actor?.handle ?? 'unknown_actor',
        actorName: v.actorName,
        actorCategory: actor?.category ?? 'HUMAN',
        neuronPath: paradox?.folderPath ?? 'arena.friday_sync',
        activeSessionSnapshot: v.activeNeuronSessions,
        stimulusParadox: paradox?.paradoxQuestion ?? '',
        competingDesires,
        intent: v.intent,
        chosenThread: v.threadTitle ?? null,
        voiceOutput: v.text,
        sourceMode: v.sourceMode,
      };
    });
}
