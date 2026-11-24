import { StackBusPublishInput } from '../types/stack-bus.types';

export const STACK_BUS_PREFIX = 'lemon';
export const DEFAULT_PROJECT_SLUG = 'lemon-core';

export const WELL_KNOWN_TOPICS = {
  ALL: 'lemon.>',
  MEDIA_ALL: 'lemon.media-hub.>',
  MEDIA_CREATED: 'lemon.media-hub.media.created',
  MEDIA_READY: 'lemon.media-hub.media.ready',
  MEDIA_DELETED: 'lemon.media-hub.media.deleted',
  PROJECTARIUM_ALL: 'lemon.projectarium.>',
  PROJECTARIUM_STAND_CREATED: 'lemon.projectarium.stand.created',
  PROJECTARIUM_APP_REGISTERED: 'lemon.projectarium.app.registered',
  PROJECTARIUM_APP_RELEASED: 'lemon.projectarium.app.released',
  PROJECTARIUM_APP_EVICTED: 'lemon.projectarium.app.evicted',
  PROJECTARIUM_TODO_CHANGED: 'lemon.projectarium.todo.changed',
  PROJECTARIUM_NOTE_CHANGED: 'lemon.projectarium.note.changed',
  PROJECTARIUM_CHRONICLE_ADDED: 'lemon.projectarium.chronicle.added',
  FLOWS_ALL: 'lemon.*.flow.>',
} as const;

export function sanitizeTopicToken(raw: string | undefined, fallback = 'default'): string {
  const cleaned = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function buildStackTopic(
  projectSlug: string,
  domain: string,
  event: string,
): string {
  return [
    STACK_BUS_PREFIX,
    sanitizeTopicToken(projectSlug, DEFAULT_PROJECT_SLUG),
    sanitizeTopicToken(domain, 'domain'),
    sanitizeTopicToken(event, 'event'),
  ].join('.');
}

export interface ParsedStackTopic {
  valid: boolean;
  prefix: string;
  projectSlug: string;
  domain: string;
  event: string;
  tokens: string[];
}

export function parseStackTopic(topic: string): ParsedStackTopic {
  const tokens = (topic ?? '')
    .trim()
    .toLowerCase()
    .split('.')
    .filter(Boolean);

  if (tokens.length >= 4 && tokens[0] === STACK_BUS_PREFIX) {
    return {
      valid: true,
      prefix: tokens[0],
      projectSlug: tokens[1],
      domain: tokens[2],
      event: tokens.slice(3).join('.'),
      tokens,
    };
  }

  return {
    valid: false,
    prefix: tokens[0] || STACK_BUS_PREFIX,
    projectSlug: tokens[1] || DEFAULT_PROJECT_SLUG,
    domain: tokens[2] || 'custom',
    event: tokens.slice(3).join('.') || tokens[tokens.length - 1] || 'event',
    tokens,
  };
}

/**
 * Resolves full `lemon.<projectSlug>.<domain>.<event>` metadata from partial input.
 */
export function resolvePublishAddress(input: StackBusPublishInput<any>): {
  topic: string;
  projectSlug: string;
  domain: string;
  event: string;
} {
  const explicitTopic = input.topic?.trim().toLowerCase();
  if (explicitTopic) {
    const tokens = explicitTopic.split('.').filter(Boolean);
    if (tokens[0] === STACK_BUS_PREFIX && tokens.length >= 4) {
      const projectSlug = sanitizeTopicToken(input.projectSlug ?? tokens[1], DEFAULT_PROJECT_SLUG);
      const domain = sanitizeTopicToken(input.domain ?? tokens[2], 'domain');
      const event = tokens
        .slice(3)
        .map((t) => sanitizeTopicToken(t, 'event'))
        .join('.');
      return {
        topic: `${STACK_BUS_PREFIX}.${projectSlug}.${domain}.${event}`,
        projectSlug,
        domain,
        event,
      };
    }
    const projectSlug = sanitizeTopicToken(input.projectSlug, DEFAULT_PROJECT_SLUG);
    if (tokens.length >= 2) {
      const domain = sanitizeTopicToken(input.domain ?? tokens[0], 'domain');
      const event = tokens
        .slice(1)
        .map((t) => sanitizeTopicToken(t, 'event'))
        .join('.');
      return {
        topic: `${STACK_BUS_PREFIX}.${projectSlug}.${domain}.${event}`,
        projectSlug,
        domain,
        event,
      };
    }
    const domain = sanitizeTopicToken(input.domain, 'events');
    const event = sanitizeTopicToken(tokens[0] ?? input.event, 'event');
    return {
      topic: `${STACK_BUS_PREFIX}.${projectSlug}.${domain}.${event}`,
      projectSlug,
      domain,
      event,
    };
  }

  const projectSlug = sanitizeTopicToken(input.projectSlug, DEFAULT_PROJECT_SLUG);
  const domain = sanitizeTopicToken(input.domain, 'events');
  const event = sanitizeTopicToken(input.event, 'event');
  return {
    topic: buildStackTopic(projectSlug, domain, event),
    projectSlug,
    domain,
    event,
  };
}

/**
 * Matches NATS-style subject wildcards:
 * - `*` matches exactly one token
 * - `>` matches one or more remaining tokens (must be last token)
 * - exact token comparison otherwise (case-insensitive)
 */
export function matchesTopicPattern(pattern: string, topic: string): boolean {
  const p = (pattern ?? '').trim().toLowerCase();
  const t = (topic ?? '').trim().toLowerCase();
  if (!p || !t) return false;
  if (p === '>' || p === t) return true;

  const pTokens = p.split('.').filter(Boolean);
  const tTokens = t.split('.').filter(Boolean);

  for (let i = 0; i < pTokens.length; i++) {
    const pt = pTokens[i];
    if (pt === '>') {
      return i < tTokens.length;
    }
    if (i >= tTokens.length) {
      return false;
    }
    if (pt !== '*' && pt !== tTokens[i]) {
      return false;
    }
  }

  return pTokens.length === tTokens.length;
}

export function matchesAnyTopicPattern(
  patterns: string | string[] | undefined,
  topic: string,
): boolean {
  if (!patterns) return true;
  const list = Array.isArray(patterns) ? patterns : [patterns];
  if (list.length === 0) return true;
  return list.some((pattern) => matchesTopicPattern(pattern, topic));
}

export function buildProjectWildcard(projectSlug: string): string {
  return `${STACK_BUS_PREFIX}.${sanitizeTopicToken(projectSlug, DEFAULT_PROJECT_SLUG)}.>`;
}
