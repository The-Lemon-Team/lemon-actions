import {
  ArenaActorCard,
  ArenaDesireCard,
  Flow,
} from '../models/flow.models';
import { ArenaStateStore, createEmptyArenaStore } from './neuron-arena.helpers';

const STORAGE_KEY_PREFIX = 'lemon-actions:neuron-arena:v5:';

export const arenaStorageKey = (profileId: string): string => `${STORAGE_KEY_PREFIX}${profileId}`;

export function loadCachedArenaState(profileId: string): ArenaStateStore {
  try {
    const raw = localStorage.getItem(arenaStorageKey(profileId));
    if (raw) {
      const parsed = JSON.parse(raw) as ArenaStateStore;
      if (parsed && Array.isArray(parsed.actors) && parsed.actors.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return createEmptyArenaStore();
}

export function saveCachedArenaState(profileId: string, state: ArenaStateStore): void {
  try {
    localStorage.setItem(arenaStorageKey(profileId), JSON.stringify(state));
  } catch {}
}

export function clearCachedArenaState(profileId: string): void {
  try {
    localStorage.removeItem(arenaStorageKey(profileId));
  } catch {}
}

/** Собирает store арены из flows scope `arena.*` (актёры, карточки желаний, состояние игры). */
export function parseArenaFlows(flows: Flow[]): { store: ArenaStateStore | null; stateFlowId: string | null } {
  const actors: ArenaActorCard[] = [];
  const desireCards: ArenaDesireCard[] = [];
  let stateFlowId: string | null = null;
  let cfgState: Record<string, any> | null = null;

  for (const f of flows) {
    const cfg = (f.config ?? {}) as Record<string, any>;
    if (cfg['actor']) {
      actors.push({ ...cfg['actor'], flowId: f.id });
    } else if (cfg['desireCard'] && Array.isArray(cfg['desireCard'].matchHistory)) {
      desireCards.push({ ...cfg['desireCard'], flowId: f.id });
    } else if (cfg['arenaState']) {
      stateFlowId = f.id;
      cfgState = cfg['arenaState'];
    }
  }

  if (actors.length === 0) return { store: null, stateFlowId };

  return {
    stateFlowId,
    store: {
      actors,
      desireCards,
      leadActorId: cfgState?.['leadActorId'] ?? 'actor-alexey',
      paradoxes: cfgState?.['paradoxes'] ?? [],
      activeParadoxId: cfgState?.['activeParadoxId'] ?? 'paradox-friday-afterwork',
      threads: cfgState?.['threads'] ?? [],
      voices: cfgState?.['voices'] ?? [],
      combineTimeFields: cfgState?.['combineTimeFields'] ?? [],
      activeCombineFieldId: cfgState?.['activeCombineFieldId'] ?? 'timefield-cooking-evening',
      combineSuggestions: cfgState?.['combineSuggestions'] ?? [],
      combineHistoryCards: cfgState?.['combineHistoryCards'] ?? [],
    },
  };
}

/** Часть store, которая сохраняется в flow `Neuron Arena State`. */
export function buildArenaStatePayload(next: ArenaStateStore): Record<string, unknown> {
  return {
    leadActorId: next.leadActorId,
    activeParadoxId: next.activeParadoxId,
    activeCombineFieldId: next.activeCombineFieldId,
    paradoxes: next.paradoxes,
    threads: next.threads,
    voices: next.voices,
    combineTimeFields: next.combineTimeFields,
    combineSuggestions: next.combineSuggestions,
    combineHistoryCards: next.combineHistoryCards,
  };
}
