import { BadRequestException } from '@nestjs/common';

/** Per event_type JSONB payload validators. Add an entry to support a new event type. */
type PayloadValidator = (p: Record<string, unknown>) => string | null;

const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export const EVENT_PAYLOAD_VALIDATORS: Record<string, PayloadValidator> = {
  /** { from?: string, to: string } */
  STATE_CHANGE: (p) =>
    !isStr(p.to) ? '"to" must be a non-empty string' : p.from !== undefined && typeof p.from !== 'string' ? '"from" must be a string' : null,
  /** { elapsedMs: number } */
  TIMER_TICK: (p) => (!isNum(p.elapsedMs) ? '"elapsedMs" must be a number' : null),
  /** { delta: number } */
  COUNTER_INCREMENT: (p) => (!isNum(p.delta) ? '"delta" must be a number' : null),
  /** { thresholdMs: number, elapsedMs: number } */
  SLA_BREACH: (p) => (!isNum(p.thresholdMs) || !isNum(p.elapsedMs) ? '"thresholdMs" and "elapsedMs" must be numbers' : null),
  /** { text: string } */
  NOTE: (p) => (!isStr(p.text) ? '"text" must be a non-empty string' : null),
};

export function validateEventPayload(eventType: string, payload: unknown): void {
  const validator = EVENT_PAYLOAD_VALIDATORS[eventType];
  if (!validator) {
    throw new BadRequestException(
      `Unknown eventType "${eventType}". Supported: ${Object.keys(EVENT_PAYLOAD_VALIDATORS).join(', ')}`,
    );
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BadRequestException('payload must be a JSON object');
  }
  const err = validator(payload as Record<string, unknown>);
  if (err) throw new BadRequestException(`Invalid payload for ${eventType}: ${err}`);
}
