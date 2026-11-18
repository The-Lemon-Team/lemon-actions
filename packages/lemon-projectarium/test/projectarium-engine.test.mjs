import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectariumEngine } from '../dist/index.js';

test('ProjectariumEngine isolates localhost port allocation per machineId (PC-1 vs PC-2)', () => {
  const engine = new ProjectariumEngine();

  const regPc1 = engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'web-dev',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-1',
    machineName: 'PC-1',
  });

  const regPc2 = engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'web-dev',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-2',
    machineName: 'PC-2',
  });

  // Both PC-1 and PC-2 can allocate :4320 independently without colliding
  assert.equal(regPc1.allocatedApp.port, 4320);
  assert.equal(regPc2.allocatedApp.port, 4320);

  // Second local app on PC-1 must NOT collide with first app on PC-1
  const regPc1Second = engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'worker-dev',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-1',
    machineName: 'PC-1',
  });
  assert.equal(regPc1Second.allocatedApp.port, 4321);
});

test('listProjectsForViewer exposes only public URLs by default and scopes localhost to viewer machineId', () => {
  const engine = new ProjectariumEngine();

  engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'pc1-local-app',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-1',
    machineName: 'PC-1',
  });

  engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'pc2-local-app',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-2',
    machineName: 'PC-2',
  });

  const publicOnly = engine.listProjectsForViewer().find((p) => p.slug === 'actions');
  assert.ok(publicOnly);
  assert.equal(publicOnly.apps.some((a) => a.networkMode === 'local'), false);
  assert.equal(publicOnly.apps.some((a) => a.appName === 'Lemon Core Web (Remote)'), true);

  const pc1View = engine.listProjectsForViewer({ machineId: 'pc-1' }).find((p) => p.slug === 'actions');
  assert.ok(pc1View);
  assert.equal(pc1View.apps.some((a) => a.appName === 'pc1-local-app'), true);
  assert.equal(pc1View.apps.some((a) => a.appName === 'pc2-local-app'), false);
});

test('expireStaleLocalLeases expires dynamic local apps past TTL while preserving seed anchors', () => {
  const engine = new ProjectariumEngine();
  const reg = engine.registerOrAttach({
    projectSlug: 'actions',
    appName: 'ephemeral-dev',
    host: 'localhost',
    networkMode: 'local',
    environment: 'dev',
    machineId: 'pc-1',
    machineName: 'PC-1',
  });

  const futureMs = Date.now() + 20 * 60 * 1000;
  const expired = engine.expireStaleLocalLeases(15 * 60 * 1000, futureMs);

  assert.equal(expired.length, 1);
  assert.equal(expired[0].app.instanceId, reg.allocatedApp.instanceId);

  const actions = engine.getProject('actions');
  assert.ok(actions);
  assert.equal(
    actions.apps.some((a) => a.instanceId === reg.allocatedApp.instanceId),
    false,
  );
  // Seed anchors remain intact
  assert.equal(actions.apps.some((a) => a.id === 'app-actions-web'), true);
});

test('default stands seed uses Lemon-Universe instead of Lemon-Party', () => {
  const engine = new ProjectariumEngine();

  const universe = engine.getProject('lemon-universe');
  assert.ok(universe);
  assert.equal(universe.id, 'stand-lemon-universe');
  assert.equal(universe.name, 'Lemon-Universe');
  assert.equal(universe.neuronWorkspace, 'workspace.universe');
  assert.equal(engine.getProject('lemon-party'), undefined);
});
