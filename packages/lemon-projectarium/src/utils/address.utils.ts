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

/**
 * Resolves a normalized machine identifier and human-readable display name.
 */
export function resolveMachineIdentity(params: {
  machineId?: string;
  machineName?: string;
  networkMode?: ProjectariumNetworkMode;
  host?: string;
}): { machineId: string; machineName: string } {
  const explicitId = params.machineId?.trim();
  const explicitName = params.machineName?.trim();
  if (explicitId) {
    return {
      machineId: explicitId.toLowerCase(),
      machineName: explicitName || explicitId,
    };
  }
  if (explicitName) {
    const normalized = explicitName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return {
      machineId: normalized || 'local-default',
      machineName: explicitName,
    };
  }

  const mode = params.networkMode || 'local';
  const host = (params.host || 'localhost').trim();
  if (mode === 'local' || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return { machineId: 'local-default', machineName: 'Local Machine' };
  }

  return {
    machineId: `host-${host.toLowerCase()}`,
    machineName: host,
  };
}
