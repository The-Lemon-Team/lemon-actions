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
    description: 'Стиральный автомат-порошок. Счётчик в килограммах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'local_laundry_service',
        room: 'Ванная',
        brand: 'Tide Color Automat',
        unitHint: '3 кг (пакет)',
        price: '650 ₽',
        expectedDays: 30,
        currentQty: 3,
        maxQty: 4.5,
        unit: 'кг',
        step: 0.5,
        daysPerUnit: 10,
        note: 'Счётчик стирального порошка в килограммах',
      },
    },
  },
  {
    name: 'Мыло',
    description: 'Туалетное мыло для рук и тела. Поштучный счётчик брусков.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'soap',
        room: 'Ванная',
        brand: 'Dove Красота и уход',
        unitHint: 'Бруски (штучно)',
        price: '90 ₽',
        expectedDays: 30,
        currentQty: 4,
        maxQty: 6,
        unit: 'шт',
        step: 1,
        daysPerUnit: 10,
        note: 'Поштучный расход брусков мыла',
      },
    },
  },
  {
    name: 'Влажные салфетки',
    description: 'Влажные гигиенические и очищающие салфетки. Простой мьютекс наличия (ON/OFF).',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'clean_hands',
        room: 'Ванная',
        brand: 'Aura Family с алоэ',
        unitHint: '1 пачка (наличие)',
        price: '110 ₽',
        expectedDays: 14,
        currentQty: 1,
        maxQty: 1,
        unit: 'шт',
        step: 1,
        daysPerUnit: 14,
        note: 'Простой мьютекс наличия (ON/OFF). При выключении закрывается сессия и пишется история в flow_events/flow_sessions.',
      },
    },
  },
  {
    name: 'Санокс',
    description: 'Чистящий гель Санокс для сантехники и ванны. Простой мьютекс наличия (ON/OFF).',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'cleaning_services',
        room: 'Ванная',
        brand: 'Санокс Ультра Гель',
        unitHint: '1 флакон 750 мл',
        price: '160 ₽',
        expectedDays: 30,
        currentQty: 1,
        maxQty: 1,
        unit: 'шт',
        step: 1,
        daysPerUnit: 30,
        note: 'Простой мьютекс наличия (ON/OFF). Фиксирует историю сессий от покупки до исчерпания.',
      },
    },
  },
  {
    name: 'Гель для мытья посуды',
    description: 'Концентрированное средство для мытья посуды. Счётчик в литрах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'wash',
        room: 'Ванная',
        brand: 'Fairy Сочный лимон',
        unitHint: 'Флакон 1.5 л',
        price: '230 ₽',
        expectedDays: 30,
        currentQty: 1.5,
        maxQty: 2,
        unit: 'л',
        step: 0.5,
        daysPerUnit: 20,
        note: 'Счётчик расхода в литрах (шаг 0.5 л)',
      },
    },
  },
  {
    name: 'Губки',
    description: 'Поролоновые губки с абразивным слоем для мытья и уборки. Поштучный счётчик.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'layers',
        room: 'Ванная',
        brand: 'Фрекен БОК',
        unitHint: 'Упаковка 10 шт',
        price: '120 ₽',
        expectedDays: 30,
        currentQty: 6,
        maxQty: 10,
        unit: 'шт',
        step: 1,
        daysPerUnit: 5,
        note: 'Поштучный расход губок для уборки',
      },
    },
  },
  {
    name: 'Тряпки',
    description: 'Салфетки и тряпки из микрофибры/вискозы для сухой и влажной уборки. Поштучный счётчик.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'dry',
        room: 'Ванная',
        brand: 'Микрофибра универсальная',
        unitHint: 'Салфетки (штучно)',
        price: '180 ₽',
        expectedDays: 30,
        currentQty: 4,
        maxQty: 6,
        unit: 'шт',
        step: 1,
        daysPerUnit: 10,
        note: 'Поштучный учёт салфеток и тряпок для уборки',
      },
    },
  },
  {
    name: 'Средство для мытья плиты',
    description: 'Антижир для очистки кухонных плит, духовок и решёток. Простой мьютекс наличия (ON/OFF).',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'sanitizer',
        room: 'Ванная',
        brand: 'Azelit Антижир гель',
        unitHint: '1 флакон 600 мл',
        price: '210 ₽',
        expectedDays: 45,
        currentQty: 1,
        maxQty: 1,
        unit: 'шт',
        step: 1,
        daysPerUnit: 45,
        note: 'Простой мьютекс наличия (ON/OFF). При выключении закрывается сессия и добавляется в список покупок.',
      },
    },
  },
  {
    name: 'Железные губки',
    description: 'Металлические мочалки/скребки из нержавеющей стали для сложных загрязнений. Поштучный счётчик.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'bath', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'brush',
        room: 'Ванная',
        brand: 'Чистюля металлические',
        unitHint: 'Скребки металлические (штучно)',
        price: '95 ₽',
        expectedDays: 30,
        currentQty: 3,
        maxQty: 4,
        unit: 'шт',
        step: 1,
        daysPerUnit: 15,
        note: 'Поштучный расход металлических мочалок',
      },
    },
  },
  {
    name: 'Чай в пакетиках',
    description: 'Порционный чай в пакетиках. Счётчик поштучного расхода.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'emoji_food_beverage',
        room: 'Кухня',
        brand: 'Greenfield Golden Ceylon',
        unitHint: '100 пакетиков',
        price: '380 ₽',
        expectedDays: 30,
        currentQty: 85,
        maxQty: 100,
        unit: 'пак',
        step: 1,
        daysPerUnit: 0.3,
        note: 'Поштучный расход чайных пакетиков',
      },
    },
  },
  {
    name: 'Чай листовой',
    description: 'Крупнолистовой чай для заварочного чайника. Счётчик граммовки.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'spa',
        room: 'Кухня',
        brand: 'Ассам Mokalbari TGFOP',
        unitHint: '200 г (пачка)',
        price: '450 ₽',
        expectedDays: 20,
        currentQty: 160,
        maxQty: 200,
        unit: 'г',
        step: 10,
        daysPerUnit: 0.5,
        note: 'Расход граммовки: порция заварки 10 г',
      },
    },
  },
  {
    name: 'Буханка хлеба',
    description: 'Свежий хлеб на кухне. Поштучный учёт буханок.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'bakery_dining',
        room: 'Кухня',
        brand: 'Бородинский подовый',
        unitHint: '1 буханка (400 г)',
        price: '58 ₽',
        expectedDays: 3,
        currentQty: 1,
        maxQty: 2,
        unit: 'бух',
        step: 1,
        daysPerUnit: 2,
        note: 'Свежая выпечка к столу',
      },
    },
  },
  {
    name: 'Кетчуп',
    description: 'Томатный кетчуп в дой-паке. Учёт пачками.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'soup_kitchen',
        room: 'Кухня',
        brand: 'Heinz Томатный',
        unitHint: '350 г (пачка)',
        price: '120 ₽',
        expectedDays: 14,
        currentQty: 1,
        maxQty: 2,
        unit: 'пач',
        step: 1,
        daysPerUnit: 14,
        note: 'Учёт целыми пачками / дой-паками',
      },
    },
  },
  {
    name: 'Утка',
    description: 'Простой мьютекс наличия: включён (ACTIVE) = есть дома, выключен (INACTIVE) = съедена/закончилась. Записывает историю сессий и событий до полного окончания.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'mutex'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'dinner_dining',
        room: 'Кухня',
        brand: 'Фермерская утка с яблоками',
        unitHint: '1 тушка',
        price: '1200 ₽',
        expectedDays: 3,
        currentQty: 1,
        maxQty: 1,
        unit: 'шт',
        step: 1,
        daysPerUnit: 3,
        note: 'Простой мьютекс наличия. Фиксирует сессии и события от появления до полного окончания.',
      },
    },
  },
  {
    name: 'Сало',
    description: 'Запас домашнего сала в морозилке. Штучный учёт брикетов.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'lunch_dining',
        room: 'Кухня',
        brand: 'Белорусское с чесноком',
        unitHint: 'Брикеты по 300 г',
        price: '320 ₽',
        expectedDays: 30,
        currentQty: 3,
        maxQty: 4,
        unit: 'брик',
        step: 1,
        daysPerUnit: 10,
        note: 'Штучный учёт брикетов в морозильной камере',
      },
    },
  },
  {
    name: 'Лимон',
    description: 'Свежие лимоны. Поштучный счётчик плодов.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'nutrition',
        room: 'Кухня',
        brand: 'Узбекские сочные',
        unitHint: 'Штучно (4-6 шт)',
        price: '140 ₽',
        expectedDays: 12,
        currentQty: 4,
        maxQty: 6,
        unit: 'шт',
        step: 1,
        daysPerUnit: 3,
        note: 'Поштучный расход к чаю и блюдам',
      },
    },
  },
  {
    name: 'Молоко',
    description: 'Пастеризованное молоко. Счётчик в литрах с шагом 0.5 л.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'local_drink',
        room: 'Кухня',
        brand: 'Простоквашино 3.2%',
        unitHint: 'Бутылки по 1 л',
        price: '89 ₽',
        expectedDays: 4,
        currentQty: 2,
        maxQty: 3,
        unit: 'л',
        step: 0.5,
        daysPerUnit: 2,
        note: 'Порционный расход по 0.5 л',
      },
    },
  },
  {
    name: 'Мука',
    description: 'Пшеничная мука высшего сорта. Учёт запаса в килограммах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'grain',
        room: 'Кухня',
        brand: 'Макфа пшеничная высший сорт',
        unitHint: 'Пакеты по 2 кг',
        price: '110 ₽',
        expectedDays: 30,
        currentQty: 2.5,
        maxQty: 4,
        unit: 'кг',
        step: 0.5,
        daysPerUnit: 7,
        note: 'Списание по 0.5 кг на выпечку',
      },
    },
  },
  {
    name: 'Сахар',
    description: 'Сахар-песок. Счётчик запаса в килограммах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'scatter_plot',
        room: 'Кухня',
        brand: 'Сахар белый свекловичный',
        unitHint: 'Пакеты по 1 кг',
        price: '65 ₽',
        expectedDays: 30,
        currentQty: 2,
        maxQty: 3,
        unit: 'кг',
        step: 0.5,
        daysPerUnit: 10,
        note: 'Счётчик в килограммах (шаг 0.5 кг)',
      },
    },
  },
  {
    name: 'Гречка',
    description: 'Гречневая крупа ядрица отборная. Счётчик расхода в килограммах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'rice_bowl',
        room: 'Кухня',
        brand: 'Мистраль Ядрица Отборная',
        unitHint: 'Пакеты по 900 г / 1 кг',
        price: '95 ₽',
        expectedDays: 24,
        currentQty: 1.5,
        maxQty: 3,
        unit: 'кг',
        step: 0.5,
        daysPerUnit: 8,
        note: 'Списание порциями по 0.5 кг',
      },
    },
  },
  {
    name: 'Рис',
    description: 'Рис шлифованный круглозерный/длиннозерный. Счётчик запаса в килограммах.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'home.supplies',
    tags: ['home', 'kitchen', 'supplies', 'counter'],
    config: {
      widget: {
        kind: 'supply',
        icon: 'rice_bowl',
        room: 'Кухня',
        brand: 'Мистраль Кубань',
        unitHint: 'Пакеты по 900 г / 1 кг',
        price: '115 ₽',
        expectedDays: 24,
        currentQty: 2,
        maxQty: 3,
        unit: 'кг',
        step: 0.5,
        daysPerUnit: 8,
        note: 'Списание порциями по 0.5 кг на гарниры и плов',
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
      if ((f as any).config) {
        await prisma.flow.update({
          where: { id: existingFlow.id },
          data: {
            description: f.description,
            config: (f as any).config,
            orchestratorRules: (f as any).orchestratorRules,
          },
        });
      }
      if (f.status === FlowStatus.ACTIVE) {
        const openSession = await prisma.flowSession.findFirst({
          where: { flowId: existingFlow.id, endedAt: null },
        });
        if (!openSession) {
          await prisma.flowSession.create({ data: { flowId: existingFlow.id } });
        }
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
      await prisma.flowEvent.create({
        data: {
          flowId: flow.id,
          source: 'lemon-seed',
          eventType: 'RESTOCKED',
          payload: { action: 'initial_stock_seeded', currentQty: (f as any).config?.widget?.currentQty },
        },
      });
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
