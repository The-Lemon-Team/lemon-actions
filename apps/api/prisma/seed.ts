import { FlowStatus, FlowType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

try {
  process.loadEnvFile();
} catch {
  // Ignore if .env is missing
}

const prisma = new PrismaClient();

const FOLDERS: { name: string; path: string }[] = [
  { name: 'Workspace', path: 'workspace' },
  { name: 'Core Services', path: 'workspace.core' },
  { name: 'Billing Pipelines', path: 'workspace.billing' },
  { name: 'Infrastructure', path: 'infrastructure' },
  { name: 'Focus Modes', path: 'focus_modes' },
  { name: 'Event Hooks', path: 'event_hooks' },
  { name: 'Archival Tasks', path: 'archival' },
  { name: 'Home', path: 'home' },
  { name: 'Household Supplies', path: 'home.supplies' },
  { name: 'Home Routines', path: 'home.routines' },
];

const deepWorkFsm = {
  initial: 'idle',
  states: {
    idle: {
      label: 'Idle',
      badgeColor: '#9ca3af',
      transitions: [
        { event: 'START', target: 'focusing', ui: { buttonLabel: 'Start Focus', icon: 'play_arrow', intent: 'primary' } },
      ],
    },
    focusing: {
      label: 'Focusing',
      badgeColor: '#16a34a',
      transitions: [
        { event: 'BREAK', target: 'break', ui: { buttonLabel: 'Take Break', icon: 'coffee', intent: 'secondary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
    break: {
      label: 'On Break',
      badgeColor: '#f59e0b',
      transitions: [
        { event: 'RESUME', target: 'focusing', ui: { buttonLabel: 'Resume', icon: 'play_arrow', intent: 'primary' } },
        { event: 'STOP', target: 'idle', ui: { buttonLabel: 'Stop', icon: 'stop', intent: 'danger' } },
      ],
    },
  },
};

const FLOWS = [
  {
    name: 'Database Sync',
    description: 'Keeps primary and replica databases in sync; only one sync may run at a time.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: true,
    folder: 'workspace.core',
    tags: ['infra', 'db', 'mutex'],
    orchestratorRules: { onConflict: 'reject' },
  },
  {
    name: 'Deep Work State Machine',
    description: 'Tracks focus, break and idle states for deep work sessions.',
    type: FlowType.FSM,
    status: FlowStatus.INACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['focus', 'daily', 'routine'],
    config: deepWorkFsm,
  },
  {
    name: 'Workday Dev Window',
    description: 'Scheduled Mutex (10:00–19:00): размечает рабочее окно в flow_sessions, не отсекая запись истории.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['schedule', 'mutex', 'workday'],
    orchestratorRules: {
      schedule: {
        enabled: true,
        windows: [{ days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' }],
      },
    },
  },
  {
    name: 'Antigravity Session Lock',
    description: 'Мьютекс активной сессии программирования с автоматическим таймаутом аренды (5 мин).',
    type: FlowType.MUTEX,
    status: FlowStatus.INACTIVE,
    isExclusive: true,
    folder: 'focus_modes',
    tags: ['dev', 'antigravity', 'mutex'],
    orchestratorRules: {
      leaseTimeoutSeconds: 300,
      onConflict: 'reject',
    },
  },
  {
    name: 'Antigravity Work Log',
    description: 'Непрерывный поток-приемник логов и событий разработки (хранит слепок активных сессий).',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'focus_modes',
    tags: ['dev', 'antigravity', 'telemetry'],
  },
  {
    name: 'Token Refresh Engine',
    description: 'Periodically refreshes auth tokens before they expire.',
    type: FlowType.TIMER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'workspace.core',
    tags: ['auth', 'security', 'routine'],
    config: { intervalSeconds: 3300 },
  },
  {
    name: 'Webhook Ingestion Router',
    description: 'Observes incoming webhook streams and routes them to handlers.',
    type: FlowType.OBSERVER,
    status: FlowStatus.PAUSED,
    isExclusive: false,
    folder: 'event_hooks',
    tags: ['webhook', 'stream', 'fsm'],
  },
  {
    name: 'Memory Compactor',
    description: 'Compacts in-memory caches to reclaim resources.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'infrastructure',
    tags: ['infrastructure', 'mutex', 'routine'],
  },
  {
    name: 'Стиральный порошок',
    description: 'Бытовой мьютекс наличия ресурса в доме (контейнер home.supplies).',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'local_laundry_service',
        room: 'Ванная',
        expectedDays: 30,
        unitHint: 'Упаковка 3 кг',
      },
    },
  },
  {
    name: 'Хлеб и выпечка',
    description: 'Ежедневный ресурс кухни. Когда мьютекс выключается — попадает в список покупок.',
    type: FlowType.MUTEX,
    status: FlowStatus.INACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'bakery_dining',
        room: 'Кухня',
        expectedDays: 3,
        unitHint: 'Свежая буханка',
      },
    },
  },
  {
    name: 'Запасы кухни: Чай и Кофе',
    description: 'Мьютекс наличия базовых запасов напитков на кухне.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'coffee',
        room: 'Кухня',
        expectedDays: 14,
        unitHint: 'Пачка 250 г',
      },
    },
  },
  {
    name: 'Субботняя уборка и полив цветов',
    description: 'Scheduled Mutex: активирует окно домашней рутины по выходным с 10:00 до 14:00.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.routines',
    tags: ['home', 'routine', 'schedule'],
    config: {
      widget: {
        kind: 'routine',
        icon: 'cleaning_services',
        room: 'Весь дом',
        scheduleLabel: 'Сб–Вс, 10:00–14:00',
      },
    },
    orchestratorRules: {
      schedule: {
        enabled: true,
        windows: [{ days: [6, 0], start: '10:00', end: '14:00' }],
      },
    },
  },
];

async function main() {
  const defaultProfile = await prisma.profile.upsert({
    where: { handle: 'default' },
    update: {},
    create: {
      handle: 'default',
      displayName: 'Мой Дом (Основной)',
      avatarIcon: 'home',
    },
  });

  // Attach any pre-existing unowned folders/flows to the default profile
  await prisma.$executeRaw`
    DELETE FROM folders a USING folders b
    WHERE a.profile_id IS NULL AND b.profile_id = ${defaultProfile.id}::uuid AND a.path = b.path`;
  await prisma.$executeRaw`UPDATE folders SET profile_id = ${defaultProfile.id}::uuid WHERE profile_id IS NULL`;
  await prisma.flow.updateMany({
    where: { profileId: null },
    data: { profileId: defaultProfile.id },
  });

  const folderIds = new Map<string, string>();
  for (const f of FOLDERS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM folders WHERE path = ${f.path}::ltree AND profile_id = ${defaultProfile.id}::uuid`;
    if (existing[0]) {
      folderIds.set(f.path, existing[0].id);
      continue;
    }
    const id = randomUUID();
    const parentPath = f.path.includes('.') ? f.path.slice(0, f.path.lastIndexOf('.')) : null;
    const parentId = parentPath ? folderIds.get(parentPath) ?? null : null;
    await prisma.$executeRaw`
      INSERT INTO folders (id, name, parent_id, profile_id, path, updated_at)
      VALUES (${id}::uuid, ${f.name}, ${parentId}::uuid, ${defaultProfile.id}::uuid, ${f.path}::ltree, now())`;
    folderIds.set(f.path, id);
  }

  for (const f of FLOWS) {
    const existingFlow = await prisma.flow.findFirst({ where: { name: f.name, profileId: defaultProfile.id } });
    if (existingFlow) {
      if ((f as any).config && !existingFlow.config) {
        await prisma.flow.update({
          where: { id: existingFlow.id },
          data: { config: (f as any).config, orchestratorRules: (f as any).orchestratorRules },
        });
      }
      continue;
    }
    const flow = await prisma.flow.create({
      data: {
        name: f.name,
        description: f.description,
        type: f.type,
        status: f.status,
        isExclusive: f.isExclusive,
        folderId: folderIds.get(f.folder),
        profileId: defaultProfile.id,
        config: (f as any).config,
        orchestratorRules: (f as any).orchestratorRules,
        tags: {
          create: f.tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
    });
    if (f.status === FlowStatus.ACTIVE) {
      await prisma.flowSession.create({ data: { flowId: flow.id } });
    }
  }
  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
