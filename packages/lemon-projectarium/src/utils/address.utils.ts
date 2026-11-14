import { ProjectariumNetworkMode } from '../types/projectarium.types';

/**
 * Extracts hostname or IP address from a service URL string.
 */
export function extractHostFromUrl(url?: string): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.hostname || undefined;
  } catch {
    const match = trimmed.match(/^(?:[a-z]+:\/\/)?([^/:?#\s]+)/i);
    return match?.[1] || undefined;
  }
}

/**
 * Resolves explicit host or derives it from healthUrl, defaulting to 'localhost'.
 */
export function resolveAppHost(host?: string, healthUrl?: string): string {
  const explicit = host?.trim();
  if (explicit) {
    return explicit;
  }
  return extractHostFromUrl(healthUrl) || 'localhost';
}

/**
 * Builds a default healthcheck URL from host, port, and network mode.
 */
export function buildDefaultHealthUrl(
  host: string,
  port: number,
  networkMode: ProjectariumNetworkMode = 'local',
): string {
  if (networkMode === 'tailscale-funnel') {
    return port === 443 ? `https://${host}/health` : `https://${host}:${port}/health`;
  }
  return `http://${host}:${port}/health`;
}
