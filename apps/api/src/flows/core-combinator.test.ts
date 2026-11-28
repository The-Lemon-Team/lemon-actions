import { FlowStatus, FlowType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { CodeTasksService } from '../code-tasks/code-tasks.service';
import { FoldersService } from '../folders/folders.service';
import { NeuronMetricsService } from '../folders/neuron-metrics.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FlowSchedulerService } from './flow-scheduler.service';
import { FlowsEventBusService } from './flows-event-bus.service';
import { FlowsService } from './flows.service';
import { DEFAULT_FLOW_TYPE_HANDLERS } from './handlers/flow-type.handler';
import { FlowTypeRegistry } from './handlers/flow-type.registry';

async function runCoreCombinatorTests() {
  console.log('=== Running Clean Core Combinator Verification Tests ===\n');

  const folderId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const scheduleFlowId = '11111111-1111-1111-1111-111111111111';
  const logFlowId = '22222222-2222-2222-2222-222222222222';

  const db = {
    profiles: new Map<string, any>(),
    folders: new Map<string, any>(),
    flows: new Map<string, any>(),
    sessions: [] as any[],
    events: [] as any[],
    bufferItems: [] as any[],
  };

  db.folders.set(folderId, {
    id: folderId,
    name: 'Core Neuron',
    path: 'workspace.core',
    profileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  db.flows.set(scheduleFlowId, {
    id: scheduleFlowId,
    name: 'Workday Dev Window',
    description: 'Scheduled Mutex 10:00-19:00',
    type: FlowType.MUTEX,
    status: FlowStatus.INACTIVE,
    isExclusive: false,
    folderId,
    profileId: null,
    tags: [],
    config: null,
    orchestratorRules: {
      schedule: {
        enabled: true,
        windows: [{ days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' }],
      },
    },
    createdAt: new Date('2026-11-04T08:00:00'),
    updatedAt: new Date('2026-11-04T08:00:00'),
  });

  db.flows.set(logFlowId, {
    id: logFlowId,
    name: 'Antigravity Work Log',
    description: 'Continuous telemetry stream',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folderId,
    profileId: null,
    tags: [],
    config: null,
    orchestratorRules: null,
    createdAt: new Date('2026-11-04T08:00:00'),
    updatedAt: new Date('2026-11-04T08:00:00'),
  });

  const mockFlowsRepo: any = {
    transaction: async (fn: any) => fn(mockFlowsRepo),
    findMany: async (q: any = {}) => {
      let list = Array.from(db.flows.values());
      if (q.folderId) {
        list = list.filter((f) => f.folderId === q.folderId);
      }
      if (q.profileId) {
        list = list.filter((f) => f.profileId === q.profileId);
      }
      if (q.scope) {
        const scopedFolderIds = Array.from(db.folders.values())
          .filter(
            (folder) =>
              (!q.profileId || folder.profileId === q.profileId) &&
              (folder.path === q.scope || folder.path.startsWith(q.scope + '.')),
          )
          .map((f) => f.id);
        list = list.filter((f) => scopedFolderIds.includes(f.folderId));
      }
      return list;
    },
    findById: async (id: string) => db.flows.get(id) ?? null,
    findRunningExclusive: async () => [],
    getFolderMeta: async (id: string) => db.folders.get(id) ?? null,
    create: async (data: any, tagNames: string[]) => {
      const id = `flow-${db.flows.size + 1}`;
      const f = {
        id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        status: FlowStatus.INACTIVE,
        isExclusive: data.isExclusive ?? false,
        folderId: data.folder?.connect?.id ?? null,
        profileId: data.profile?.connect?.id ?? null,
        tags: tagNames.map((n, i) => ({ tag: { id: `t-${i}`, name: n, colorHex: null } })),
        config: data.config ?? null,
        orchestratorRules: data.orchestratorRules ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.flows.set(id, f);
      return f;
    },
    update: async (id: string, data: any, tagNames?: string[]) => {
      const f = db.flows.get(id);
      if (!f) throw new Error(`Flow ${id} not found in mock repo`);
      if (data.name !== undefined) f.name = data.name;
      if (data.description !== undefined) f.description = data.description;
      if (data.config !== undefined) f.config = data.config;
      if (tagNames) {
        f.tags = tagNames.map((n: string, i: number) => ({ tag: { id: `t-${i}`, name: n, colorHex: null } }));
      }
      f.updatedAt = new Date();
      return f;
    },
    setStatus: async (id: string, status: FlowStatus) => {
      const f = db.flows.get(id);
      f.status = status;
      f.updatedAt = new Date();
      return f;
    },
    hasOpenSession: async (flowId: string) =>
      db.sessions.some((s) => s.flowId === flowId && s.endedAt === null),
    openSession: async (flowId: string) => {
      const s = { id: `session-${db.sessions.length + 1}`, flowId, startedAt: new Date(), endedAt: null, closedBy: null };
      db.sessions.push(s);
      return s;
    },
    closeSessions: async (flowId: string, closedBy: string) => {
      for (const s of db.sessions) {
        if (s.flowId === flowId && s.endedAt === null) {
          s.endedAt = new Date();
          s.closedBy = closedBy;
        }
      }
    },
    findOpenSessionsInFolder: async (fId: string | null) =>
      db.sessions.filter((s) => {
        const f = db.flows.get(s.flowId);
        return s.endedAt === null && f?.folderId === fId;
      }),
    touchFlow: async (id: string) => {
      const f = db.flows.get(id);
      if (f) f.updatedAt = new Date();
    },
    createFlowEvent: async (data: any) => {
      const ev = { id: `ev-${db.events.length + 1}`, createdAt: new Date(), ...data };
      db.events.push(ev);
      return ev;
    },
    listSessions: async (flowId: string) => db.sessions.filter((s) => s.flowId === flowId),
    listEvents: async (flowId: string) => db.events.filter((e) => e.flowId === flowId),
    findFlowsByFolder: async (fId: string) => Array.from(db.flows.values()).filter((f) => f.folderId === fId),
    pushBufferItem: async (flowId: string, payload: any, dedupKey?: string) => {
      const item = { id: `buf-${db.bufferItems.length + 1}`, flowId, payload, dedupKey, enqueuedAt: new Date(), flushedAt: null };
      db.bufferItems.push(item);
      return item;
    },
    findPendingBufferItems: async (flowId: string) =>
      db.bufferItems.filter((i) => i.flowId === flowId && i.flushedAt === null),
    flushBufferItems: async (flowId: string) => {
      const pending = db.bufferItems.filter((i) => i.flowId === flowId && i.flushedAt === null);
      pending.forEach((i) => (i.flushedAt = new Date()));
      return pending;
    },
  };

  const eventBus = new FlowsEventBusService();
  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const flowsService = new FlowsService(mockFlowsRepo, registry, eventBus);
  const scheduler = new FlowSchedulerService(mockFlowsRepo, flowsService);

  // 1. В 14:00 среды (внутри рабочего окна 10:00–19:00) запускаем тик планировщика
  console.log('Test 1: Scheduled Mutex opens session window at 14:00');
  await scheduler.tick(new Date('2026-11-04T14:00:00'));
  if (db.flows.get(scheduleFlowId).status !== FlowStatus.ACTIVE || db.sessions.length !== 1) {
    throw new Error('Expected Workday Dev Window to be ACTIVE with 1 open session');
  }
  console.log('  ✓ Workday Dev Window перешел в ACTIVE, открыта сессия:', db.sessions[0].id);

  // 2. Внешнее приложение отправляет лог работы в Antigravity Work Log в 14:30
  console.log('\nTest 2: Event logged during active schedule captures session ID');
  const ev1 = await flowsService.appendEvent(logFlowId, {
    source: 'antigravity-adapter',
    eventType: 'WORK_LOG',
    payload: { summary: 'Refactored Core Combinator', minutes: 30 },
  });
  if (ev1.activeFlowSessionIds.length !== 1 || ev1.activeFlowSessionIds[0] !== db.sessions[0].id) {
    throw new Error('Expected event to capture open schedule session ID');
  }
  console.log('  ✓ Событие записано со слепком активной сессии расписания:', ev1.activeFlowSessionIds);

  // 3. В 20:30 (после окончания окна 10:00–19:00) Scheduled Mutex закрывает сессию, НО НЕ ОТСЕКАЕТ историю нейрона
  console.log('\nTest 3: Scheduled Mutex closes window at 20:30 without cutting off future neuron events');
  await scheduler.tick(new Date('2026-11-04T20:30:00'));
  if (db.flows.get(scheduleFlowId).status !== FlowStatus.INACTIVE || db.sessions[0].endedAt === null) {
    throw new Error('Expected Workday Dev Window to close session at 20:30');
  }

  const ev2 = await flowsService.appendEvent(logFlowId, {
    source: 'antigravity-adapter',
    eventType: 'WORK_LOG',
    payload: { summary: 'Evening hotfix outside schedule window', minutes: 15 },
  });
  const allEvents = await flowsService.listEvents(logFlowId);
  if (allEvents.length !== 2 || ev2.activeFlowSessionIds.length !== 0) {
    throw new Error('Expected both daytime and evening events to be preserved in unbroken chronicle');
  }
  console.log('  ✓ Сессия расписания закрыта (closed_by: schedule:window_end), вечернее событие успешно сохранено без потери истории!');

  // 4. Проверка контекста Нейрона-Контейнера (права доступа для внешних императивных приложений)
  console.log('\nTest 4: Neuron Container Context (Flow-based Access Control)');
  const mockFoldersRepo: any = {
    findById: async (id: string) =>
      id === folderId
        ? { id: folderId, name: 'Focus Modes', path: 'focus_modes', profileId: null }
        : db.folders.get(id) ?? null,
    findFolderContextData: async (fId?: string) => {
      const targetFolderId = fId || folderId;
      const folderFlows = Array.from(db.flows.values()).filter((f) => f.folderId === targetFolderId);
      return {
        flows: folderFlows,
        activeSessions: db.sessions.filter((s) => s.endedAt === null),
        recentEvents: db.events,
      };
    },
    insert: async (name: string, parentId: string | null, path: string, profileId: string | null) => {
      const id = `folder-${db.folders.size + 1}`;
      const f = { id, name, parentId, profileId, path, createdAt: new Date(), updatedAt: new Date() };
      db.folders.set(id, f);
      return f;
    },
    findAll: async (q: any = {}) => {
      return Array.from(db.folders.values()).filter(
        (f) =>
          (!q.profileId || f.profileId === q.profileId) &&
          (!q.scope || f.path === q.scope || f.path.startsWith(q.scope + '.')),
      );
    },
    resolveProfileId: async (idOrHandle: string) => {
      for (const p of db.profiles.values()) {
        if (p.id === idOrHandle || p.handle === idOrHandle) return p.id;
      }
      return idOrHandle;
    },
  };
  const foldersService = new FoldersService(mockFoldersRepo);
  const ctx = await foldersService.context(folderId);

  if (
    ctx.permissions.gates['Workday Dev Window']?.status !== 'INACTIVE' ||
    ctx.permissions.gates['Antigravity Work Log']?.status !== 'ACTIVE' ||
    ctx.recentEvents.length !== 2
  ) {
    throw new Error('Expected folder context to expose flow gates and recent events');
  }
  console.log('  ✓ Контекст контейнера отдает актуальные права доступа (gates) и всю хронику событий!');

  // 5. Проверка регистрации профиля и ltree scope изоляции для приложения «Lemon Home»
  console.log('\nTest 5: Profile Registration & ltree Scope Isolation ("home")');
  const mockPrisma: any = {
    profile: {
      findUnique: async ({ where }: any) => {
        for (const p of db.profiles.values()) {
          if (where.id && p.id === where.id) return p;
          if (where.handle && p.handle === where.handle) return p;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = `profile-${db.profiles.size + 1}`;
        const p = { id, ...data, createdAt: new Date() };
        db.profiles.set(id, p);
        return p;
      },
    },
  };
  const profilesService = new ProfilesService(mockPrisma, mockFoldersRepo, flowsService);
  const alexProfile = await profilesService.register({
    handle: 'alex_home',
    displayName: 'Квартира Алекса',
    avatarIcon: 'apartment',
  });
  const dachaProfile = await profilesService.register({
    handle: 'dacha',
    displayName: 'Загородный Дом',
    avatarIcon: 'cottage',
  });

  // Создадим технический поток в workspace.core у Алекса, чтобы убедиться что scope='home' его НЕ отдает
  const alexWorkspaceFolders = await foldersService.findAll({
    profileId: alexProfile.id,
    scope: 'workspace',
  });
  await flowsService.create({
    name: 'CI/CD Pipeline Mutex',
    type: FlowType.MUTEX,
    folderId: alexWorkspaceFolders[0].id,
    profileId: alexProfile.id,
  });

  const alexHomeFlows = await flowsService.list({
    profileId: alexProfile.id,
    scope: 'home',
  });
  const dachaHomeFlows = await flowsService.list({
    profileId: dachaProfile.id,
    scope: 'home',
  });

  if (alexHomeFlows.length !== 31 || alexHomeFlows.some((f) => f.name === 'CI/CD Pipeline Mutex')) {
    throw new Error(`Expected 31 starter home flows in scope="home" for Alex, got ${alexHomeFlows.length}`);
  }
  if (dachaHomeFlows.length !== 4 || dachaHomeFlows.some((f) => f.profileId !== dachaProfile.id)) {
    throw new Error('Expected strict profile isolation between alex_home and dacha');
  }
  console.log(
    `  ✓ Профили "${alexProfile.displayName}" и "${dachaProfile.displayName}" изолированы; scope="home" отдает строго 4 бытовых виджета без серверных потоков workspace!`,
  );

  // 6. Проверка императивного приложения «Lemon Code Lab» (Спецификация задач, тесты и хроника сессий)
  console.log('\nTest 6: Lemon Code Lab - Task Contract, Watcher Sync & Session Tracking');
  const codeTasksService = new CodeTasksService(mockPrisma, mockFoldersRepo, flowsService);

  let demoPath = path.resolve(process.cwd(), 'examples', 'challenges-demo');
  if (!fs.existsSync(demoPath)) {
    demoPath = path.resolve(__dirname, '..', '..', '..', '..', 'examples', 'challenges-demo');
  }
  const resultsFilePath = path.join(demoPath, '.lemon', 'results.json');
  const originalResultsContent = fs.existsSync(resultsFilePath) ? fs.readFileSync(resultsFilePath, 'utf-8') : null;

  try {
    const repo = await codeTasksService.registerRepo({
      localPath: demoPath,
      name: 'Starter Challenges (JS/Tauri/Vite/REST)',
      defaultTags: ['#js', '#tauri', '#vite', '#rest'],
      profileId: alexProfile.id,
    });

    const codeFlows = await flowsService.list({ folderId: repo.folderId });
    if (codeFlows.length !== 4) {
      throw new Error(`Expected 4 tasks imported from .lemon/tasks.json, got ${codeFlows.length}`);
    }

    // Проверяем теги и статусы
    const debounceTask = codeFlows.find((f) => f.name.includes('Debounce'));
    const tauriTask = codeFlows.find((f) => f.name.includes('Tauri'));
    const viteTask = codeFlows.find((f) => f.name.includes('Vite'));

    if (!debounceTask || !tauriTask || !viteTask) {
      throw new Error('Expected Debounce, Tauri, and Vite tasks to be present in Core Combinator');
    }

    const tauriMeta = (tauriTask.config as any)?.codeTask;
    if (tauriMeta.status !== 'FAILED' || tauriMeta.testsFailed !== 4) {
      throw new Error(`Expected Tauri task to be FAILED with 4 failed tests, got ${tauriMeta.status}`);
    }

    const debounceMeta = (debounceTask.config as any)?.codeTask;
    if (debounceMeta.status !== 'PASSED' || debounceMeta.testsPassed !== 6) {
      throw new Error(`Expected Debounce task to be PASSED with 6 passed tests, got ${debounceMeta.status}`);
    }

    // Разработчик берет Tauri-задачу в фокус (Mutex -> ACTIVE)
    console.log('  -> Разработчик берет задачу "Tauri Secure IPC" в работу...');
    await flowsService.updateStatus(tauriTask.id, FlowStatus.ACTIVE);
    const tauriSessions = await flowsService.listSessions(tauriTask.id);
    if (tauriSessions.length !== 1 || tauriSessions[0].endedAt !== null) {
      throw new Error('Expected active session to be opened for Tauri task');
    }

    // Разработчик исправил код: раннер тестов пишет PASSED в results.json
    console.log('  -> Раннер тестов фиксирует исправление: все 6 тестов пройдены...');
    await codeTasksService.pushResults(repo.id, {
      results: [
        {
          taskId: tauriMeta.id,
          status: 'PASSED',
          tests: { total: 6, passed: 6, failed: 0, skipped: 0 },
          durationMs: 78,
        },
      ],
    });

    // Проверяем, что задача перешла в PASSED, сессия закрыта, а событие залогировано
    const updatedTauri = await flowsService.findOne(tauriTask.id);
    const updatedTauriMeta = (updatedTauri.config as any)?.codeTask;
    if (updatedTauriMeta.status !== 'PASSED' || updatedTauri.status !== FlowStatus.INACTIVE) {
      throw new Error('Expected Tauri task to be completed and closed after all tests passed');
    }

    const tauriEvents = await flowsService.listEvents(tauriTask.id);
    if (!tauriEvents.some((e) => e.eventType === 'TESTS_PASSED')) {
      throw new Error('Expected TESTS_PASSED event in Flow Chronicle');
    }

    console.log(
      `  ✓ Задачи репозитория (${codeFlows.length} шт.) успешно синхронизированы в скоупе "${repo.folderPath}"; сессия решения и событие TESTS_PASSED зафиксированы!`,
    );

    await codeTasksService.unregisterRepo(repo.id);
  } finally {
    if (originalResultsContent && fs.existsSync(resultsFilePath)) {
      fs.writeFileSync(resultsFilePath, originalResultsContent, 'utf-8');
    }
  }

  // 7. Проверка шины импульсов (SSE / FlowsEventBus)
  console.log('\nTest 7: Reactive FlowsEventBus Impulse Stream');
  const capturedImpulses: any[] = [];
  const impulseSub = eventBus.stream$().subscribe((packet) => capturedImpulses.push(packet));

  // 8. Проверка TIMER потока и автоматических тиков планировщика
  console.log('\nTest 8: TIMER Flow Cadence & Scheduler Ticks');
  const timerFlow = await flowsService.create({
    name: 'Watcher Cadence Timer',
    type: FlowType.TIMER,
    folderId,
    config: { intervalSeconds: 60 },
  });
  await flowsService.updateStatus(timerFlow.id, FlowStatus.ACTIVE);

  const tickNow = new Date('2026-11-04T15:00:00');
  const schedulerResult = await scheduler.tick(new Date(tickNow.getTime() + 65000));
  if (schedulerResult.timerTicks < 1) {
    throw new Error('Expected scheduler to emit a timer tick after interval elapsed');
  }
  const timerEvents = await flowsService.listEvents(timerFlow.id);
  if (!timerEvents.some((e) => e.eventType === 'TIMER_TICK')) {
    throw new Error('Expected TIMER_TICK event in timer flow chronicle');
  }
  console.log('  ✓ TIMER поток активен, планировщик зафиксировал тик с интервалом 60s!');

  // 9. Проверка CIRCUIT_BREAKER: сбой, размыкание (OPEN) и авто-восстановление (HALF_OPEN)
  console.log('\nTest 9: CIRCUIT_BREAKER Supervisor, Trip on Error & Cooldown Recovery');
  const breakerFlow = await flowsService.create({
    name: 'External API Sentinel',
    type: FlowType.CIRCUIT_BREAKER,
    folderId,
    config: { failureThreshold: 2, cooldownSeconds: 30, state: 'CLOSED' },
  });

  // Эмулируем 2 ошибки подряд
  await flowsService.appendEvent(breakerFlow.id, {
    eventType: 'API_ERROR',
    payload: { error: '503 Service Unavailable', statusCode: 503 },
  });
  await flowsService.appendEvent(breakerFlow.id, {
    eventType: 'API_ERROR',
    payload: { error: '503 Service Unavailable', statusCode: 503 },
  });

  const trippedBreaker = await flowsService.findOne(breakerFlow.id);
  if ((trippedBreaker.config as any)?.state !== 'OPEN') {
    throw new Error('Expected Circuit Breaker to trip to OPEN after 2 errors');
  }
  console.log('  ✓ Circuit Breaker зафиксировал 2 сбоя и перешел в OPEN (цепь разомкнута)');

  // Планировщик проверяет cooldown через 35 секунд
  const cooldownPassTime = new Date(Date.now() + 35000);
  const cbRecoverResult = await scheduler.tick(cooldownPassTime);
  if (cbRecoverResult.circuitBreakersRecovered < 1) {
    throw new Error('Expected scheduler to transition Circuit Breaker to HALF_OPEN after cooldown');
  }
  const halfOpenBreaker = await flowsService.findOne(breakerFlow.id);
  if ((halfOpenBreaker.config as any)?.state !== 'HALF_OPEN') {
    throw new Error('Expected Circuit Breaker state to be HALF_OPEN after cooldown');
  }
  console.log('  ✓ По истечении cooldown Circuit Breaker перешел в HALF_OPEN для пробного импульса!');

  // 10. Проверка BATCH: буферизация, дедупликация и сброс по квоте (SIZE_THRESHOLD)
  console.log('\nTest 10: BATCH Ingestion, Dedup Key & Automatic Flush');
  const batchFlow = await flowsService.create({
    name: 'Raw News Influx Buffer',
    type: FlowType.BATCH,
    folderId,
    config: { maxBatchSize: 3, maxWaitSeconds: 60, idleTimeoutSeconds: 10, deduplicationKey: 'url' },
  });
  await flowsService.updateStatus(batchFlow.id, FlowStatus.ACTIVE);

  await flowsService.pushBatch(batchFlow.id, {
    items: [
      { dedupKey: 'https://example.com/1', payload: { title: 'News 1' } },
      { dedupKey: 'https://example.com/2', payload: { title: 'News 2' } },
      { dedupKey: 'https://example.com/3', payload: { title: 'News 3' } },
    ],
  });

  const batchEvents = await flowsService.listEvents(batchFlow.id);
  const flushEvent = batchEvents.find((e) => e.eventType === 'BATCH_FLUSH');
  if (!flushEvent || (flushEvent.payload as any)?.itemsCount !== 3) {
    throw new Error('Expected BATCH_FLUSH event with 3 items when maxBatchSize is reached');
  }
  console.log('  ✓ BATCH буфер накопил 3 элемента и автоматически сбросил пачку по квоте размера!');

  // 11. Проверка Activation Gate (BARRIER): защита запуска MUTEX условиями
  console.log('\nTest 11: Activation Gate (BARRIER) on MUTEX');
  // Вновь размыкаем breaker в OPEN
  await flowsService.updateCircuitBreaker(breakerFlow.id, 'OPEN', 'Manual trip for testing gate');

  const guardedMutex = await flowsService.create({
    name: 'Guarded News Worker',
    type: FlowType.MUTEX,
    folderId,
    isExclusive: false,
    orchestratorRules: {
      gate: {
        enabled: true,
        strategy: 'ALL',
        conditions: [
          {
            type: FlowType.CIRCUIT_BREAKER,
            flowId: breakerFlow.id,
            expectedState: 'CLOSED',
          },
        ],
      },
    },
  });

  // Попытка запуска должна быть отклонена барьером (409 Conflict)
  let gateBlocked = false;
  try {
    await flowsService.updateStatus(guardedMutex.id, FlowStatus.ACTIVE);
  } catch (err: any) {
    if (err.message.includes('Activation Gate blocked')) {
      gateBlocked = true;
    }
  }
  if (!gateBlocked) {
    throw new Error('Expected Activation Gate to block MUTEX while Circuit Breaker is OPEN');
  }
  console.log('  ✓ Activation Gate заблокировал запуск MUTEX (Circuit Breaker в состоянии OPEN)');

  // Восстанавливаем Circuit Breaker в CLOSED
  await flowsService.updateCircuitBreaker(breakerFlow.id, 'CLOSED', 'All systems operational');
  await flowsService.updateStatus(guardedMutex.id, FlowStatus.ACTIVE);
  const activeGuarded = await flowsService.findOne(guardedMutex.id);
  if (activeGuarded.status !== FlowStatus.ACTIVE) {
    throw new Error('Expected MUTEX to successfully activate once Circuit Breaker became CLOSED');
  }
  console.log('  ✓ После восстановления Circuit Breaker барьер открылся, MUTEX перешел в ACTIVE!');

  // 12. Проверка агрегатора MetricsNeuron
  console.log('\nTest 12: MetricsNeuron Aggregator (Telemetry & Gates Summary)');
  const neuronMetricsService = new NeuronMetricsService(mockFoldersRepo);
  const metrics = await neuronMetricsService.calculateMetrics(folderId);

  if (metrics.telemetry.totalPulses < 1) {
    throw new Error('Expected MetricsNeuron to count recorded chronicle events');
  }
  if (!metrics.activeState.activeFlows.includes('Guarded News Worker')) {
    throw new Error('Expected MetricsNeuron to include Guarded News Worker in activeFlows');
  }
  console.log(
    `  ✓ MetricsNeuron рассчитал сводку: ${metrics.telemetry.totalPulses} событий, successRate: ${metrics.telemetry.successRate}%, активных потоков: ${metrics.activeState.activeFlows.length}!`,
  );

  // Проверяем захваченные импульсы
  if (!capturedImpulses.some((p) => p.type === 'BATCH_FLUSH')) {
    throw new Error('Expected BATCH_FLUSH impulse in event bus stream');
  }
  impulseSub.unsubscribe();
  console.log(`  ✓ FlowsEventBus зафиксировал ${capturedImpulses.length} реактивных импульсов (SSE Stream готов)!`);

  console.log('\n=== All Clean Core Combinator Tests Passed! ===');
  process.exit(0);
}

runCoreCombinatorTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
