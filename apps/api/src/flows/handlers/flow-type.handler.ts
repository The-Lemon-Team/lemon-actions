import { BadRequestException } from '@nestjs/common';
import { FlowType } from '@prisma/client';

/**
 * Strategy interface: one handler per FlowType. Register a new handler in
 * FlowsModule (FLOW_TYPE_HANDLERS) to support a new FlowType; the service/orchestrator
 * never branches on type (Open/Closed).
 */
export interface FlowTypeHandler {
  readonly type: FlowType;
  /** Throws BadRequestException when the config is invalid for this type. */
  validateConfig(config: unknown): void;
}

export const FLOW_TYPE_HANDLERS = Symbol('FLOW_TYPE_HANDLERS');

/** Config is optional and free-form unless a handler says otherwise. */
export abstract class BaseFlowTypeHandler implements FlowTypeHandler {
  abstract readonly type: FlowType;
  validateConfig(_config: unknown): void {}
}

export class ContextFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.CONTEXT;
}
export class MutexFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.MUTEX;
}
export class ObserverFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.OBSERVER;
}

export class TimerFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.TIMER;
  validateConfig(config: unknown): void {
    if (config == null) return;
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('TIMER config must be an object');
    }
  }
}

export class FsmFlowHandler extends BaseFlowTypeHandler {
  readonly type = FlowType.FSM;
  validateConfig(config: unknown): void {
    if (config == null) return;
    const bad = (m: string) => new BadRequestException(`Invalid FSM config: ${m}`);
    const c = config as any;
    if (typeof c !== 'object' || typeof c.initial !== 'string') throw bad('"initial" must be a string');
    if (!c.states || typeof c.states !== 'object') throw bad('"states" must be an object');
    if (!(c.initial in c.states)) throw bad(`initial state "${c.initial}" is not defined in states`);
    for (const [key, s] of Object.entries<any>(c.states)) {
      if (typeof s?.label !== 'string' || typeof s?.badgeColor !== 'string') {
        throw bad(`state "${key}" requires label and badgeColor`);
      }
      if (!Array.isArray(s.transitions)) throw bad(`state "${key}".transitions must be an array`);
      for (const t of s.transitions) {
        if (typeof t?.event !== 'string' || typeof t?.target !== 'string') {
          throw bad(`state "${key}" has a transition without event/target`);
        }
        if (!(t.target in c.states)) throw bad(`transition target "${t.target}" is not a defined state`);
        if (typeof t.ui?.buttonLabel !== 'string' || typeof t.ui?.intent !== 'string') {
          throw bad(`transition "${t.event}" requires ui.buttonLabel and ui.intent`);
        }
      }
    }
  }
}

export const DEFAULT_FLOW_TYPE_HANDLERS: FlowTypeHandler[] = [
  new ContextFlowHandler(),
  new MutexFlowHandler(),
  new ObserverFlowHandler(),
  new FsmFlowHandler(),
  new TimerFlowHandler(),
];
