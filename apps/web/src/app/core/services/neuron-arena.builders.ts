import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaDesireCard,
  ArenaDesireThread,
  ArenaParadoxField,
  ArenaVoiceIntent,
  CombineActivitySuggestion,
  CombineTimeField,
} from '../models/flow.models';
import { ArenaStateStore } from './neuron-arena.helpers';

const parseTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('#') ? s : `#${s}`));

export function buildThreadFromCard(
  card: ArenaDesireCard,
  actor: ArenaActorCard,
  paradoxId: string,
  sharePercent = 0,
  isLeading = false,
): ArenaDesireThread {
  return {
    id: `thread-${Date.now()}`,
    desireCardId: card.id,
    flowId: card.flowId,
    paradoxId,
    title: card.title,
    subtitle: card.description,
    icon: card.icon,
    colorTheme: card.colorTheme,
    proposerActorId: actor.id,
    proposerName: actor.name,
    proposerIcon: actor.avatarIcon,
    supporterActorIds: [actor.id],
    supporters: [],
    votesCount: 1,
    sharePercent,
    isLeading,
    tags: [...card.tags, `#${actor.handle}`],
    voices: [],
    createdAt: new Date().toISOString(),
  };
}

export function buildDesireCard(
  input: {
    title: string;
    category: string;
    description: string;
    icon: string;
    colorTheme: ArenaAccentColor;
    tagsRaw?: string;
  },
  actor: ArenaActorCard | undefined,
): ArenaDesireCard {
  const cleanTitle = input.title.trim();
  const cardId = `card-${Date.now()}`;
  return {
    id: cardId,
    flowId: `flow-${cardId}`,
    title: cleanTitle,
    category: input.category.trim() || 'Командная Хотелка',
    description:
      input.description.trim() ||
      `Карточка желания «${cleanTitle}», добавленная в колоду персонажем ${actor?.name ?? 'Алексей'}.`,
    icon: input.icon || 'auto_awesome',
    colorTheme: input.colorTheme || actor?.accentColor || 'amber',
    tags: parseTags(input.tagsRaw || '#хотелка, #тимбилдинг, #versus'),
    createdByActorName: actor?.name ?? 'Алексей (в халате)',
    gamesPlayed: 0,
    winsCount: 0,
    lossesCount: 0,
    winRatePercent: 0,
    totalHistoricalVotes: 0,
    nemesisCardTitle: null,
    nemesisScore: null,
    analyticsInsight: 'Новая карточка желания в колоде — готова к проверке в Versus-полях!',
    matchHistory: [],
    isInCurrentField: false,
  };
}

export function buildParadoxField(input: {
  title: string;
  occasionTag: string;
  contextStory: string;
  paradoxQuestion: string;
}): ArenaParadoxField {
  return {
    id: `paradox-${Date.now()}`,
    folderPath: `arena.game_${Date.now().toString().slice(-4)}`,
    title: input.title.trim(),
    occasionTag: input.occasionTag.trim() || 'Тимбилдинг · Versus Mode',
    contextStory: input.contextStory.trim(),
    paradoxQuestion: input.paradoxQuestion.trim(),
    status: 'ACTIVE_BATTLE',
    periodLabel: 'Период #1 · Сбор карточек желаний в поле',
    resolvedSummary: null,
  };
}

export function buildCombineSuggestion(
  input: { title: string; subtitle?: string; icon?: string; pitchVoice?: string; pinImmediately?: boolean },
  actor: ArenaActorCard,
  field: CombineTimeField,
): CombineActivitySuggestion {
  const cleanTitle = input.title.trim();
  const nowIso = new Date().toISOString();
  const pinned = input.pinImmediately !== false;
  return {
    id: `csug-${Date.now()}`,
    timeFieldId: field.id,
    title: cleanTitle,
    subtitle:
      input.subtitle?.trim() ||
      `Особая идея от персонажа ${actor.name} для поля времени «${field.baseActivity}»`,
    icon: input.icon || actor.avatarIcon || 'bolt',
    colorTheme: actor.accentColor,
    actorId: actor.id,
    actorName: actor.name,
    actorTitle: actor.title,
    actorIcon: actor.avatarIcon,
    actorAccent: actor.accentColor,
    pitchVoice:
      input.pitchVoice?.trim() ||
      `Подключаюсь к «${field.baseActivity}» со своей идеей — давайте параллельно закрепим «${cleanTitle}»!`,
    isPinned: pinned,
    pinnedAt: pinned ? nowIso : null,
    outcome: 'HIT',
    createdAt: nowIso,
  };
}

export function buildCombineTimeField(input: {
  title: string;
  baseActivity: string;
  baseIcon: string;
  durationLabel: string;
  contextDescription?: string;
}): CombineTimeField {
  const cleanBase = input.baseActivity.trim();
  return {
    id: `timefield-${Date.now()}`,
    folderPath: `arena.combine.slot_${Date.now().toString().slice(-4)}`,
    title: input.title.trim() || `Поле Времени: ${cleanBase}`,
    baseActivity: cleanBase,
    baseIcon: input.baseIcon || 'schedule',
    durationLabel: input.durationLabel.trim() || '1 час · Активное окно',
    contextDescription:
      input.contextDescription?.trim() || `Свободное окно времени для занятия «${cleanBase}».`,
    status: 'ACTIVE_COMBINE',
  };
}

export function buildPersonaDraft(
  state: ArenaStateStore,
  intent: ArenaVoiceIntent,
  targetThreadId?: string | null,
): string {
  const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
  const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId) ?? state.paradoxes[0];
  if (!actor || !paradox) return '';

  const threads = state.threads
    .filter((t) => t.paradoxId === paradox.id)
    .sort((a, b) => b.supporterActorIds.length - a.supporterActorIds.length);

  const targetThread =
    (targetThreadId ? threads.find((t) => t.id === targetThreadId) : null) ?? threads[0];
  const secondThread = threads[1];

  if (intent === 'SUPPORT' && targetThread) {
    return `[${actor.name}]: Вижу в поле карточку желания «${targetThread.title}» и подтверждаю её своим голосом! ${actor.sampleVoices.support}`;
  }
  if (intent === 'COUNTER_PROPOSE') {
    return `[${actor.name}]: Пока вы спорите вокруг «${targetThread?.title ?? 'текущих вариантов'}», я достаю из колоды карточку «${actor.favoriteDesire}»! ${actor.sampleVoices.counter}`;
  }
  if (intent === 'ANALYTICS') {
    const t1 = targetThread ? `«${targetThread.title}» (${targetThread.supporterActorIds.length} гол.)` : 'нет лидера';
    const t2 = secondThread ? ` против «${secondThread.title}» (${secondThread.supporterActorIds.length} гол.)` : '';
    return `Аналитика карточек от «${actor.name}»: В поле ${paradox.folderPath} сошлись ${t1}${t2}. По истории нашей колоды «Выпить пива» чаще инициирует спор, но «Посмотреть кино» чаще забирает победу на финише!`;
  }
  return `${actor.sampleVoices.paradox} (Мнение персонажа «${actor.name}» по поводу: «${paradox.title}»)`;
}
