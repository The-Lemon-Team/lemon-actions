import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
  ChronicleEventType,
  ProjectChronicleCard,
  ProjectSessionLogEntry,
} from '../models/chronicle-card.models';
import {
  ReactiveTodoListCard,
  ReactiveTodoItem,
  ReactiveTriggerType,
} from '../models/todo-card.models';
import { LemonCardColor } from '../models/worker.models';
import { LemonWorkerService } from './lemon-worker.service';

const CHRONICLE_STORAGE_KEY = 'lemon_actions_chronicle_v1';
const TODOS_STORAGE_KEY = 'lemon_actions_todos_v1';

const INITIAL_CHRONICLE_SEEDS: ProjectChronicleCard[] = [
  {
    id: 'chronicle-core-1',
    projectId: 'workspace.core',
    projectName: 'Ядро & Live Mesh Infrastructure',
    description: 'Центральный шлюз микросервисов, Port Shield, REST API и шина реактивных импульсов',
    color: 'lemon',
    isPinned: true,
    tags: ['PORT_SHIELD', 'LIVE_MESH', 'API', 'v1.4'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalRuns: 142,
      healthyServices: 5,
      activeWorkers: 3,
      lastActivity: 'Только что',
    },
    history: [
      {
        id: 'log-101',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        type: 'DEPLOY',
        author: 'Agent-Antigravity',
        title: 'Развёрнут Port Shield и динамический аллокатор портов 4301+',
        details: 'Реализована изоляция экземпляров с токенами аренды и автоматическое предотвращение коллизий',
        latencyMs: 42,
        badge: 'PORT_SHIELD',
      },
      {
        id: 'log-102',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: 'MILESTONE',
        author: 'System',
        title: 'Подключён Live Service Pool с авто-вытеснением (Circuit Breaker)',
        details: 'Сервисы, упавшие 5 раз подряд, автоматически удаляются из живого пула с записью в нейрон истории',
        latencyMs: 16,
        badge: 'CIRCUIT_BREAKER',
      },
      {
        id: 'log-103',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'SERVICE_EVENT',
        author: 'Agent-Antigravity',
        title: 'Подключена сеть Tailscale: Funnel и LAN',
        details: 'Сервисы распределяются по окружениям DEV, STAGING и PROD с публичными туннелями HTTPS',
        latencyMs: 38,
        badge: 'TAILSCALE',
      },
    ],
  },
  {
    id: 'chronicle-reports-1',
    projectId: 'workspace.reports',
    projectName: 'Отчёты и Генерация Документов',
    description: 'Ежедневная компиляция PDF, экспорт таблиц и доставка сводок через HTTP Webhooks',
    color: 'sky',
    isPinned: true,
    tags: ['PDF_COMPILER', 'DIGEST', 'CRON'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalRuns: 58,
      healthyServices: 1,
      activeWorkers: 2,
      lastActivity: '15 мин назад',
    },
    history: [
      {
        id: 'log-201',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        type: 'MILESTONE',
        author: 'Scheduler',
        title: 'Запущен воркер Daily Neuron Digest & Webhook Sync',
        details: 'CRON расписание: 0 9 * * *, вебхук синхронизирован с облачным агрегатором',
        latencyMs: 184,
        badge: 'CRON',
      },
      {
        id: 'log-202',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: 'WORKER_RUN',
        author: 'Developer',
        title: 'Сформирован сводный отчёт за неделю',
        details: 'Компиляция markdown завершена без ошибок, сгенерирован PDF артефакт',
        latencyMs: 142,
        badge: 'PDF',
      },
    ],
  },
  {
    id: 'chronicle-home-1',
    projectId: 'home.supplies',
    projectName: 'Складские Потоки и Запасы',
    description: 'Автоматический мониторинг расходных материалов, вебхуки заказов и пополнение',
    color: 'sage',
    isPinned: false,
    tags: ['SUPPLIES', 'RESTOCK', 'WEBHOOK'],
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalRuns: 29,
      healthyServices: 1,
      activeWorkers: 1,
      lastActivity: '2 часа назад',
    },
    history: [
      {
        id: 'log-301',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        type: 'SERVICE_EVENT',
        author: 'InventoryBot',
        title: 'Автоматическая проверка остатков на складе',
        details: 'Уровень кофейных зёрен и бумаги в пределах нормы, заказ не требуется',
        latencyMs: 88,
        badge: 'STOCK_OK',
      },
    ],
  },
  {
    id: 'chronicle-agent-1',
    projectId: 'agent.automation',
    projectName: 'Автономные Агенты & MCP Server',
    description: 'Интеграция Model Context Protocol для вызова инструментов и регистрации сервисов',
    color: 'lavender',
    isPinned: false,
    tags: ['MCP', 'JSON_RPC', 'TOOLS'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      totalRuns: 84,
      healthyServices: 3,
      activeWorkers: 2,
      lastActivity: '5 мин назад',
    },
    history: [
      {
        id: 'log-401',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        type: 'DEPLOY',
        author: 'Agent-Antigravity',
        title: 'Запущен MCP сервер lemon-projectarium-mcp',
        details: 'Инструменты: lemon_register_app, lemon_heartbeat, lemon_release_app, lemon_list_apps',
        latencyMs: 24,
        badge: 'MCP_ACTIVE',
      },
    ],
  },
];

const INITIAL_TODO_SEEDS: ReactiveTodoListCard[] = [
  {
    id: 'todo-core-1',
    projectId: 'workspace.core',
    title: 'Реактивный чек-лист запуска и проверки сервисов',
    description: 'Задачи с авто-триггерами реагируют на события шины и Port Shield в реальном времени',
    color: 'lemon',
    isPinned: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        text: 'Зарегистрировать сервис через Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Port Shield Live Event',
        isReactive: true,
        triggerType: 'SERVICE_REGISTERED',
        triggerDescription: 'Срабатывает при вызове registerApp() или MCP инструмента',
      },
      {
        id: 'item-2',
        text: 'Провести раунд проверки сервисов PROJECTION',
        completed: true,
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        completedBy: 'Health Projection Impulse',
        isReactive: true,
        triggerType: 'HEALTHCHECK_PING',
        triggerDescription: 'Срабатывает при клике «Опросить все сервисы»',
      },
      {
        id: 'item-3',
        text: 'Выполнить рабочий цикл любого воркера',
        completed: false,
        isReactive: true,
        triggerType: 'WORKER_TRIGGERED',
        triggerDescription: 'Срабатывает при клике «Запустить сейчас» на карточке воркера',
      },
      {
        id: 'item-4',
        text: 'Проверить изоляцию портов и токенов аренды (lease tokens)',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Аудит безопасности',
        isReactive: false,
      },
      {
        id: 'item-5',
        text: 'Настроить туннель Tailscale Funnel для внешнего вебхука',
        completed: false,
        isReactive: false,
      },
    ],
  },
  {
    id: 'todo-reports-1',
    projectId: 'workspace.reports',
    title: 'Пайплайн сборки ежедневных отчётов',
    description: 'Мониторинг компиляции PDF и отправки сводок во внешнюю аналитику',
    color: 'sky',
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-r1',
        text: 'Запустить воркер компиляции PDF отчёта',
        completed: false,
        isReactive: true,
        triggerType: 'WORKER_TRIGGERED',
        triggerDescription: 'Авто-завершение при выполнении воркера отчётов',
      },
      {
        id: 'item-r2',
        text: 'Сверить контрольные суммы сгенерированных markdown файлов',
        completed: false,
        isReactive: false,
      },
      {
        id: 'item-r3',
        text: 'Синхронизировать внешнюю аналитику через вебхук',
        completed: false,
        isReactive: true,
        triggerType: 'SERVICE_REGISTERED',
        triggerDescription: 'Срабатывает при регистрации аналитического шлюза',
      },
    ],
  },
  {
    id: 'todo-quick-1',
    projectId: 'agent.automation',
    title: 'Быстрые задачи агентов и разработчика',
    description: 'Интеграция MCP и тестирование Circuit Breaker',
    color: 'rose',
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-q1',
        text: 'Проверить статус базы данных PostgreSQL на порту :5433',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        completedBy: 'Developer',
        isReactive: false,
      },
      {
        id: 'item-q2',
        text: 'Запустить стресс-тест Circuit Breaker (5 сбоев подряд)',
        completed: false,
        isReactive: true,
        triggerType: 'CIRCUIT_BREAKER',
        triggerDescription: 'Срабатывает при вытеснении сервиса после 5 сбоев',
      },
      {
        id: 'item-q3',
        text: 'Подтвердить отсутствие конфликтов портов в Port Shield',
        completed: true,
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedBy: 'Port Shield Engine',
        isReactive: true,
        triggerType: 'PORT_SHIELD',
        triggerDescription: 'Срабатывает при валидации пула портов',
      },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class LemonChronicleService {
  private readonly workerService = inject(LemonWorkerService);

  private readonly chronicleCards$ = new BehaviorSubject<ProjectChronicleCard[]>(
    this.loadChronicleCards(),
  );
  private readonly todoCards$ = new BehaviorSubject<ReactiveTodoListCard[]>(this.loadTodoCards());

  /** Impulse toast notifications for the UI */
  readonly impulseToast$ = new Subject<{ message: string; type: ReactiveTriggerType }>();

  readonly allChronicleCards$: Observable<ProjectChronicleCard[]> =
    this.chronicleCards$.asObservable();
  readonly allTodoCards$: Observable<ReactiveTodoListCard[]> = this.todoCards$.asObservable();

  constructor() {
    this.bindReactiveStreams();
  }

  private loadChronicleCards(): ProjectChronicleCard[] {
    try {
      const saved = localStorage.getItem(CHRONICLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_CHRONICLE_SEEDS;
  }

  private persistChronicle(cards: ProjectChronicleCard[]): void {
    try {
      localStorage.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // storage unavailable
    }
    this.chronicleCards$.next(cards);
  }

  private loadTodoCards(): ReactiveTodoListCard[] {
    try {
      const saved = localStorage.getItem(TODOS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_TODO_SEEDS;
  }

  private persistTodos(cards: ReactiveTodoListCard[]): void {
    try {
      localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // storage unavailable
    }
    this.todoCards$.next(cards);
  }

  /**
   * Binds reactive streams from Worker Service & Service Health Service into the reactive Todo & Chronicle engine.
   */
  private bindReactiveStreams(): void {
    // 1. Worker Executions: Auto-completes WORKER_TRIGGERED tasks and logs into Chronicle
    this.workerService.workerTriggered$.subscribe(({ worker, execution }) => {
      this.dispatchReactiveImpulse(
        'WORKER_TRIGGERED',
        `Воркер «${worker.name}» успешно выполнен (${execution.durationMs}ms)`,
      );

      // Add log entry to project chronicle
      const targetProjId = worker.neuronPath.startsWith('workspace.reports')
        ? 'workspace.reports'
        : 'workspace.core';

      this.addLogToProject(targetProjId, {
        id: 'log-' + Math.random().toString(36).substring(2, 7),
        timestamp: execution.finishedAt || new Date().toISOString(),
        type: 'WORKER_RUN',
        author: 'Lemon-Worker-Engine',
        title: `Импульс воркера: ${worker.name}`,
        details: execution.outputSummary,
        latencyMs: execution.durationMs,
        badge: worker.rule.trigger.kind,
      });
    });
  }

  /**
   * Dispatches a reactive impulse across all Todo Cards, auto-checking matching reactive items!
   */
  dispatchReactiveImpulse(triggerType: ReactiveTriggerType, reasonMessage?: string): void {
    const currentTodos = this.todoCards$.getValue();
    let anyChanged = false;
    const now = new Date().toISOString();

    const updatedTodos = currentTodos.map((card) => {
      let cardChanged = false;
      const updatedItems = card.items.map((item) => {
        if (!item.completed && item.isReactive && item.triggerType === triggerType) {
          cardChanged = true;
          anyChanged = true;
          return {
            ...item,
            completed: true,
            completedAt: now,
            completedBy: `Реактивный импульс (${triggerType})`,
          };
        }
        return item;
      });

      return cardChanged ? { ...card, items: updatedItems, updatedAt: now } : card;
    });

    if (anyChanged) {
      this.persistTodos(updatedTodos);
    }

    if (reasonMessage) {
      this.impulseToast$.next({ message: reasonMessage, type: triggerType });
    }
  }

  private addLogToProject(projectId: string, entry: ProjectSessionLogEntry): void {
    const cards = this.chronicleCards$.getValue();
    let found = false;

    const updated = cards.map((card) => {
      if (card.projectId === projectId || (projectId === 'workspace.core' && !found)) {
        found = true;
        const newHistory = [entry, ...card.history.slice(0, 19)]; // keep latest 20 entries
        return {
          ...card,
          updatedAt: new Date().toISOString(),
          metrics: {
            ...card.metrics,
            totalRuns: card.metrics.totalRuns + 1,
            lastActivity: 'Только что',
          },
          history: newHistory,
        };
      }
      return card;
    });

    this.persistChronicle(updated);
  }

  /* -------------------------------------------------------------------------- */
  /* Chronicle Mutations                                                        */
  /* -------------------------------------------------------------------------- */

  addSessionLog(cardId: string, entryData: Omit<ProjectSessionLogEntry, 'id' | 'timestamp'>): void {
    const cards = this.chronicleCards$.getValue();
    const entry: ProjectSessionLogEntry = {
      ...entryData,
      id: 'log-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
    };

    const updated = cards.map((c) =>
      c.id === cardId
        ? {
            ...c,
            updatedAt: new Date().toISOString(),
            metrics: { ...c.metrics, totalRuns: c.metrics.totalRuns + 1, lastActivity: 'Только что' },
            history: [entry, ...c.history],
          }
        : c,
    );

    this.persistChronicle(updated);
  }

  createChronicleCard(cardData: Omit<ProjectChronicleCard, 'id' | 'createdAt' | 'updatedAt'>): void {
    const newCard: ProjectChronicleCard = {
      ...cardData,
      id: 'chronicle-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = this.chronicleCards$.getValue();
    this.persistChronicle([newCard, ...current]);
  }

  togglePinChronicle(id: string): void {
    const current = this.chronicleCards$.getValue();
    const updated = current.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    this.persistChronicle(updated);
  }

  setChronicleColor(id: string, color: LemonCardColor): void {
    const current = this.chronicleCards$.getValue();
    const updated = current.map((c) => (c.id === id ? { ...c, color } : c));
    this.persistChronicle(updated);
  }

  deleteChronicleCard(id: string): void {
    const current = this.chronicleCards$.getValue();
    const updated = current.filter((c) => c.id !== id);
    this.persistChronicle(updated);
  }

  /* -------------------------------------------------------------------------- */
  /* Todo List Mutations                                                        */
  /* -------------------------------------------------------------------------- */

  toggleTodoItem(cardId: string, itemId: string): void {
    const cards = this.todoCards$.getValue();
    const updated = cards.map((card) => {
      if (card.id !== cardId) return card;
      const updatedItems = card.items.map((item) => {
        if (item.id !== itemId) return item;
        const nextCompleted = !item.completed;
        return {
          ...item,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          completedBy: nextCompleted ? 'Пользователь (вручную)' : undefined,
        };
      });
      return { ...card, items: updatedItems, updatedAt: new Date().toISOString() };
    });

    this.persistTodos(updated);
  }

  addTodoItem(
    cardId: string,
    itemData: {
      text: string;
      isReactive: boolean;
      triggerType?: ReactiveTriggerType;
      triggerDescription?: string;
    },
  ): void {
    const cards = this.todoCards$.getValue();
    const newItem: ReactiveTodoItem = {
      id: 'item-' + Math.random().toString(36).substring(2, 8),
      text: itemData.text,
      completed: false,
      isReactive: itemData.isReactive,
      triggerType: itemData.triggerType || 'MANUAL',
      triggerDescription: itemData.triggerDescription,
    };

    const updated = cards.map((c) =>
      c.id === cardId
        ? {
            ...c,
            updatedAt: new Date().toISOString(),
            items: [...c.items, newItem],
          }
        : c,
    );

    this.persistTodos(updated);
  }

  deleteTodoItem(cardId: string, itemId: string): void {
    const cards = this.todoCards$.getValue();
    const updated = cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            items: card.items.filter((i) => i.id !== itemId),
            updatedAt: new Date().toISOString(),
          }
        : card,
    );

    this.persistTodos(updated);
  }

  createTodoCard(cardData: Omit<ReactiveTodoListCard, 'id' | 'createdAt' | 'updatedAt'>): void {
    const newCard: ReactiveTodoListCard = {
      ...cardData,
      id: 'todo-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = this.todoCards$.getValue();
    this.persistTodos([newCard, ...current]);
  }

  togglePinTodo(id: string): void {
    const current = this.todoCards$.getValue();
    const updated = current.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    this.persistTodos(updated);
  }

  setTodoColor(id: string, color: LemonCardColor): void {
    const current = this.todoCards$.getValue();
    const updated = current.map((c) => (c.id === id ? { ...c, color } : c));
    this.persistTodos(updated);
  }

  deleteTodoCard(id: string): void {
    const current = this.todoCards$.getValue();
    const updated = current.filter((c) => c.id !== id);
    this.persistTodos(updated);
  }
}
