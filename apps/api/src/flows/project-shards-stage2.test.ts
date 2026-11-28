import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import Module from 'node:module';
import { FlowStatus, FlowType } from '@prisma/client';
import { CoreCombinatorClient } from '@lemon/core-combinator-sdk';
import { InMemoryStackBusTransport, StackBusHub } from '@lemon/stack-bus';
import { StackBusService } from '../bus/stack-bus.service';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';
import { LemonBusRelayService } from './lemon-bus-relay.service';
import { ShardTelemetryService } from './shard-telemetry.service';
import { ShardController } from './shard.controller';

// Fallback resolution for workspace @lemon/projectarium when npm workspace symlink is absent
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === '@lemon/projectarium') {
    return path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'lemon-projectarium', 'dist', 'index.js');
  }
  return origResolve.call(this, request, parent, isMain, options);
};

async function runStage2Tests() {
  console.log('=== Running Stage 2: Project Shards Discovery, Health & Analytics Tests ===\n');

  const { ProjectariumService } = require('../projectarium/projectarium.service');
  const { ProjectariumController } = require('../projectarium/projectarium.controller');
  const { ShardAnalyticsService } = require('../projectarium/shard-analytics.service');

  const prevSlug = process.env.LEMON_SHARD_PROJECT_SLUG;
  const prevId = process.env.LEMON_SHARD_ID;
  const prevTier = process.env.LEMON_SHARD_TIER;
  const prevPublish = process.env.SHARD_METRICS_PUBLISH;

  process.env.LEMON_SHARD_PROJECT_SLUG = 'lemon-space';
  process.env.LEMON_SHARD_ID = 'shard-space-01';
  process.env.LEMON_SHARD_TIER = 'dedicated';
  process.env.SHARD_METRICS_PUBLISH = 'false';

  try {
    // 1. Setup In-Memory StackBus + Flows + ShardTelemetryService
    const transport = new InMemoryStackBusTransport();
    await transport.connect();
    const stackBus = new StackBusService(new StackBusHub(transport));

    const flowsMap = new Map<string, any>();
    let seq = 0;
    const mockRepo: any = {
      transaction: async (fn: any) => fn(mockRepo),
      findById: async (id: string) => flowsMap.get(id) ?? null,
      findByIdLite: async (id: string) => flowsMap.get(id) ?? null,
      findMany: async (q: any = {}) => {
        let list = Array.from(flowsMap.values());
        if (q.status) list = list.filter((f) => f.status === q.status);
        if (q.type) list = list.filter((f) => f.type === q.type);
        return list;
      },
      findSchedulableFlows: async () => [],
      findFlowsByFolder: async () => [],
      findRunningExclusive: async () => [],
      getFolderMeta: async () => null,
      countByStatus: async () => {
        const counts = { INACTIVE: 0, ACTIVE: 0, PAUSED: 0, PROCESSING: 0 };
        for (const f of flowsMap.values()) counts[f.status as FlowStatus]++;
        return counts;
      },
      create: async (data: any, tagNames: string[]) => {
        const id = `flow-${++seq}`;
        const row = {
          id,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          status: FlowStatus.INACTIVE,
          isExclusive: data.isExclusive ?? false,
          folderId: null,
          profileId: null,
          projectSlug: data.projectSlug ?? 'lemon-space',
          tags: tagNames.map((n, i) => ({ tag: { id: `t-${i}`, name: n } })),
          config: data.config ?? null,
          orchestratorRules: data.orchestratorRules ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        flowsMap.set(id, row);
        return row;
      },
      updateLite: async (id: string, data: any) => {
        const cur = flowsMap.get(id);
        const next = { ...cur, ...(data.config !== undefined ? { config: data.config } : {}), updatedAt: new Date() };
        flowsMap.set(id, next);
        return next;
      },
      setStatus: async (id: string, status: FlowStatus) => {
        const cur = flowsMap.get(id);
        const next = { ...cur, status, updatedAt: new Date() };
        flowsMap.set(id, next);
        return next;
      },
      hasOpenSession: async () => false,
      openSession: async (flowId: string) => ({ id: `s-${flowId}`, flowId, endedAt: null }),
      closeSessions: async () => {},
      findOpenSessionsInFolder: async () => [],
      touchFlow: async () => {},
      createFlowEvent: async (data: any) => ({ id: `ev-${Date.now()}`, createdAt: new Date(), ...data }),
    };

    const noopTable = () => ({
      upsert: async () => {},
      findMany: async () => [],
      deleteMany: async () => {},
      createMany: async () => {},
      create: async () => {},
      updateMany: async () => {},
    });

    const mockPrisma: any = {
      $queryRaw: async () => [{ '?column?': 1 }],
      flowSession: { count: async () => 1 },
      flow: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockPrisma),
      projectariumStand: noopTable(),
      projectariumAppRecord: noopTable(),
      projectariumTodoRecord: noopTable(),
      projectariumNoteRecord: noopTable(),
      projectariumEventRecord: noopTable(),
      projectariumAppRunRecord: noopTable(),
    };

    const eventBus = new FlowsEventBusService();
    const flowsService = new FlowsService(mockRepo, new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS), eventBus);
    const scheduler = new FlowSchedulerService(mockRepo, flowsService);
    const relay = new LemonBusRelayService(eventBus, stackBus, flowsService);
    relay.onModuleInit();

    const telemetry = new ShardTelemetryService(flowsService, scheduler, eventBus, mockPrisma, stackBus);
    const shardController = new ShardController(telemetry);

    // Main Shard Analytics Aggregator (durable consumer)
    const shardAnalytics = new ShardAnalyticsService(stackBus);
    await shardAnalytics.onModuleInit();

    // Seed a flow & run a scheduler tick
    const cb = await flowsService.create({
      name: 'Space Gateway CB',
      type: FlowType.CIRCUIT_BREAKER,
      projectSlug: 'lemon-space',
      config: { state: 'CLOSED', failureThreshold: 1, cooldownSeconds: 30 },
    });
    await flowsService.updateStatus(cb.id, FlowStatus.ACTIVE);
    await scheduler.tick(new Date());

    // 1. Verify /api/shard/health + publishMetrics
    const health = await shardController.health();
    assert.equal(health.status, 'ok');
    assert.equal(health.projectSlug, 'lemon-space');
    assert.equal(health.shardId, 'shard-space-01');
    assert.equal(health.tier, 'dedicated');
    assert.equal(health.db.connected, true);
    assert.equal(health.flows.active, 1);
    assert.ok(health.scheduler.lastTickAt !== null);
    console.log('✓ 1. ShardController.health() returns live DB, Bus, Flow, Scheduler, and Optimizer diagnostics');

    // Trip Circuit Breaker -> emits lemon.lemon-space.flow.circuit_breaker_state -> Analytics alert!
    await flowsService.appendEvent(cb.id, { eventType: 'API_ERROR', payload: { statusCode: 503 } });
    eventBus.engine.flush();

    const pubRes = await shardController.publishMetrics();
    assert.equal(pubRes.published, true);
    await new Promise((r) => setTimeout(r, 30));

    // 2. Verify ShardAnalyticsService ingested both shard.metrics & flow.circuit_breaker_state
    const analyticsSummary = shardAnalytics.getAnalyticsSummary('lemon-space');
    assert.equal(analyticsSummary.totalShards, 1);
    const spaceStats = analyticsSummary.shards[0];
    assert.equal(spaceStats.shardId, 'shard-space-01');
    assert.equal(spaceStats.snapshotHistory.length, 1);
    assert.ok(spaceStats.totalFlowEvents >= 1);
    assert.ok(
      spaceStats.recentAlerts.some((a: any) => a.message.includes('tripped to OPEN')),
      'Durable aggregator must capture Circuit Breaker OPEN alert from NATS bus',
    );
    console.log('✓ 2. ShardAnalyticsService durable consumer aggregated shard metrics and CB alert');

    // 3. Verify ProjectariumService Shard Registry + Resolver
    const projectarium = new ProjectariumService(mockPrisma, stackBus, shardAnalytics);
    const projectariumController = new ProjectariumController(projectarium, {} as any);

    await projectarium.registerOrAttach({
      projectSlug: 'lemon-space',
      projectName: 'Lemon Space',
      appName: 'lemon-core-shard',
      role: 'core-shard',
      host: '127.0.0.1',
      preferredPort: 4399,
      environment: 'dev',
      networkMode: 'local',
      healthUrl: 'http://127.0.0.1:4399/api/shard/health',
      context: {
        shard: {
          shardId: 'shard-space-01',
          tier: 'dedicated',
          apiBaseUrl: 'http://127.0.0.1:4399/api',
          capabilities: ['MUTEX', 'PROJECTION', 'CIRCUIT_BREAKER'],
          customReducers: ['space-towers'],
        },
      },
    });

    const shardsList = projectariumController.listShards();
    assert.equal(shardsList.length, 1);
    assert.equal(shardsList[0].shardId, 'shard-space-01');
    assert.ok(shardsList[0].analytics, 'listShards must enrich shards with latest analytics');

    const resolvedSpace = projectariumController.resolveShard('lemon-space');
    assert.equal(resolvedSpace.mode, 'dedicated-shard');
    assert.equal(resolvedSpace.apiBaseUrl, 'http://127.0.0.1:4399/api');
    assert.equal(resolvedSpace.shard?.customReducers[0], 'space-towers');

    const resolvedSmall = projectariumController.resolveShard('small-utility', 'http://127.0.0.1:3000/api');
    assert.equal(resolvedSmall.mode, 'shared-logical');
    assert.equal(resolvedSmall.apiBaseUrl, 'http://127.0.0.1:3000/api');
    assert.equal(resolvedSmall.shard, null);
    console.log('✓ 3. ProjectariumController.shards & shards/resolve route dedicated vs shared-logical projects');

    // 4. Verify CoreCombinatorClient.forProject() over real HTTP
    let capturedProjectHeader: string | undefined;
    let resolveHits = 0;
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/api/projectarium/shards/resolve')) {
        resolveHits++;
        const u = new URL(req.url, 'http://127.0.0.1');
        const slug = u.searchParams.get('projectSlug') || 'lemon-core';
        const fb = u.searchParams.get('fallbackBaseUrl') || 'http://127.0.0.1:3000/api';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(projectariumController.resolveShard(slug, fb)));
        return;
      }
      if (req.url?.startsWith('/api/flows/stream/metrics')) {
        capturedProjectHeader = req.headers['x-project-slug'] as string | undefined;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ totalImpulsesReceived: 42 }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;

    try {
      CoreCombinatorClient.clearShardCache();

      // Re-register lemon-space pointing to our live mock HTTP shard on `port`
      await projectarium.registerOrAttach({
        projectSlug: 'lemon-space-live',
        projectName: 'Lemon Space Live',
        appName: 'lemon-core-shard',
        role: 'core-shard',
        host: '127.0.0.1',
        preferredPort: port,
        context: {
          shard: {
            shardId: 'shard-space-live',
            tier: 'dedicated',
            apiBaseUrl: `http://127.0.0.1:${port}/api`,
          },
        },
      });

      const sdkClient = await CoreCombinatorClient.forProject({
        projectSlug: 'lemon-space-live',
        projectariumUrl: `http://127.0.0.1:${port}/api`,
      });
      assert.equal(sdkClient.shardResolution?.mode, 'dedicated-shard');
      assert.equal(sdkClient.baseUrl, `http://127.0.0.1:${port}/api`);

      const metrics = await sdkClient.getOptimizationMetrics();
      assert.equal(metrics.totalImpulsesReceived, 42);
      assert.equal(capturedProjectHeader, 'lemon-space-live');

      // Second call uses cache (resolveHits stays 1)
      await CoreCombinatorClient.forProject({
        projectSlug: 'lemon-space-live',
        projectariumUrl: `http://127.0.0.1:${port}/api`,
      });
      assert.equal(resolveHits, 1, 'SDK shard resolver must cache resolution within TTL');

      // Shared-logical fallback when no dedicated shard exists
      const fallbackClient = await CoreCombinatorClient.forProject({
        projectSlug: 'tiny-script',
        projectariumUrl: `http://127.0.0.1:${port}/api`,
        fallbackBaseUrl: 'http://127.0.0.1:3000/api',
      });
      assert.equal(fallbackClient.shardResolution?.mode, 'shared-logical');
      assert.equal(fallbackClient.baseUrl, 'http://127.0.0.1:3000/api');
      console.log('✓ 4. CoreCombinatorClient.forProject() resolves, caches, sets x-project-slug, and falls back cleanly');

      // 5. Re-registering the same dedicated shardId supersedes stale instance & keeps preferredPort
      const reregistered = await projectarium.registerOrAttach({
        projectSlug: 'lemon-space',
        projectName: 'Lemon Space',
        appName: 'lemon-core-shard',
        role: 'core-shard',
        host: '127.0.0.1',
        preferredPort: 4399,
        environment: 'dev',
        networkMode: 'local',
        healthUrl: 'http://127.0.0.1:4399/api/shard/health',
        context: {
          shard: {
            shardId: 'shard-space-01',
            tier: 'dedicated',
            apiBaseUrl: 'http://127.0.0.1:4399/api',
            capabilities: ['MUTEX', 'PROJECTION', 'CIRCUIT_BREAKER'],
            customReducers: ['space-towers'],
          },
        },
      });
      assert.equal(reregistered.allocatedApp.port, 4399, 'Restarting shard must reclaim preferredPort');
      const spaceShardsAfterRestart = projectariumController
        .listShards()
        .filter((s: any) => s.projectSlug === 'lemon-space');
      assert.equal(spaceShardsAfterRestart.length, 1, 'Stale shard instance must be superseded cleanly');
      console.log('✓ 5. Re-registering same dedicated shardId supersedes stale lease and retains preferredPort');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    await shardAnalytics.onModuleDestroy();
    relay.onModuleDestroy();
    await stackBus.onModuleDestroy();
    console.log('\n=== All Stage 2 Project Shards Tests Passed! ===');
  } finally {
    if (prevSlug === undefined) delete process.env.LEMON_SHARD_PROJECT_SLUG;
    else process.env.LEMON_SHARD_PROJECT_SLUG = prevSlug;
    if (prevId === undefined) delete process.env.LEMON_SHARD_ID;
    else process.env.LEMON_SHARD_ID = prevId;
    if (prevTier === undefined) delete process.env.LEMON_SHARD_TIER;
    else process.env.LEMON_SHARD_TIER = prevTier;
    if (prevPublish === undefined) delete process.env.SHARD_METRICS_PUBLISH;
    else process.env.SHARD_METRICS_PUBLISH = prevPublish;
  }
}

runStage2Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
