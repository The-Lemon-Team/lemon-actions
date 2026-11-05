import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaActorCategory,
  ArenaDesireCardMatchRecord,
  ArenaParadoxField,
  ArenaPeriodSummary,
  ArenaVoiceEntry,
  ArenaVoiceIntent,
  ArenaVoiceSource,
  CombineActivitySuggestion,
  CombineHistoryCard,
} from '../models/flow.models';
import { ArenaStateStore } from './neuron-arena.helpers';

export function createVoiceRecordInStore(
  state: ArenaStateStore,
  actor: ArenaActorCard,
  paradoxId: string,
  threadId: string | null,
  threadTitle: string | null,
  intent: ArenaVoiceIntent,
  sourceMode: ArenaVoiceSource,
  text: string,
  targetId: string | null,
  audioDataUrl?: string,
): ArenaVoiceEntry {
  const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
  const activeCardSessions = state.threads
    .filter((t) => t.paradoxId === state.activeParadoxId)
    .map((t) => `session:card:${t.desireCardId ?? t.id}`);
  const sessions = [
    `session:${paradox?.folderPath ?? 'arena.friday_sync'}`,
    `session:lead_actor:${actor.handle}`,
    ...activeCardSessions,
  ];
  if (targetId && !sessions.includes(`session:card:${targetId}`)) {
    sessions.push(`session:card:${targetId}`);
  }

  return {
    id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    actorId: actor.id,
    actorName: actor.name,
    actorTitle: actor.title,
    actorIcon: actor.avatarIcon,
    actorAccent: actor.accentColor,
    paradoxId,
    threadId,
    threadTitle,
    intent,
    sourceMode,
    text,
    durationSec: Math.max(4, Math.min(28, Math.round(text.length / 14))),
    audioDataUrl,
    activeNeuronSessions: sessions,
    createdAt: new Date().toISOString(),
  };
}

export function resolvePeriodInStore(
  state: ArenaStateStore,
): { nextState: ArenaStateStore; summary: ArenaPeriodSummary } | null {
  const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
  if (!paradox) return null;

  const actorMap = new Map(state.actors.map((a) => [a.id, a]));
  const threads = state.threads
    .filter((t) => t.paradoxId === paradox.id)
    .sort((a, b) => b.supporterActorIds.length - a.supporterActorIds.length);
  if (threads.length === 0) return null;

  const totalVotes = threads.reduce((acc, t) => acc + t.supporterActorIds.length, 0);
  const winner = threads[0];
  const runnerUp = threads[1];

  const competingThreads = threads.map((t) => ({
    id: t.id,
    title: t.title,
    icon: t.icon,
    votes: t.supporterActorIds.length,
    sharePercent: totalVotes > 0 ? Math.round((t.supporterActorIds.length / totalVotes) * 100) : 0,
    proposerName: t.proposerName,
    colorTheme: t.colorTheme,
  }));

  const winnerSupporters = winner.supporterActorIds
    .map((id) => actorMap.get(id)?.name)
    .filter((n): n is string => !!n);
  const voicesInParadox = state.voices.filter((v) => v.paradoxId === paradox.id);

  const characterHighlights = state.actors
    .map((actor) => {
      const lastVoice = voicesInParadox.find((v) => v.actorId === actor.id);
      const supportedThread = threads.find((t) => t.supporterActorIds.includes(actor.id));
      if (!lastVoice && !supportedThread) return null;
      return {
        actorId: actor.id,
        actorName: actor.name,
        actorTitle: actor.title,
        actorIcon: actor.avatarIcon,
        accentColor: actor.accentColor,
        stance: lastVoice
          ? `${supportedThread ? `[Карточка «${supportedThread.title}»] ` : ''}${lastVoice.text}`
          : `Поддержал карточку «${supportedThread?.title}»`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const nowIso = new Date().toISOString();
  const participatingCardIds = new Set(threads.map((t) => t.desireCardId).filter(Boolean));
  const winnerCardId = winner.desireCardId ?? winner.id;

  const updatedDesireCards = state.desireCards.map((card) => {
    if (!participatingCardIds.has(card.id)) return card;
    const threadForCard = threads.find((t) => t.desireCardId === card.id);
    if (!threadForCard) return card;

    const isWon = threadForCard.id === winner.id;
    const opponents = threads.filter((t) => t.id !== threadForCard.id).map((t) => t.title);
    const newRecord: ArenaDesireCardMatchRecord = {
      id: `mh-${card.id}-${Date.now()}`,
      gameTitle: paradox.title,
      paradoxId: paradox.id,
      playedAt: nowIso,
      outcome: isWon ? 'WON' : 'LOST',
      votesReceived: threadForCard.supporterActorIds.length,
      totalGameVotes: totalVotes,
      winnerCardId,
      winnerCardTitle: winner.title,
      opponentTitles: opponents,
      note: isWon
        ? `Победа в периоде! Вышла вперёд (${threadForCard.supporterActorIds.length} из ${totalVotes} голосов) против: ${opponents.join(', ') || 'нет соперников'}.`
        : `Набрала ${threadForCard.supporterActorIds.length} гол., но вперёд вышла карточка «${winner.title}» (${winner.supporterActorIds.length} гол.).`,
    };
    return {
      ...card,
      matchHistory: [newRecord, ...card.matchHistory.filter((m) => m.paradoxId !== paradox.id)],
    };
  });

  const summary: ArenaPeriodSummary = {
    resolvedAt: nowIso,
    winnerThreadId: winner.id,
    winnerTitle: winner.title,
    winnerIcon: winner.icon,
    winnerColor: winner.colorTheme,
    winnerSupporters,
    totalVotes,
    totalVoices: voicesInParadox.length,
    competingThreads,
    teamSynthesis: runnerUp
      ? `На первое место вышла карточка «${winner.title}» (${competingThreads[0].sharePercent}% голосов), опередив «${runnerUp.title}».`
      : `Единогласным победителем периода стала карточка «${winner.title}».`,
    paradoxVerdict: `Команда выбирает «${winner.title}» как главное событие периода.`,
    characterHighlights,
  };

  const updatedParadoxes: ArenaParadoxField[] = state.paradoxes.map((p) =>
    p.id === paradox.id
      ? {
          ...p,
          status: 'RESOLVED' as const,
          periodLabel: `Период завершён · Победила карточка «${winner.title}»`,
          resolvedSummary: summary,
        }
      : p,
  );

  return {
    nextState: {
      ...state,
      desireCards: updatedDesireCards,
      paradoxes: updatedParadoxes,
    },
    summary,
  };
}

export function buildNewActorCard(input: {
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
  const cleanName = input.name.trim();
  const handle =
    cleanName
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || `actor_${Date.now()}`;

  const categoryLabels: Record<ArenaActorCategory, string> = {
    HUMAN: 'Простой человек',
    MYTHIC: 'Мифический персонаж',
    CYBER: 'Кибер-Персонаж',
    SAGE: 'Философ-Аналитик',
  };
  const rankPrefixes: Record<ArenaActorCategory, string> = {
    HUMAN: 'TIER S · ГЕРОЙ КОМАНДЫ',
    MYTHIC: 'MYTHIC · ЛЕГЕНДА АРХЕТИПА',
    CYBER: 'CYBER · НЕЙРО-АГЕНТ',
    SAGE: 'SAGE · ХРАНИТЕЛЬ ПАРАДОКСОВ',
  };

  const affinities = (input.affinitiesRaw || '#тимбилдинг, #versus, #нейроны')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('#') ? s : `#${s}`));

  return {
    id: `actor-${Date.now()}`,
    handle,
    flowId: `flow-actor-${Date.now()}`,
    name: cleanName,
    title: input.title.trim() || 'Участник Реактивного Поля',
    category: input.category,
    categoryLabel: categoryLabels[input.category],
    avatarIcon: input.avatarIcon || 'alexey',
    accentColor: input.accentColor || 'amber',
    rankLabel: rankPrefixes[input.category],
    quote: input.quote.trim() || '«Каждая карточка желания в поле — это импульс к сближению команды!»',
    paradoxPhilosophy:
      input.paradoxPhilosophy.trim() ||
      'Ищет баланс между личным драйвом и общей синергией команды в каждом споре.',
    favoriteDesire: input.favoriteDesire.trim() || 'Выпить пива',
    affinities,
    traits: { charisma: 92, analytical: 88, rebelVersus: 85 },
    voicePitch: input.category === 'MYTHIC' ? 0.88 : 1.04,
    voiceRate: 1.0,
    sampleVoices: {
      support: `От лица «${cleanName}» полностью поддерживаю эту карточку желания!`,
      counter: `Я предлагаю посмотреть шире и разыгрываю альтернативную карточку в Versus Mode!`,
      paradox: `Мой взгляд на этот парадокс: ${input.paradoxPhilosophy.trim() || 'истина рождается на стыке наших потоков.'}`,
    },
    isLead: true,
    voicesCount: 0,
  };
}

export function replaceBoredSuggestionInStore(
  state: ArenaStateStore,
  boredSuggestionId: string,
  replacementTitle = 'Слушать подкаст',
  replacementReason = 'Наскучило в процессе — решили заняться чем-то поважнее и глубже',
): CombineActivitySuggestion[] | null {
  const boredItem = state.combineSuggestions.find((s) => s.id === boredSuggestionId);
  if (!boredItem) return null;

  const cleanReplacementTitle = replacementTitle.trim() || 'Слушать подкаст';
  const nowIso = new Date().toISOString();

  const existingReplacement = state.combineSuggestions.find(
    (s) =>
      s.timeFieldId === boredItem.timeFieldId &&
      s.id !== boredItem.id &&
      s.title.toLowerCase().includes(cleanReplacementTitle.toLowerCase()),
  );

  let updatedSuggestions = state.combineSuggestions.map((s) => {
    if (s.id === boredItem.id) {
      return {
        ...s,
        isPinned: false,
        outcome: 'BORED_REPLACED' as const,
        unpinnedReason: replacementReason,
        replacedByTitle: existingReplacement?.title ?? cleanReplacementTitle,
      };
    }
    if (existingReplacement && s.id === existingReplacement.id) {
      return {
        ...s,
        isPinned: true,
        pinnedAt: nowIso,
        replacesTitle: boredItem.title,
        outcome: 'HIT' as const,
        outcomeNote: `Успешно заменила наскучившую карточку «${boredItem.title}» прямо во время занятия!`,
      };
    }
    return s;
  });

  if (!existingReplacement) {
    const sameActor =
      state.actors.find((a) => a.id === boredItem.actorId) ??
      state.actors.find((a) => a.id === state.leadActorId) ??
      state.actors[0];
    if (sameActor) {
      updatedSuggestions = [
        {
          id: `csug-${Date.now()}`,
          timeFieldId: boredItem.timeFieldId,
          title: cleanReplacementTitle,
          subtitle: `Новая карточка на замену наскучившему занятию «${boredItem.title}»`,
          icon: cleanReplacementTitle.toLowerCase().includes('подкаст') ? 'podcasts' : 'auto_awesome',
          colorTheme: 'violet',
          actorId: sameActor.id,
          actorName: sameActor.name,
          actorTitle: sameActor.title,
          actorIcon: sameActor.avatarIcon,
          actorAccent: sameActor.accentColor,
          pitchVoice: `Раз «${boredItem.title}» наскучило — запускаю карточку «${cleanReplacementTitle}»!`,
          isPinned: true,
          pinnedAt: nowIso,
          replacesTitle: boredItem.title,
          outcome: 'HIT',
          outcomeNote: `Пришла на смену «${boredItem.title}» и отлично зашла!`,
          createdAt: nowIso,
        },
        ...updatedSuggestions,
      ];
    }
  }

  return updatedSuggestions;
}

export function buildCombineHistoryCardFromStore(state: ArenaStateStore): CombineHistoryCard | null {
  const field =
    state.combineTimeFields.find((f) => f.id === state.activeCombineFieldId) ??
    state.combineTimeFields[0];
  if (!field) return null;

  const suggestions = state.combineSuggestions.filter((s) => s.timeFieldId === field.id);
  const pinned = suggestions.filter((s) => s.isPinned);
  const replaced = suggestions.filter((s) => !s.isPinned && s.outcome === 'BORED_REPLACED');
  if (pinned.length === 0) return null;

  const bestItem = pinned.find((p) => p.outcome === 'HIT') ?? pinned[0];
  const pinnedTitles = pinned.map((p) => `«${p.title}» (от ${p.actorName})`).join(' + ');

  return {
    id: `chist-${Date.now()}`,
    timeFieldId: field.id,
    timeFieldTitle: field.title,
    baseActivity: field.baseActivity,
    baseIcon: field.baseIcon,
    durationLabel: field.durationLabel,
    savedAt: new Date().toISOString(),
    pinnedActivities: pinned.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      actorName: p.actorName,
      actorIcon: p.actorIcon,
      colorTheme: p.colorTheme,
      outcome: p.outcome === 'PENDING' ? 'HIT' : p.outcome,
      note: p.outcomeNote || p.pitchVoice,
      replacesTitle: p.replacesTitle ?? null,
    })),
    replacedActivities: replaced.map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      actorName: r.actorName,
      reason: r.unpinnedReason || 'Наскучило в процессе',
      replacedByTitle: r.replacedByTitle || bestItem.title,
    })),
    mostSuccessfulActorName: bestItem.actorName,
    mostSuccessfulIdeaTitle: bestItem.title,
    synthesisConclusion: `В поле времени «${field.baseActivity}» закреплено ${pinned.length} занятия: ${pinnedTitles}. Самой удачливой оказалась идея «${bestItem.title}» от персонажа ${bestItem.actorName}!`,
  };
}
