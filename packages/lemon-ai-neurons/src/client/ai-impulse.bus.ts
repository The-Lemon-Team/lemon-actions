import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  AiEventImpulse,
  AiImpulseType,
  AiSsePacket,
  AiTaskType,
} from '../types/ai.types';

/**
 * Multiplexed reactive impulse bus for AI-neurons (Umniy Lemon).
 * Shares AI generation lifecycle events across AiHistoryNeuron, AiGenerateFlow,
 * NestJS SSE /api/ai/events bridge, and Angular UI consumers.
 */
export class AiImpulseBus {
  private readonly packetsSubject = new Subject<AiSsePacket>();
  private readonly lastImpulseSubject = new BehaviorSubject<AiEventImpulse | null>(null);

  get packets$(): Observable<AiSsePacket> {
    return this.packetsSubject.asObservable();
  }

  get impulses$(): Observable<AiEventImpulse> {
    return this.packetsSubject.pipe(map((p) => p.impulse));
  }

  get lastImpulse$(): Observable<AiEventImpulse | null> {
    return this.lastImpulseSubject.asObservable();
  }

  get lastImpulse(): AiEventImpulse | null {
    return this.lastImpulseSubject.getValue();
  }

  selectType$(...types: AiImpulseType[]): Observable<AiEventImpulse> {
    const allowed = new Set(types);
    return this.impulses$.pipe(filter((impulse) => allowed.has(impulse.type)));
  }

  selectTaskType$(taskType: AiTaskType): Observable<AiEventImpulse> {
    return this.impulses$.pipe(filter((impulse) => impulse.taskType === taskType));
  }

  get generated$(): Observable<AiEventImpulse> {
    return this.selectType$(
      'AI_TEXT_GENERATED',
      'AI_NOTE_GENERATED',
      'AI_QUICK_ADD_PARSED',
      'AI_IMAGES_GENERATED',
      'AI_IMAGE_REMIXED',
      'AI_IMAGE_ANALYZED',
    );
  }

  get failed$(): Observable<AiEventImpulse> {
    return this.selectType$('AI_TASK_FAILED');
  }

  emitPacket(impulse: AiEventImpulse): void {
    this.lastImpulseSubject.next(impulse);
    this.packetsSubject.next({
      type: impulse.type,
      impulse,
      receivedAt: Date.now(),
    });
  }

  emit(
    type: AiImpulseType,
    details: Omit<AiEventImpulse, 'type' | 'timestamp'> = {},
  ): AiEventImpulse {
    const impulse: AiEventImpulse = {
      type,
      ...details,
      timestamp: new Date().toISOString(),
    };
    this.emitPacket(impulse);
    return impulse;
  }
}
