import { AppNetworkMode } from '../models/health-checker.models';

/** Extracts hostname or IP address from a service URL string. */
export function extractHostFromUrl(url?: string): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return new URL(trimmed).hostname || undefined;
  } catch {
    const match = trimmed.match(/^(?:[a-z]+:\/\/)?([^/:?#\s]+)/i);
    return match?.[1] || undefined;
  }
}

/** Resolves explicit host or extracts it from URL, falling back to 'localhost'. */
export function resolveAppHost(host?: string, url?: string): string {
  const explicit = host?.trim();
  if (explicit) {
    return explicit;
  }
  return extractHostFromUrl(url) || 'localhost';
}

/** Builds a default healthcheck URL from host, port, and network mode. */
export function buildAppUrl(host: string, port: number, networkMode: AppNetworkMode): string {
  if (networkMode === 'tailscale-funnel') {
    return port === 443 ? `https://${host}/health` : `https://${host}:${port}/health`;
  }
  return `http://${host}:${port}/health`;
}

/** Infers a Material icon name from application name and network mode. */
export function inferAppIcon(appName: string, networkMode: AppNetworkMode): string {
  const lower = appName.toLowerCase();
  if (networkMode === 'tailscale-funnel') return 'public';
  if (networkMode === 'tailscale-lan') return 'hub';
  if (lower.includes('gateway') || lower.includes('nginx')) return 'router';
  if (lower.includes('db') || lower.includes('postgres')) return 'database';
  if (lower.includes('cal')) return 'calendar_month';
  if (lower.includes('cms') || lower.includes('admin')) return 'admin_panel_settings';
  if (lower.includes('feed')) return 'rss_feed';
  if (lower.includes('media')) return 'video_library';
  if (lower.includes('backend') || lower.includes('api')) return 'dns';
  if (networkMode === 'lan') return 'lan';
  return 'terminal';
}
