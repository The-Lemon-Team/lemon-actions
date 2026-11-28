import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildProjectWildcard,
  buildStackTopic,
  createConnectedStackBus,
  InMemoryStackBusTransport,
  matchesTopicPattern,
  parseStackTopic,
  StackBusHub,
  WELL_KNOWN_TOPICS,
} from '../dist/index.js';

test('topic builder, parser and NATS-style wildcards', () => {
  const topic = buildStackTopic('Media Hub', 'media', 'created');
  assert.equal(topic, 'lemon.media-hub.media.created');

  const parsed = parseStackTopic(topic);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.projectSlug, 'media-hub');
  assert.equal(parsed.domain, 'media');
  assert.equal(parsed.event, 'created');

  assert.equal(matchesTopicPattern('lemon.>', topic), true);
  assert.equal(matchesTopicPattern('lemon.media-hub.>', topic), true);
  assert.equal(matchesTopicPattern('lemon.*.media.created', topic), true);
  assert.equal(matchesTopicPattern('lemon.media-hub.*.created', topic), true);
  assert.equal(matchesTopicPattern('lemon.projectarium.>', topic), false);
  assert.equal(matchesTopicPattern('lemon.*.media.deleted', topic), false);
  assert.equal(buildProjectWildcard('lemon-universe'), 'lemon.lemon-universe.>');
});

test('per-project isolation and cross-bus wildcard delivery', async () => {
  const hub = await createConnectedStackBus({ driver: 'memory' });
  assert.equal(hub.driver, 'memory');

  const mediaBus = hub.forProject('media-hub', 'lemon-media-hub-api');
  const projectariumBus = hub.forProject('projectarium', 'lemon-projectarium');

  const mediaOnly = [];
  const crossAll = [];
  const crossCreatedOnly = [];

  const sub1 = mediaBus.subscribe$('>').subscribe((e) => mediaOnly.push(e));
  const sub2 = hub.subscribe$({ topicPattern: WELL_KNOWN_TOPICS.ALL }).subscribe((e) => crossAll.push(e));
  const sub3 = hub.subscribe$({ topicPattern: 'lemon.*.*.created' }).subscribe((e) => crossCreatedOnly.push(e));

  await mediaBus.publish('media', 'created', { assetId: 'a-1', kind: 'image' }, { dedupKey: 'media:a-1' });
  // Duplicate dedupKey must not emit a second time
  await mediaBus.publish('media', 'created', { assetId: 'a-1', kind: 'image' }, { dedupKey: 'media:a-1' });
  await projectariumBus.publish('stand', 'created', { standSlug: 'lemon-universe' });
  await projectariumBus.publish('todo', 'changed', { todoId: 't-1', completed: true });

  assert.equal(mediaOnly.length, 1);
  assert.equal(mediaOnly[0].topic, 'lemon.media-hub.media.created');
  assert.equal(crossAll.length, 3);
  assert.equal(crossCreatedOnly.length, 2);

  const replayed = await hub.replay({ projectSlug: 'projectarium' });
  assert.equal(replayed.length, 2);
  assert.equal(replayed[0].topic, 'lemon.projectarium.stand.created');

  const status = await hub.getStatus();
  assert.equal(status.totalPublished, 3);
  assert.equal(status.projects.length, 2);

  sub1.unsubscribe();
  sub2.unsubscribe();
  sub3.unsubscribe();
  await hub.disconnect();
});

test('InMemoryStackBusTransport durable replay policies (all / last / sinceSeq)', async () => {
  const transport = new InMemoryStackBusTransport();
  await transport.connect();

  await transport.publish({ projectSlug: 'alpha', domain: 'flow', event: 'started', payload: { n: 1 } });
  await transport.publish({ projectSlug: 'alpha', domain: 'flow', event: 'tick', payload: { n: 2 } });
  await transport.publish({ projectSlug: 'beta', domain: 'flow', event: 'started', payload: { n: 3 } });

  const deliveredAll = [];
  const handleAll = await transport.subscribe(
    { projectSlug: 'alpha', deliverPolicy: 'all' },
    (env) => {
      deliveredAll.push(env.payload.n);
    },
  );
  assert.deepEqual(deliveredAll, [1, 2]);

  const sinceSeq = await transport.replay({ sinceSeq: 1 });
  assert.equal(sinceSeq.length, 2);
  assert.equal(sinceSeq[0].payload.n, 2);
  assert.equal(sinceSeq[1].payload.n, 3);

  await handleAll.unsubscribe();
  await transport.disconnect();
});

test('StackBusHub.subscribe re-attaches managed subscriptions on transport upgrade', async () => {
  const initialTransport = new InMemoryStackBusTransport();
  await initialTransport.connect();
  const hub = new StackBusHub(initialTransport);

  const received = [];
  const handle = await hub.subscribe(
    { topicPattern: 'lemon.*.shard.>', durableName: 'main_shard_analytics', deliverPolicy: 'new' },
    (env) => {
      received.push({ seq: env.seq, slug: env.projectSlug, driver: hub.driver });
    },
  );

  // Publish on initial transport
  await hub.publish({
    projectSlug: 'lemon-watchers',
    domain: 'shard',
    event: 'metrics',
    payload: { ok: true },
  });
  assert.equal(received.length, 1);

  // Upgrade transport (simulates StackBusService.onModuleInit swapping InMemory -> NATS)
  const upgradedTransport = new InMemoryStackBusTransport();
  await upgradedTransport.connect();
  hub.transport = upgradedTransport;

  // Give async reattach microtask a tick to attach on upgradedTransport
  await new Promise((r) => setTimeout(r, 20));

  await upgradedTransport.publish({
    projectSlug: 'lemon-seasons',
    domain: 'shard',
    event: 'metrics',
    payload: { ok: true },
  });
  assert.equal(received.length, 2);
  assert.equal(received[1].slug, 'lemon-seasons');

  await handle.unsubscribe();
  await hub.disconnect();
});
