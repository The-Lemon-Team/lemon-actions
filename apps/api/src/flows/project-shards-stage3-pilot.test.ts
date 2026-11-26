import assert from 'node:assert/strict';
import 'reflect-metadata';
import * as http from 'node:http';
import * as path from 'node:path';
import Module from 'node:module';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { InMemoryStackBusTransport, StackBusHub } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoreShardAppModule } from '../shard-app.module';
import { ShardPortShieldClient } from '../shard-bootstrap';
import { ShardTelemetryService } from './shard-telemetry.service';

// Fallback resolution for workspace @lemon/projectarium when npm workspace symlink is absent
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === '@lemon/projectarium') {
    return path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'lemon-projectarium', 'dist', 'index.js');
  }
  return origResolve.call(this, request, parent, isMain, options);
};

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function runStage3PilotTest() {
  console.log('=== Running Stage 3: Tier C Dedicated Shard Pilot (lemon-watchers) ===\n');

  const { ProjectariumService } = require('../projectarium/projectarium.service');
  const { ProjectariumController } = require('../projectarium/projectarium.controller');
  const { ShardAnalyticsService } = require('../projectarium/shard-analytics.service');

  const prevSlug = process.env.LEMON_SHARD_PROJECT_SLUG;
  const prevId = process.env.LEMON_SHARD_ID;
  const prevTier = process.env.LEMON_SHARD_TIER;
  const prevPublish = process.env.SHARD_METRICS_PUBLISH;

  process.env.LEMON_SHARD_PROJECT_SLUG = 'lemon-watchers';
  process.env.LEMON_SHARD_ID = 'shard-lemon-watchers-pilot';
  process.env.LEMON_SHARD_TIER = 'dedicated';
  process.env.SHARD_METRICS_PUBLISH = 'false';
  process.env.LEMON_BUS_DRIVER = 'memory';

  const noopTable = () => ({
    upsert: async () => {},
    findMany: async () => [],
    deleteMany: async () => {},
    createMany: async () => {},
    create: async () => {},
    updateMany: async () => {},
  });

  const mockPrisma: any = {
    $connect: async () => {},
    $disconnect: async () => {},
    $queryRaw: async () => [{ '?column?': 1 }],
    $transaction: async (fn: any) => fn(mockPrisma),
    flow: {
      groupBy: async () => [],
      findMany: async () => [],
      count: async () => 0,
    },
    flowSession: { count: async () => 0 },
    projectariumStand: noopTable(),
    projectariumAppRecord: noopTable(),
    projectariumTodoRecord: noopTable(),
    projectariumNoteRecord: noopTable(),
    projectariumEventRecord: noopTable(),
    projectariumAppRunRecord: noopTable(),
  };

  // Boot real CoreShardAppModule in-memory bus mode
  const nestShard = await NestFactory.create(CoreShardAppModule, { logger: ['error', 'warn'] });
  nestShard.setGlobalPrefix('api');
  nestShard.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Stub Prisma methods on the live instance so the test runs deterministically without a live PG socket
  const shardPrisma = nestShard.get(PrismaService) as any;
  shardPrisma.$queryRaw = async () => [{ '?column?': 1 }];
  shardPrisma.flow = {
    groupBy: async () => [],
    findMany: async () => [],
    count: async () => 0,
  };
  shardPrisma.flowSession = { count: async () => 0 };

  const sharedBus = nestShard.get(StackBusService);
  const shardAnalytics = new ShardAnalyticsService(sharedBus);
  await shardAnalytics.onModuleInit();

  const projectarium = new ProjectariumService(mockPrisma, sharedBus, shardAnalytics);
  const projectariumCtrl = new ProjectariumController(projectarium, {} as any);

  // 1. Start mock Main Shard Projectarium HTTP control plane
  const mainServer = http.createServer(async (req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'POST' && u.pathname === '/api/projectarium/register') {
      const body = await readJsonBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(await projectariumCtrl.register(body)));
      return;
    }
    if (req.method === 'POST' && u.pathname === '/api/projectarium/heartbeat') {
      const body = await readJsonBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(await projectariumCtrl.heartbeat(body)));
      return;
    }
    if (req.method === 'POST' && u.pathname === '/api/projectarium/release') {
      const body = await readJsonBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(await projectariumCtrl.releaseByLease(body)));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/projectarium/shards/resolve') {
      const slug = u.searchParams.get('projectSlug') || 'lemon-core';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projectariumCtrl.resolveShard(slug, `http://127.0.0.1:${mainPort}/api`)));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => mainServer.listen(0, '127.0.0.1', () => resolve()));
  const mainPort = (mainServer.address() as any).port;
  const mainApiUrl = `http://127.0.0.1:${mainPort}/api`;

  // 2. Register Dedicated Tier C Shard via Port Shield
  const portShield = new ShardPortShieldClient({
    projectSlug: 'lemon-watchers',
    projectName: 'Lemon Watchers',
    shardId: 'shard-lemon-watchers-pilot',
    projectariumUrl: mainApiUrl,
    host: '127.0.0.1',
    environment: 'dev',
    networkMode: 'local',
    heartbeatIntervalMs: 60_000,
  });

  const lease = await portShield.register();
  assert.ok(lease.port >= 4320, `Allocated port (${lease.port}) must be >= 4320`);
  console.log(`✓ 1. Port Shield allocated :${lease.port} for lemon-watchers Tier C shard`);

  await nestShard.listen(lease.port, '127.0.0.1');

  try {
    const telemetry = nestShard.get(ShardTelemetryService);
    await telemetry.publishLifecycleEvent('registered', {
      port: lease.port,
      instanceId: lease.instanceId,
    });
    await telemetry.publishMetricsSnapshot();
    await new Promise((r) => setTimeout(r, 30));

    // 4. Verify live /api/shard/health on allocated port
    const healthRes = await fetch(`http://127.0.0.1:${lease.port}/api/shard/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as any;
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.projectSlug, 'lemon-watchers');
    assert.equal(healthJson.shardId, 'shard-lemon-watchers-pilot');
    assert.equal(healthJson.tier, 'dedicated');
    console.log(`✓ 2. CoreShardAppModule serving /api/shard/health on :${lease.port} (tier: dedicated)`);

    // 5. Verify Main Shard ShardAnalyticsService received lemon.lemon-watchers.shard.metrics
    const analytics = shardAnalytics.getAnalyticsSummary('lemon-watchers');
    assert.equal(analytics.totalShards, 1);
    assert.equal(analytics.shards[0].shardId, 'shard-lemon-watchers-pilot');
    assert.equal(analytics.shards[0].snapshotHistory.length, 1);
    console.log('✓ 3. Main Shard received lemon.lemon-watchers.shard.metrics via durable consumer');

    // 6. Verify CoreCombinatorClient.resolveAndAttachShard() retargets from Main Shard -> Dedicated Shard
    CoreCombinatorClient.clearShardCache();
    const watchersSdkClient = new CoreCombinatorClient({
      baseUrl: mainApiUrl,
      projectSlug: 'lemon-watchers',
    });
    const resolution = await watchersSdkClient.resolveAndAttachShard({
      projectSlug: 'lemon-watchers',
      projectariumUrl: mainApiUrl,
      fallbackBaseUrl: mainApiUrl,
    });
    assert.equal(resolution.mode, 'dedicated-shard');
    assert.equal(watchersSdkClient.baseUrl, `http://127.0.0.1:${lease.port}/api`);

    const optMetrics = await watchersSdkClient.getOptimizationMetrics();
    assert.equal(typeof optMetrics.totalImpulsesReceived, 'number');
    console.log(`✓ 4. CoreCombinatorClient.resolveAndAttachShard() retargeted directly to :${lease.port}`);

    // 7. Release lease & verify Projectarium falls back to shared-logical
    await portShield.release();
    const afterRelease = projectariumCtrl.resolveShard('lemon-watchers', mainApiUrl);
    assert.equal(afterRelease.mode, 'shared-logical');
    assert.equal(afterRelease.apiBaseUrl, mainApiUrl);
    console.log('✓ 5. Graceful Port Shield release restored shared-logical fallback cleanly');

    console.log('\n=== Stage 3 Tier C Dedicated Shard Pilot Passed! ===');
  } finally {
    await portShield.release().catch(() => {});
    await nestShard.close();
    await shardAnalytics.onModuleDestroy();
    await sharedBus.onModuleDestroy();
    await new Promise<void>((resolve) => mainServer.close(() => resolve()));

    const prevBusDriver = process.env.LEMON_BUS_DRIVER;
    if (prevSlug === undefined) delete process.env.LEMON_SHARD_PROJECT_SLUG;
    else process.env.LEMON_SHARD_PROJECT_SLUG = prevSlug;
    if (prevId === undefined) delete process.env.LEMON_SHARD_ID;
    else process.env.LEMON_SHARD_ID = prevId;
    if (prevTier === undefined) delete process.env.LEMON_SHARD_TIER;
    else process.env.LEMON_SHARD_TIER = prevTier;
    if (prevPublish === undefined) delete process.env.SHARD_METRICS_PUBLISH;
    else process.env.SHARD_METRICS_PUBLISH = prevPublish;
    void prevBusDriver;
  }
}

runStage3PilotTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
