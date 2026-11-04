import { FlowStatus, FlowType } from '@prisma/client';
import { FoldersService } from '../folders/folders.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FlowSchedulerService } from './flow-scheduler.service';
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
  };

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
  };

  const registry = new FlowTypeRegistry(DEFAULT_FLOW_TYPE_HANDLERS);
  const flowsService = new FlowsService(mockFlowsRepo, registry);
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
    findFolderContextData: async () => ({
      flows: [db.flows.get(scheduleFlowId), db.flows.get(logFlowId)],
      activeSessions: db.sessions.filter((s) => s.endedAt === null),
      recentEvents: db.events,
    }),
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

  if (alexHomeFlows.length !== 4 || alexHomeFlows.some((f) => f.name === 'CI/CD Pipeline Mutex')) {
    throw new Error(`Expected 4 starter home flows in scope="home" for Alex, got ${alexHomeFlows.length}`);
  }
  if (dachaHomeFlows.length !== 4 || dachaHomeFlows.some((f) => f.profileId !== dachaProfile.id)) {
    throw new Error('Expected strict profile isolation between alex_home and dacha');
  }
  console.log(
    `  ✓ Профили "${alexProfile.displayName}" и "${dachaProfile.displayName}" изолированы; scope="home" отдает строго 4 бытовых виджета без серверных потоков workspace!`,
  );

  console.log('\n=== All Clean Core Combinator Tests Passed! ===');
}

runCoreCombinatorTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
