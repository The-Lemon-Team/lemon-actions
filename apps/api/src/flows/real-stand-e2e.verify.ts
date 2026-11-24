import assert from 'node:assert/strict';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StackBusController } from '../bus/stack-bus.controller';
import { FlowsController } from './flows.controller';

async function verifyRealAppWithDbAndNats() {
  process.env.DATABASE_URL =
    'postgresql://lemon:lemon_secret@192.168.1.100:5436/lemon_projectarium_db?schema=public';
  process.env.NATS_URL = 'nats://127.0.0.1:4222';
  process.env.LEMON_BUS_DRIVER = 'nats';
  process.env.PROJECTARIUM_AUTO_PROBE = 'false';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  await app.init();

  try {
    const busCtrl = app.get(StackBusController);
    const flowsCtrl = app.get(FlowsController);

    const busStatus = await busCtrl.status();
    console.log('BUS_STATUS:', {
      driver: busStatus.driver,
      connected: busStatus.connected,
      streamName: busStatus.streamName,
    });
    assert.equal(busStatus.driver, 'nats');
    assert.equal(busStatus.connected, true);

    const emitterId = 'cc8d65a8-393e-460d-96f5-58b0d944de7d';
    const easyCompleted = await flowsCtrl.listTaskPool(emitterId, 'actor-easy', 'COMPLETED');
    console.log(
      'EASY_COMPLETED_IN_EMITTER:',
      easyCompleted.items.map((t: any) => ({
        taskId: t.taskId,
        reward: t.reward,
        currency: t.currency,
        status: t.status,
        claimedByTower: t.claimedByTower,
      })),
    );
    assert.equal(easyCompleted.items.length, 2);
    assert.ok(easyCompleted.items.some((t: any) => t.taskId === 'bounty-2-lemon-actions-bus' && t.reward === 500));
    assert.ok(easyCompleted.items.some((t: any) => t.taskId === 'bounty-6-bus-lightweight-heartbeats' && t.reward === 100));

    // Publish real NATS event matching Air Tower Observer selector tags (`architecture`)
    const marker = `e2e-${Date.now()}`;
    await busCtrl.publish({
      projectSlug: 'lemon-space',
      domain: 'architecture',
      event: 'verified',
      sourceApp: 'real-app-e2e',
      tags: ['air', 'architecture'],
      payload: { marker, verifiedBy: 'actor-easy' },
    });

    await new Promise((r) => setTimeout(r, 400));

    const airObserverId = '91477a83-496e-457a-ab1e-45f877e684ce';
    const events = await flowsCtrl.listEvents(airObserverId, {});
    assert.ok(
      events.some((e: any) => e.eventType === 'lemon.lemon-space.architecture.verified' && e.payload?.data?.marker === marker),
      'Real AppModule OBSERVER flow must persist matched NATS event into PostgreSQL',
    );
    console.log('✓ Real AppModule (PG 192.168.1.100:5436 + NATS 127.0.0.1:4222) E2E verification passed!');
  } finally {
    await app.close();
  }
}

verifyRealAppWithDbAndNats().catch((err) => {
  console.error(err);
  process.exit(1);
});
