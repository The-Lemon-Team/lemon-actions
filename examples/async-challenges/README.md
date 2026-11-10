# 🍋 JavaScript Async & Promises Lab (Core Combinator)

Специализированный репозиторий задач на **асинхронное программирование и промисы в JavaScript** с поддержкой **конечных автоматов (FSM)** и интеграцией с шиной **Core Combinator** в Lemon Actions.

---

## 📁 Стандартная структура репозитория задач

```text
async-challenges/
├── .lemon/                          # Конфигурация и шина данных
│   ├── config.json                  # Метаданные репозитория, теги и вотчеры
│   ├── tasks.json                   # Манифест задач со схемой FSM и переходами
│   └── results.json                 # Результаты прогона тестов (автообновление)
├── tasks/                           # Каталог задач по категориям
│   ├── 01-async-series/             # Пайплайн последовательных промисов
│   │   ├── solution.js              # Исходный код реализации
│   │   ├── solution.test.js         # Тесты (native node:test)
│   │   └── README.md                # Спецификация и требования к задаче
│   ├── 02-promise-pool/             # Пул параллельных промисов (concurrency limit)
│   │   ├── solution.js
│   │   ├── solution.test.js
│   │   └── README.md
│   ├── 03-retry-backoff/            # Повтор с экспоненциальной задержкой
│   │   ├── solution.js
│   │   ├── solution.test.js
│   │   └── README.md
│   └── 04-deferred-promise/         # Отложенный промис (Deferred)
│       ├── solution.js
│       ├── solution.test.js
│       └── README.md
└── run-tests.js                     # Тест-раннер (парсит TAP, формирует results.json)
```

---

## 🔄 Модель конечного автомата (FSM) с экшенами ветвления

Каждая задача управляется конечным автоматом со следующими состояниями и ветвлениями:

```text
[stub] (Заготовка)
  └── START_FOCUS ──> [in_progress] (В работе, сессия Mutex активна)
                         ├── PAUSE ──> [paused]
                         └── RUN_TESTS ──> [evaluating] (Запуск тестов)
                                              ├── TESTS_FAILED ──> [debugging] (Ошибки)
                                              │                       ├── RETRY ──> [evaluating]
                                              │                       ├── NOTE_HYPOTHESIS ──> [in_progress]
                                              │                       └── PAUSE ──> [paused]
                                              └── TESTS_PASSED ──> [passed] (Успех)
                                                                      ├── SAVE_TO_NOTES ──> [completed]
                                                                      └── REFACTOR ──> [in_progress]
```

### Экшены ветвления:
1. **В состоянии `debugging` (падение тестов)**:
   * **`RETRY`**: повторный запуск раннера после правок кода.
   * **`NOTE_HYPOTHESIS`**: фиксация гипотезы/ошибки в виде черновика в Notes.
   * **`PAUSE`**: отложить задачу без потери контекста сессии.
2. **В состоянии `passed` (успешный прогон)**:
   * **`SAVE_TO_NOTES`**: сохранение завершенной задачи как достижения в Chrono Cloud (Notes).
   * **`REFACTOR`**: продолжить работу над чистотой кода без изменения статуса завершения.

---

## 🚀 Запуск тестов

Для запуска всех тестов и генерации отчета для шины Core Combinator:

```bash
node run-tests.js
```

Тесты используют нативный встроенный раннер `node:test` и `node:assert/strict` (Node.js 18+ / 24+), без необходимости установки сторонних зависимостей (`npm i` не требуется).
