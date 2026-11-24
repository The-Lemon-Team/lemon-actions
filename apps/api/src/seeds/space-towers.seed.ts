import { FlowStatus, FlowType } from '@prisma/client';
import { SeedFlow, SeedFolder } from './seed.types';

export const SPACE_FOLDERS: SeedFolder[] = [
  { name: 'Lemon Space', path: 'space' },
  { name: 'Главный Эмитент (Genesis Core)', path: 'space.emitter' },
  { name: 'Башни Стихий (4 Towers)', path: 'space.towers' },
  { name: 'Башня Земли (Earth — Design & Clay)', path: 'space.towers.earth' },
  { name: 'Башня Воды (Water — Streams & Bus)', path: 'space.towers.water' },
  { name: 'Башня Огня (Fire — Code, Cards & AI)', path: 'space.towers.fire' },
  { name: 'Башня Воздуха (Air — Architecture, Specs & Lore)', path: 'space.towers.air' },
];

export const SPACE_TOWER_FLOWS: SeedFlow[] = [
  // =========================================================================
  // 0. ГЛАВНЫЙ ЭМИТЕНТ (Genesis Core — Мастер-АИ)
  // Выдаёт первые задачи и валюту (Ancient Point / Golden Ancient Point);
  // выполненные стартовые таски остаются закреплёнными за Главным Эмитентом.
  // =========================================================================
  {
    name: 'Главный Эмитент: Статус Биржи (Открыто / Закрыто)',
    description: 'Переключатель Открыто/Закрыто центральной биржи Мастера-АИ.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.emitter',
    tags: ['lemon-space', 'emitter', 'genesis', 'mutex', 'open-close'],
    config: {
      cardRole: 'OPEN_CLOSE_SWITCH',
      isOpen: true,
      labelOpen: 'ОТКРЫТО',
      labelClosed: 'ЗАКРЫТО',
    },
  },
  {
    name: 'Главный Эмитент: Монетный Двор и Реестр Задач',
    description:
      'Первичная эмиссия Ancient Point (AP) и Golden Ancient Point (GAP). Все выданные и выполненные стартовые таски остаются закреплёнными за Главным Эмитентом.',
    type: FlowType.PROJECTION,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.emitter',
    tags: ['lemon-space', 'emitter', 'mint', 'wallet', 'projection', 'tasks-registry'],
    config: {
      cardRole: 'EMITTER_MINT_AND_REGISTRY',
      reducer: 'WALLET_AND_TASKS',
      issuerId: 'genesis-emitter',
      retainCompletedOnEmitter: true,
      currencies: ['ancient_point', 'golden_ancient_point', 'fire_point'],
      projectionState: {
        balances: {
          ancient_point: 10000,
          golden_ancient_point: 2500,
          fire_point: 1000,
        },
        participants: [
          {
            actorId: 'actor-master-ai',
            actorName: 'Мастер-АИ (Lemon Space)',
            role: 'EMITTER_GM',
            element: 'GENESIS',
            source: 'FOUNDER',
          },
        ],
        emitterTasks: [
          {
            taskId: 'bounty-1-lemon-space-app',
            title: 'Сделать приложение Lemon-Space (Prototype + Management + Dev + Design)',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 1200,
            currency: 'ancient_point',
            rewards: [{ currency: 'ancient_point', amount: 1200 }],
            status: 'OPEN',
            claimedByTower: null,
            assigneeActorId: 'actor-master-ai',
            assignedParticipants: ['actor-master-ai'],
            steps: [
              { stepId: 'step-1', title: 'Prototype 4 Башен', status: 'PENDING', assigneeActorId: null },
              { stepId: 'step-2', title: 'Management и экономика AP/GAP', status: 'PENDING', assigneeActorId: null },
              { stepId: 'step-3', title: 'Dev (Frontend / Backend)', status: 'PENDING', assigneeActorId: null },
              { stepId: 'step-4', title: 'Design и атмосфера космоса', status: 'PENDING', assigneeActorId: null },
            ],
          },
          {
            taskId: 'bounty-2-lemon-actions-bus',
            title: 'Разработать шину событий для Lemon Actions (Lemon Stack)',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 500,
            currency: 'golden_ancient_point',
            rewards: [{ currency: 'golden_ancient_point', amount: 500 }],
            status: 'COMPLETED',
            claimedByTower: 'AIR',
            assigneeActorId: 'actor-easy',
            assignedParticipants: ['actor-easy', 'actor-antigravity-agent'],
            steps: [
              { stepId: 'step-1', title: 'Проектирование Kafka-like топиков шины', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-2', title: 'Устранение heartbeats (media.created)', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-3', title: 'Интеграция событий lemon-projectarium', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-4', title: 'Flow-селекторы Observer в lemon-core', status: 'DONE', assigneeActorId: 'actor-easy' },
            ],
          },
          {
            taskId: 'bounty-3-tower-cards-constructor',
            title:
              'Проверить карточки башен Lemon Actions + Конструктор добавления любых flow в карточку',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 400,
            currency: 'ancient_point',
            rewards: [
              { currency: 'ancient_point', amount: 400 },
              { currency: 'golden_ancient_point', amount: 200 },
            ],
            status: 'IN_PROGRESS',
            claimedByTower: 'AIR',
            assigneeActorId: 'actor-easy',
            assignedParticipants: ['actor-easy'],
            steps: [
              { stepId: 'step-1', title: 'Проверить карточки башен и модель пула тасок персонажей', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-2', title: 'Внедрить единый пул с фильтрами (actorId/status) и steps', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-3', title: 'Собрать конструктор добавления любых flow в карточку', status: 'IN_PROGRESS', assigneeActorId: 'actor-easy' },
            ],
          },
          {
            taskId: 'bounty-4-fire-tower-cards-app',
            title:
              'Выделить карточки башен в отдельное приложение или перенести в lemon-space / создать отдельный борд',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 300,
            currency: 'ancient_point',
            rewards: [
              { currency: 'ancient_point', amount: 300 },
              { currency: 'fire_point', amount: 100 },
            ],
            status: 'IN_PROGRESS',
            claimedByTower: 'FIRE',
            assigneeActorId: 'actor-ansy',
            assignedParticipants: ['actor-ansy'],
            steps: [
              { stepId: 'step-1', title: 'Сформировать варианты размещения (standalone / lemon-space / борд)', status: 'IN_PROGRESS', assigneeActorId: 'actor-ansy' },
              { stepId: 'step-2', title: 'Согласовать UX и структуру 4 Башен с Воздухом', status: 'PENDING', assigneeActorId: 'actor-ansy' },
              { stepId: 'step-3', title: 'Реализовать и подключить к live API', status: 'PENDING', assigneeActorId: 'actor-ansy' },
            ],
          },
          {
            taskId: 'bounty-5-timelines-mcp',
            title: 'Написать MCP для Timelines (Lemon Universe)',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 500,
            currency: 'ancient_point',
            rewards: [{ currency: 'ancient_point', amount: 500 }],
            status: 'OPEN',
            claimedByTower: null,
            assigneeActorId: 'actor-master-ai',
            assignedParticipants: ['actor-master-ai'],
            steps: [
              { stepId: 'step-1', title: 'Описать MCP-инструменты для boards, notes, cross-links и profiles', status: 'PENDING', assigneeActorId: null },
              { stepId: 'step-2', title: 'Подключить к API Timelines (192.168.1.100:3010/api)', status: 'PENDING', assigneeActorId: null },
              { stepId: 'step-3', title: 'Протестировать вызовы через агента', status: 'PENDING', assigneeActorId: null },
            ],
          },
          {
            taskId: 'bounty-6-bus-lightweight-heartbeats',
            title: 'Решить проблему тяжёлых heartbeats через Lemon Stack Bus',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 100,
            currency: 'golden_ancient_point',
            rewards: [{ currency: 'golden_ancient_point', amount: 100 }],
            status: 'COMPLETED',
            claimedByTower: 'AIR',
            assigneeActorId: 'actor-easy',
            assignedParticipants: ['actor-easy', 'actor-antigravity-agent'],
            steps: [
              { stepId: 'step-1', title: 'Заменить full-stand persist в Projectarium heartbeat на точечный update и coalesced событие шины', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-2', title: 'Убрать лишние full-persist перезаписи в фоновом pingStand при неизменном статусе', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-3', title: 'Подключить coalesced agent.heartbeat в CodeTasksService к @lemon/stack-bus с dedupKey', status: 'DONE', assigneeActorId: 'actor-easy' },
            ],
          },
          {
            taskId: 'bounty-7-media-ai-bus-migration',
            title: 'Перевод lemon-media-hub и lemon-ai-service на NATS JetStream (@lemon/stack-bus) и отказ от прямого SSE',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 150,
            currency: 'golden_ancient_point',
            rewards: [{ currency: 'golden_ancient_point', amount: 150 }],
            status: 'COMPLETED',
            claimedByTower: 'AIR',
            assigneeActorId: 'actor-easy',
            assignedParticipants: ['actor-easy', 'actor-antigravity-agent'],
            steps: [
              { stepId: 'step-1', title: 'MediaStackBusService: публикация media.* и folder.* в LEMON_STACK_BUS с dedupKey', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-2', title: 'AiStackBusService и MediaBridgeService: подписка на lemon.media-hub.media.> + события image.*/text.*', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-3', title: 'MediaService: удаление backend SSE (/api/media/stream) и трансляция UI-потока из StackBus', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-4', title: 'Кросс-сервисный тест lemon-media-hub <-> lemon-ai-service на живом NATS JetStream', status: 'DONE', assigneeActorId: 'actor-easy' },
            ],
          },
          {
            taskId: 'bounty-8-projectarium-granular-persistence',
            title: 'Доработка Projectarium: убрать остатки persistProject (массовые deleteMany+createMany) на точечные Prisma-операции',
            issuer: 'genesis-emitter',
            retainedByEmitter: true,
            reward: 200,
            currency: 'ancient_point',
            rewards: [{ currency: 'ancient_point', amount: 200 }],
            status: 'COMPLETED',
            claimedByTower: 'AIR',
            assigneeActorId: 'actor-easy',
            assignedParticipants: ['actor-easy', 'actor-antigravity-agent'],
            steps: [
              { stepId: 'step-1', title: 'Заменить вызовы persistProject на точечные upsert/delete отдельных записей стенда', status: 'DONE', assigneeActorId: 'actor-easy' },
              { stepId: 'step-2', title: 'Разбить multi-statement CREATE TABLE в TimelinesSyncService.ensureSchema()', status: 'DONE', assigneeActorId: 'actor-antigravity-agent' },
              { stepId: 'step-3', title: 'Проверить тестами и на реальной БД отсутствие массового deleteMany+createMany при мутациях', status: 'DONE', assigneeActorId: 'actor-easy' },
            ],
          },
        ],
        canPublishOwnLots: true,
        eventsCount: 8,
      },
    },
  },
  {
    name: 'Главный Эмитент: Шина Выдачи Заданий',
    description: 'Наблюдатель откликов башен на стартовые задачи и триггер выплаты валюты.',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.emitter',
    tags: ['lemon-space', 'emitter', 'observer', 'event-bus'],
    config: {
      cardRole: 'EVENT_SELECTOR',
      selector: {
        topics: ['bounty.claimed', 'bounty.verified', 'emitter.mint'],
      },
    },
  },

  // =========================================================================
  // 1. 🜃 БАШНЯ ЗЕМЛИ (Earth — Дизайн, UI/UX, Макеты и Форма)
  // =========================================================================
  {
    name: 'Башня Земли: Статус (Открыто / Закрыто)',
    description: 'Простой переключатель Открыто/Закрыто для приёма задач и участников Башни Земли.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.earth',
    tags: ['lemon-space', 'tower', 'earth', 'mutex', 'open-close'],
    config: {
      cardRole: 'OPEN_CLOSE_SWITCH',
      towerElement: 'EARTH',
      emoji: '🜃',
      isOpen: true,
    },
  },
  {
    name: 'Башня Земли: Казна, Склад и Participants',
    description:
      'Кошелёк AP/GAP, склад профильного ресурса (Дизайны / CLAY) и список участников (participants) стихии Земли.',
    type: FlowType.PROJECTION,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.earth',
    tags: ['lemon-space', 'tower', 'earth', 'wallet', 'storage', 'participants', 'projection'],
    config: {
      cardRole: 'TOWER_VAULT_AND_PARTICIPANTS',
      towerElement: 'EARTH',
      emoji: '🜃',
      domain: 'Дизайн, UI/UX, Макеты, SVG и Форма',
      defaultResource: 'CLAY',
      maxCapacity: 50,
      allowNegative: false,
      projectionState: {
        balances: {
          ancient_point: 0,
          golden_ancient_point: 0,
        },
        resources: {
          CLAY: {
            code: 'CLAY',
            name: 'Дизайны / Макеты (Глина)',
            symbol: '🎨',
            current: 0,
            maxCapacity: 50,
          },
        },
        participants: [],
        claimedEmitterTasks: [],
        canPublishOwnLots: false,
        eventsCount: 0,
      },
    },
  },
  {
    name: 'Башня Земли: Селектор Задач Стихии',
    description: 'Слушает задачи Главного Эмитента по дизайну/UI и собственные лоты Башни Земли.',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.earth',
    tags: ['lemon-space', 'tower', 'earth', 'observer', 'design'],
    config: {
      cardRole: 'EVENT_SELECTOR',
      towerElement: 'EARTH',
      selector: {
        tags: ['earth', 'земля', 'design', 'svg', 'ui'],
      },
    },
  },

  // =========================================================================
  // 2. 🜄 БАШНЯ ВОДЫ (Water — Backend, Event-Шина, Потоки и API)
  // =========================================================================
  {
    name: 'Башня Воды: Статус (Открыто / Закрыто)',
    description: 'Простой переключатель Открыто/Закрыто для приёма задач и участников Башни Воды.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.water',
    tags: ['lemon-space', 'tower', 'water', 'mutex', 'open-close'],
    config: {
      cardRole: 'OPEN_CLOSE_SWITCH',
      towerElement: 'WATER',
      emoji: '🜄',
      isOpen: true,
    },
  },
  {
    name: 'Башня Воды: Казна, Склад и Participants',
    description:
      'Кошелёк AP/GAP, склад профильного ресурса (Потоки / DEW) и список участников (participants) стихии Воды.',
    type: FlowType.PROJECTION,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.water',
    tags: ['lemon-space', 'tower', 'water', 'wallet', 'storage', 'participants', 'projection'],
    config: {
      cardRole: 'TOWER_VAULT_AND_PARTICIPANTS',
      towerElement: 'WATER',
      emoji: '🜄',
      domain: 'Backend, Event-Шина, Потоки данных и API',
      defaultResource: 'DEW',
      maxCapacity: 50,
      allowNegative: false,
      projectionState: {
        balances: {
          ancient_point: 0,
          golden_ancient_point: 0,
        },
        resources: {
          DEW: {
            code: 'DEW',
            name: 'Потоки / Контракты Шины (Роса)',
            symbol: '🔌',
            current: 1,
            maxCapacity: 50,
          },
        },
        participants: [
          {
            actorId: 'actor-antigravity-agent',
            actorName: 'Antigravity Agent',
            role: 'CODING_AGENT',
            element: 'WATER',
            source: 'EMITTER_QUEST',
          },
        ],
        claimedEmitterTasks: [],
        canPublishOwnLots: false,
        eventsCount: 0,
      },
    },
  },
  {
    name: 'Башня Воды: Селектор Задач Стихии',
    description: 'Слушает задачи Главного Эмитента по потокам/шине и собственные лоты Башни Воды.',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.water',
    tags: ['lemon-space', 'tower', 'water', 'observer', 'event-bus'],
    config: {
      cardRole: 'EVENT_SELECTOR',
      towerElement: 'WATER',
      selector: {
        tags: ['water', 'вода', 'event-bus', 'streams', 'api', 'backend'],
      },
    },
  },

  // =========================================================================
  // 3. 🜂 БАШНЯ ОГНЯ (Fire — Frontend, Карточки, Менеджмент Уюта & AI)
  // =========================================================================
  {
    name: 'Башня Огня: Статус (Открыто / Закрыто)',
    description: 'Простой переключатель Открыто/Закрыто для приёма задач и участников Башни Огня.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.fire',
    tags: ['lemon-space', 'tower', 'fire', 'mutex', 'open-close'],
    config: {
      cardRole: 'OPEN_CLOSE_SWITCH',
      towerElement: 'FIRE',
      emoji: '🜂',
      isOpen: true,
    },
  },
  {
    name: 'Башня Огня: Казна, Склад и Participants',
    description:
      'Кошелёк AP/GAP/FP, склад профильного ресурса (Модули / EMBER) и список участников (participants) стихии Огня.',
    type: FlowType.PROJECTION,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.fire',
    tags: ['lemon-space', 'tower', 'fire', 'wallet', 'storage', 'participants', 'projection'],
    config: {
      cardRole: 'TOWER_VAULT_AND_PARTICIPANTS',
      towerElement: 'FIRE',
      emoji: '🜂',
      domain: 'Frontend, Выделение карточек в Lemon-Space, AI и Командный Уют',
      defaultResource: 'EMBER',
      maxCapacity: 50,
      allowNegative: false,
      projectionState: {
        balances: {
          ancient_point: 0,
          golden_ancient_point: 0,
          fire_point: 0,
        },
        resources: {
          EMBER: {
            code: 'EMBER',
            name: 'Модули / Искры Кода (Искра)',
            symbol: '⚡',
            current: 0,
            maxCapacity: 50,
          },
        },
        participants: [
          {
            actorId: 'actor-ansy',
            actorName: 'Анси (Ansy)',
            role: 'BUSINESS_MANAGER',
            element: 'FIRE',
            source: 'EMITTER_QUEST',
          },
        ],
        claimedEmitterTasks: ['bounty-4-fire-tower-cards-app'],
        canPublishOwnLots: false,
        eventsCount: 1,
      },
    },
  },
  {
    name: 'Башня Огня: Селектор Задач Стихии',
    description: 'Слушает задачи Главного Эмитента по карточкам, фронтенду, AI и развитию Башни Огня.',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.fire',
    tags: ['lemon-space', 'tower', 'fire', 'observer', 'frontend', 'cards', 'ai'],
    config: {
      cardRole: 'EVENT_SELECTOR',
      towerElement: 'FIRE',
      selector: {
        tags: ['fire', 'огонь', 'frontend', 'cards', 'lemon-space', 'ai'],
      },
    },
  },

  // =========================================================================
  // 4. 🜁 БАШНЯ ВОЗДУХА (Air — Архитектура, Конструктор Flow, Спеки и Хроники)
  // =========================================================================
  {
    name: 'Башня Воздуха: Статус (Открыто / Закрыто)',
    description: 'Простой переключатель Открыто/Закрыто для приёма задач и участников Башни Воздуха.',
    type: FlowType.MUTEX,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.air',
    tags: ['lemon-space', 'tower', 'air', 'mutex', 'open-close'],
    config: {
      cardRole: 'OPEN_CLOSE_SWITCH',
      towerElement: 'AIR',
      emoji: '🜁',
      isOpen: true,
    },
  },
  {
    name: 'Башня Воздуха: Казна, Склад и Participants',
    description:
      'Кошелёк AP/GAP, склад профильного ресурса (Спеки / BREEZE) и список участников (participants) стихии Воздуха.',
    type: FlowType.PROJECTION,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.air',
    tags: ['lemon-space', 'tower', 'air', 'wallet', 'storage', 'participants', 'projection'],
    config: {
      cardRole: 'TOWER_VAULT_AND_PARTICIPANTS',
      towerElement: 'AIR',
      emoji: '🜁',
      domain: 'Архитектура, Конструктор Flow-карточек, Спеки и Хроники',
      defaultResource: 'BREEZE',
      maxCapacity: 50,
      allowNegative: false,
      projectionState: {
        balances: {
          ancient_point: 200,
          golden_ancient_point: 750,
        },
        resources: {
          BREEZE: {
            code: 'BREEZE',
            name: 'Спеки / Архитектурные Контракты (Бриз)',
            symbol: '📜',
            current: 3,
            maxCapacity: 50,
          },
        },
        participants: [
          {
            actorId: 'actor-easy',
            actorName: 'Easy (Изи)',
            role: 'ARCHITECT',
            element: 'AIR',
            source: 'EMITTER_QUEST',
          },
        ],
        claimedEmitterTasks: [
          'bounty-2-lemon-actions-bus',
          'bounty-3-tower-cards-constructor',
          'bounty-6-bus-lightweight-heartbeats',
          'bounty-7-media-ai-bus-migration',
          'bounty-8-projectarium-granular-persistence',
        ],
        canPublishOwnLots: true,
        eventsCount: 3,
      },
    },
  },
  {
    name: 'Башня Воздуха: Селектор Задач Стихии',
    description: 'Слушает задачи Главного Эмитента по архитектуре, конструктору flow и спекам.',
    type: FlowType.OBSERVER,
    status: FlowStatus.ACTIVE,
    isExclusive: false,
    folder: 'space.towers.air',
    tags: ['lemon-space', 'tower', 'air', 'observer', 'architecture', 'flow-builder'],
    config: {
      cardRole: 'EVENT_SELECTOR',
      towerElement: 'AIR',
      selector: {
        tags: ['air', 'воздух', 'architecture', 'flow-builder', 'specs', 'chronicle'],
      },
    },
  },
];
