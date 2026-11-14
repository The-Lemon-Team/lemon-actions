import * as net from 'net';
import { ProjectariumNetworkMode } from '../types/projectarium.types';
import { buildDefaultHealthUrl, resolveAppHost } from './address.utils';

export interface HealthProbeResult {
  ok: boolean;
  latencyMs: number;
  protocol: 'http' | 'tcp';
  target: string;
  statusCode?: number;
  error?: string;
}

export interface HealthProbeOptions {
  timeoutMs?: number;
  dockerHostAlias?: string;
}

export interface ProbeTargetApp {
  host?: string;
  port: number;
  healthUrl?: string;
  networkMode?: ProjectariumNetworkMode;
}

const DEFAULT_PROBE_TIMEOUT_MS = 2500;

function rewriteLocalHost(hostname: string, dockerHostAlias?: string): string {
  const alias = dockerHostAlias?.trim();
  if (!alias) {
    return hostname;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return alias;
  }
  return hostname;
}

function rewriteHttpUrlHost(rawUrl: string, dockerHostAlias?: string): string {
  const alias = dockerHostAlias?.trim();
  if (!alias) {
    return rawUrl;
  }
  try {
    const parsed = new URL(rawUrl);
    parsed.hostname = rewriteLocalHost(parsed.hostname, alias);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function resolveTcpEndpoint(
  app: ProbeTargetApp,
  dockerHostAlias?: string,
): { host: string; port: number } {
  const rawUrl = app.healthUrl?.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const parsedPort = parsed.port ? Number(parsed.port) : app.port;
      return {
        host: rewriteLocalHost(parsed.hostname || resolveAppHost(app.host, rawUrl), dockerHostAlias),
        port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : app.port,
      };
    } catch {
      // Fallback to app.host & app.port
    }
  }

  return {
    host: rewriteLocalHost(resolveAppHost(app.host, app.healthUrl), dockerHostAlias),
    port: app.port,
  };
}

/**
 * Checks whether an HTTP(S) endpoint responds with 2xx/3xx and does not report a down dependency.
 */
export async function probeHttpHealth(
  url: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<HealthProbeResult> {
  const result = await executeHttpProbe(url, timeoutMs);
  if (!result.ok && !result.statusCode) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost') {
        parsed.hostname = '127.0.0.1';
        const ipv4Result = await executeHttpProbe(parsed.toString(), timeoutMs);
        if (ipv4Result.ok || ipv4Result.statusCode) {
          return { ...ipv4Result, target: url };
        }
      }
    } catch {
      // Keep original result
    }
  }
  return result;
}

async function executeHttpProbe(url: string, timeoutMs: number): Promise<HealthProbeResult> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json, text/plain, text/html, */*' },
    });

    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const isHttpOk = response.status >= 200 && response.status < 400;

    if (!isHttpOk) {
      return {
        ok: false,
        latencyMs,
        protocol: 'http',
        target: url,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = (await response.json()) as Record<string, unknown> | null;
        if (body && typeof body === 'object') {
          const statusValue = typeof body['status'] === 'string' ? body['status'].toLowerCase() : '';
          const dbValue = typeof body['db'] === 'string' ? body['db'].toLowerCase() : '';
          if (dbValue === 'down' || statusValue === 'down' || body['ok'] === false) {
            return {
              ok: false,
              latencyMs,
              protocol: 'http',
              target: url,
              statusCode: response.status,
              error: dbValue === 'down' ? 'Dependency db is down' : 'Health payload reported down',
            };
          }
        }
      } catch {
        // Ignore malformed JSON on endpoints returning 2xx
      }
    }

    return {
      ok: true,
      latencyMs,
      protocol: 'http',
      target: url,
      statusCode: response.status,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    return {
      ok: false,
      latencyMs,
      protocol: 'http',
      target: url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Checks whether a TCP host:port accepts connections (used for PostgreSQL and raw TCP services).
 */
export async function probeTcpHealth(
  host: string,
  port: number,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<HealthProbeResult> {
  const result = await executeTcpProbe(host, port, timeoutMs);
  if (!result.ok && host === 'localhost') {
    const ipv4Result = await executeTcpProbe('127.0.0.1', port, timeoutMs);
    if (ipv4Result.ok) {
      return { ...ipv4Result, target: `${host}:${port}` };
    }
  }
  return result;
}

function executeTcpProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<HealthProbeResult> {
  const target = `${host}:${port}`;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return Promise.resolve({
      ok: false,
      latencyMs: 1,
      protocol: 'tcp',
      target,
      error: `Invalid port: ${port}`,
    });
  }

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let settled = false;

    const finish = (result: Omit<HealthProbeResult, 'latencyMs' | 'protocol' | 'target'>) => {
      if (settled) return;
      settled = true;
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
      socket.destroy();
      resolve({
        ...result,
        latencyMs,
        protocol: 'tcp',
        target,
      });
    };

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () => finish({ ok: false, error: `TCP timeout after ${timeoutMs}ms` }));
    socket.once('error', (err) => finish({ ok: false, error: err.message }));
  });
}

/**
 * Performs an active HTTP(S) or TCP health probe for a Projectarium app.
 */
export async function probeAppHealth(
  app: ProbeTargetApp,
  options: HealthProbeOptions = {},
): Promise<HealthProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const rawHealthUrl = app.healthUrl?.trim();

  if (rawHealthUrl && /^https?:\/\//i.test(rawHealthUrl)) {
    return probeHttpHealth(rewriteHttpUrlHost(rawHealthUrl, options.dockerHostAlias), timeoutMs);
  }

  if (!rawHealthUrl) {
    const host = rewriteLocalHost(resolveAppHost(app.host), options.dockerHostAlias);
    const defaultUrl = buildDefaultHealthUrl(host, app.port, app.networkMode || 'local');
    return probeHttpHealth(defaultUrl, timeoutMs);
  }

  const endpoint = resolveTcpEndpoint(app, options.dockerHostAlias);
  return probeTcpHealth(endpoint.host, endpoint.port, timeoutMs);
}
