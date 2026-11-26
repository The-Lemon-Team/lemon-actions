import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ShardTelemetryService } from './flows/shard-telemetry.service';
import { CoreShardAppModule } from './shard-app.module';

export interface ShardRegistrationConfig {
  projectSlug: string;
  projectName: string;
  shardId: string;
  projectariumUrl: string;
  host: string;
  healthHost?: string;
  preferredPort?: number;
  environment: 'dev' | 'staging' | 'production';
  networkMode: 'local' | 'lan' | 'tailscale-lan' | 'tailscale-funnel';
  heartbeatIntervalMs: number;
}

export interface AllocatedShardLease {
  port: number;
  instanceId: string;
  leaseToken: string;
  projectToken?: string;
}

/**
 * Handles mandatory Port Shield registration, lease heartbeats, and release
 * for Tier C Dedicated Project Shards.
 */
export class ShardPortShieldClient {
  private readonly logger = new Logger(ShardPortShieldClient.name);
  private lease: AllocatedShardLease | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly cfg: ShardRegistrationConfig) {}

  get currentLease(): AllocatedShardLease | null {
    return this.lease;
  }

  async register(maxAttempts = 10, retryDelayMs = 2500): Promise<AllocatedShardLease> {
    const base = this.cfg.projectariumUrl.replace(/\/+$/, '');
    const healthHost = (this.cfg.healthHost || this.cfg.host).trim();

    let res: Response | null = null;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        res = await fetch(`${base}/projectarium/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectSlug: this.cfg.projectSlug,
            projectName: this.cfg.projectName,
            appName: 'lemon-core-shard',
            role: 'core-shard',
            icon: 'hub',
            host: this.cfg.host,
            ...(this.cfg.preferredPort ? { preferredPort: this.cfg.preferredPort } : {}),
            environment: this.cfg.environment,
            networkMode: this.cfg.networkMode,
            healthUrl: `http://${healthHost}:{port}/api/shard/health`,
            context: {
              shard: {
                shardId: this.cfg.shardId,
                tier: 'dedicated',
                apiBaseUrl: `http://${this.cfg.host}:{port}/api`,
                capabilities: [
                  'CONTEXT',
                  'MUTEX',
                  'OBSERVER',
                  'FSM',
                  'TIMER',
                  'CIRCUIT_BREAKER',
                  'BATCH',
                  'PROJECTION',
                ],
                customReducers: ['generic', 'space-towers'],
              },
            },
            author: 'lemon-core-shard',
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          break;
        }
        lastErr = new Error(`Projectarium registration failed (${res.status}): ${await res.text()}`);
      } catch (err) {
        lastErr = err;
      }

      if (attempt < maxAttempts) {
        this.logger.warn(
          `Waiting for Projectarium at ${base} (attempt ${attempt}/${maxAttempts})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!res || !res.ok) {
      throw lastErr instanceof Error
        ? lastErr
        : new Error(`Projectarium registration failed after ${maxAttempts} attempts`);
    }

    const data = (await res.json()) as any;
    const allocatedPort = Number(data?.allocatedApp?.port);
    const instanceId = String(data?.allocatedApp?.instanceId || '');
    const leaseToken = String(data?.allocatedApp?.leaseToken || '');

    if (!Number.isFinite(allocatedPort) || allocatedPort < 4320 || !instanceId || !leaseToken) {
      throw new Error(`Invalid Port Shield allocation returned by Projectarium: ${JSON.stringify(data?.allocatedApp)}`);
    }

    this.lease = {
      port: allocatedPort,
      instanceId,
      leaseToken,
      projectToken: data?.projectToken,
    };
    this.startHeartbeat();
    this.logger.log(
      `Registered shard "${this.cfg.shardId}" (${this.cfg.projectSlug}) on Port Shield :${allocatedPort}`,
    );
    return this.lease;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer || !this.lease) return;
    const base = this.cfg.projectariumUrl.replace(/\/+$/, '');

    this.heartbeatTimer = setInterval(() => {
      if (!this.lease) return;
      void fetch(`${base}/projectarium/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: this.lease.instanceId,
          leaseToken: this.lease.leaseToken,
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((err) => {
        this.logger.debug(`Shard heartbeat warning: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, Math.max(5000, this.cfg.heartbeatIntervalMs));
    this.heartbeatTimer.unref();
  }

  async release(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (!this.lease) return;

    const leaseToRelease = this.lease;
    this.lease = null;
    const base = this.cfg.projectariumUrl.replace(/\/+$/, '');
    try {
      await fetch(`${base}/projectarium/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: leaseToRelease.instanceId,
          leaseToken: leaseToRelease.leaseToken,
          author: 'lemon-core-shard',
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      this.logger.debug(`Shard release warning: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export async function bootstrapCoreShard() {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore missing .env
  }

  const projectSlug = (process.env.LEMON_SHARD_PROJECT_SLUG || 'lemon-watchers').trim().toLowerCase();
  const projectName = (process.env.LEMON_SHARD_PROJECT_NAME || projectSlug).trim();
  const shardId = (process.env.LEMON_SHARD_ID || `shard-${projectSlug}-01`).trim();
  const projectariumUrl = (process.env.LEMON_PROJECTARIUM_URL || 'http://127.0.0.1:3000/api').trim();
  const host = (process.env.LEMON_SHARD_HOST || 'localhost').trim();
  const healthHost = (process.env.LEMON_SHARD_HEALTH_HOST || host).trim();
  const preferredPort = process.env.LEMON_SHARD_PREFERRED_PORT
    ? Number(process.env.LEMON_SHARD_PREFERRED_PORT)
    : undefined;

  process.env.LEMON_SHARD_TIER = 'dedicated';
  process.env.LEMON_SHARD_PROJECT_SLUG = projectSlug;
  process.env.LEMON_SHARD_ID = shardId;

  const portShield = new ShardPortShieldClient({
    projectSlug,
    projectName,
    shardId,
    projectariumUrl,
    host,
    healthHost,
    preferredPort,
    environment: (process.env.LEMON_SHARD_ENV as any) || 'dev',
    networkMode: (process.env.LEMON_SHARD_NETWORK_MODE as any) || 'local',
    heartbeatIntervalMs: Number(process.env.LEMON_SHARD_HEARTBEAT_MS) || 20_000,
  });

  const lease = await portShield.register();

  const app = await NestFactory.create(CoreShardAppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  try {
    await app.listen(lease.port, '0.0.0.0');
  } catch (err) {
    await portShield.release();
    throw err;
  }

  const telemetry = app.get(ShardTelemetryService);
  await telemetry.publishLifecycleEvent('registered', {
    port: lease.port,
    instanceId: lease.instanceId,
  });

  const shutdown = async () => {
    await portShield.release();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  return { app, lease, portShield };
}
