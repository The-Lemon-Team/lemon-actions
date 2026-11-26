import { Inject, Injectable, Optional } from '@nestjs/common';

export const PROJECTION_REDUCERS = Symbol('PROJECTION_REDUCERS');

/**
 * Pure state-transition reducer for PROJECTION flows.
 * Each project shard can register its own named reducers without modifying core FlowsService.
 */
export interface ProjectionReducer<TState = Record<string, any>> {
  readonly key: string;
  readonly aliases?: string[];
  /** Optional predicate for legacy configs that omit an explicit reducerKey. */
  matchesConfig?(config: Record<string, any>, eventType: string): boolean;
  reduce(
    prevState: TState,
    eventType: string,
    payload: Record<string, any>,
    config: Record<string, any>,
    at: Date,
  ): TState;
}

/**
 * Built-in universal key-value / counter reducer used when no domain-specific reducer matches.
 */
export class GenericProjectionReducer implements ProjectionReducer {
  readonly key = 'generic';
  readonly aliases = ['GENERIC', 'KV_COUNTER'];

  reduce(
    prevState: Record<string, any>,
    eventType: string,
    payload: Record<string, any>,
    _config: Record<string, any>,
    at: Date,
  ): Record<string, any> {
    const isoAt = at.toISOString();
    const counters: Record<string, number> = { ...(prevState.counters ?? {}) };
    const kv: Record<string, any> = { ...(prevState.kv ?? {}) };

    if (eventType === 'COUNTER_INCREMENT' || eventType === 'METRIC') {
      const key = String(payload.counter || payload.metric || 'default');
      const delta = Number(payload.delta ?? payload.value ?? 1);
      if (Number.isFinite(delta)) {
        counters[key] = (counters[key] ?? 0) + delta;
      }
    } else if (eventType === 'SET_STATE' && payload.key) {
      kv[String(payload.key)] = payload.value;
    } else if (eventType === 'PATCH_STATE' && payload.patch && typeof payload.patch === 'object') {
      Object.assign(kv, payload.patch);
    }

    return {
      ...prevState,
      counters,
      kv,
      lastEventType: eventType,
      lastUpdatedAt: isoAt,
      eventsCount: (prevState.eventsCount || 0) + 1,
      lastPayload: payload,
    };
  }
}

@Injectable()
export class ProjectionReducerRegistry {
  private readonly byKey = new Map<string, ProjectionReducer>();
  private readonly orderedReducers: ProjectionReducer[] = [];
  private readonly fallback = new GenericProjectionReducer();

  constructor(@Optional() @Inject(PROJECTION_REDUCERS) reducers: ProjectionReducer[] = []) {
    this.register(this.fallback);
    for (const r of reducers) {
      this.register(r);
    }
  }

  register(reducer: ProjectionReducer): void {
    this.byKey.set(reducer.key, reducer);
    if (Array.isArray(reducer.aliases)) {
      for (const alias of reducer.aliases) {
        this.byKey.set(alias, reducer);
      }
    }
    if (!this.orderedReducers.includes(reducer)) {
      this.orderedReducers.push(reducer);
    }
  }

  resolve(config: Record<string, any>, eventType: string): ProjectionReducer {
    const explicitKey = typeof config.reducerKey === 'string'
      ? config.reducerKey
      : typeof config.reducer === 'string'
        ? config.reducer
        : undefined;

    if (explicitKey && this.byKey.has(explicitKey)) {
      return this.byKey.get(explicitKey)!;
    }

    for (const reducer of this.orderedReducers) {
      if (reducer !== this.fallback && reducer.matchesConfig?.(config, eventType)) {
        return reducer;
      }
    }

    return this.fallback;
  }
}
