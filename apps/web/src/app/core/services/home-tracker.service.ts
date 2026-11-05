import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  CreateFlowPayload,
  Flow,
  FlowStatus,
  FlowType,
  Folder,
  HomeWidgetMeta,
  HomeWidgetView,
  RoomTask,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { FlowOrchestratorService } from './flow-orchestrator.service';
import { ProfileService } from './profile.service';

export interface HomeActivityItem {
  id: string;
  flowId: string;
  flowName: string;
  eventType: 'RESTOCKED' | 'DEPLETED' | 'ROUTINE_DONE' | 'WIDGET_CREATED' | 'SPEC_CHANGED';
  note: string;
  createdAt: string;
  icon: string;
}

export interface CreateHomeWidgetInput {
  name: string;
  description?: string;
  kind: 'supply' | 'routine';
  room: string;
  icon: string;
  brand?: string;
  price?: string;
  note?: string;
  expectedDays?: number;
  unitHint?: string;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  daysPerUnit?: number;
  scheduleDays?: number[];
  scheduleStart?: string;
  scheduleEnd?: string;
}

export interface RestockWithSpecInput {
  flowId: string;
  brand?: string;
  unitHint?: string;
  price?: string;
  expectedDays?: number;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  note?: string;
}

export interface UpdateWidgetSpecInput {
  flowId: string;
  name?: string;
  brand?: string;
  unitHint?: string;
  price?: string;
  expectedDays?: number;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  room?: string;
  note?: string;
}

interface ProfileLocalStore {
  folders: Folder[];
  flows: Flow[];
  activities: HomeActivityItem[];
  tasks?: RoomTask[];
}

function buildStarterProfileStore(profileId: string, isDacha = false): ProfileLocalStore {
  const now = new Date().toISOString();
  const homeId = `${profileId.slice(0, 24)}-000000000101`;
  const suppliesId = `${profileId.slice(0, 24)}-000000000102`;
  const routinesId = `${profileId.slice(0, 24)}-000000000103`;

  const folders: Folder[] = [
    { id: homeId, name: 'Home', parentId: null, profileId, path: 'home', createdAt: now, updatedAt: now },
    {
      id: suppliesId,
      name: 'Household Supplies',
      parentId: homeId,
      profileId,
      path: 'home.supplies',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: routinesId,
      name: 'Home Routines',
      parentId: homeId,
      profileId,
      path: 'home.routines',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const flows: Flow[] = isDacha
    ? [
        {
          id: `${profileId.slice(0, 24)}-000000000201`,
          name: 'Дрова и уголь для камина',
          description: 'Запас топлива для камина и мангала на даче.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-supplies', name: 'supplies' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'fireplace',
              room: 'Терраса',
              brand: 'Березовые колотые',
              expectedDays: 14,
              unitHint: '2 сетки березовых дров',
              price: '400 ₽',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000202`,
          name: 'Питьевая вода (19 л)',
          description: 'Бутыли питьевой воды для кулера.',
          type: FlowType.MUTEX,
          status: FlowStatus.INACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'water_drop',
              room: 'Кухня',
              brand: 'Архыз Горная',
              expectedDays: 7,
              unitHint: '2 бутыли по 19 л',
              price: '700 ₽',
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000203`,
          name: 'Полив газона и теплицы',
          description: 'Scheduled Mutex: утреннее и вечернее окно автоматического полива.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: routinesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-routine', name: 'routine' },
          ],
          config: {
            widget: {
              kind: 'routine',
              icon: 'yard',
              room: 'Участок',
              scheduleLabel: 'Ежедневно, 07:00–09:00',
            },
          },
          orchestratorRules: {
            schedule: {
              enabled: true,
              windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '07:00', end: '09:00' }],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [
        {
          id: `${profileId.slice(0, 24)}-000000000201`,
          name: 'Стиральный порошок',
          description: 'Стиральный автомат-порошок. Счётчик в килограммах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000210`,
          name: 'Чай в пакетиках',
          description: 'Порционный чай в пакетиках. Счётчик поштучного расхода.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000211`,
          name: 'Чай листовой',
          description: 'Крупнолистовой чай для заварочного чайника. Счётчик граммовки.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000212`,
          name: 'Буханка хлеба',
          description: 'Свежий хлеб на кухне. Поштучный учёт буханок.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000213`,
          name: 'Кетчуп',
          description: 'Томатный кетчуп в дой-паке. Учёт пачками.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000214`,
          name: 'Утка',
          description: 'Простой мьютекс наличия: включён (ACTIVE) = есть дома, выключен (INACTIVE) = съедена/закончилась. Записывает историю сессий и событий до полного окончания.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-mutex', name: 'mutex' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000215`,
          name: 'Сало',
          description: 'Запас домашнего сала в морозилке. Штучный учёт брикетов.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000216`,
          name: 'Лимон',
          description: 'Свежие лимоны. Поштучный счётчик плодов.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000217`,
          name: 'Молоко',
          description: 'Пастеризованное молоко. Счётчик в литрах с шагом 0.5 л.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000218`,
          name: 'Мука',
          description: 'Пшеничная мука высшего сорта. Учёт запаса в килограммах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000219`,
          name: 'Сахар',
          description: 'Сахар-песок. Счётчик запаса в килограммах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000220`,
          name: 'Гречка',
          description: 'Гречневая крупа ядрица отборная. Счётчик расхода в килограммах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000221`,
          name: 'Рис',
          description: 'Рис шлифованный круглозерный/длиннозерный. Счётчик запаса в килограммах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-kitchen', name: 'kitchen' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000222`,
          name: 'Мыло',
          description: 'Туалетное мыло для рук и тела. Поштучный счётчик брусков.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000223`,
          name: 'Влажные салфетки',
          description: 'Влажные гигиенические и очищающие салфетки. Простой мьютекс наличия (ON/OFF).',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-mutex', name: 'mutex' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000224`,
          name: 'Санокс',
          description: 'Чистящий гель Санокс для сантехники и ванны. Простой мьютекс наличия (ON/OFF).',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-mutex', name: 'mutex' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000225`,
          name: 'Гель для мытья посуды',
          description: 'Концентрированное средство для мытья посуды. Счётчик в литрах.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000226`,
          name: 'Губки',
          description: 'Поролоновые губки с абразивным слоем для мытья и уборки. Поштучный счётчик.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000227`,
          name: 'Тряпки',
          description: 'Салфетки и тряпки из микрофибры/вискозы для сухой и влажной уборки. Поштучный счётчик.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000228`,
          name: 'Средство для мытья плиты',
          description: 'Антижир для очистки кухонных плит, духовок и решёток. Простой мьютекс наличия (ON/OFF).',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-mutex', name: 'mutex' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000229`,
          name: 'Железные губки',
          description: 'Металлические мочалки/скребки из нержавеющей стали для сложных загрязнений. Поштучный счётчик.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bath' },
            { id: 't-counter', name: 'counter' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000206`,
          name: 'Шампунь и гель для душа',
          description: 'Флаконы в душевой. Остаток отслеживается в миллилитрах с цветовой шкалой запаса.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bathroom' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'shower',
              room: 'Ванная',
              brand: 'Head & Shoulders Classic',
              unitHint: '400 мл (флакон)',
              price: '420 ₽',
              expectedDays: 20,
              currentQty: 120,
              maxQty: 400,
              unit: 'мл',
              step: 15,
              daysPerUnit: 0.25,
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000207`,
          name: 'Туалетная бумага (Zewa Deluxe)',
          description: 'Мягкая 3-слойная бумага. При критическом остатке < 20% загорается красным.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-bath', name: 'bathroom' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'dry',
              room: 'Ванная',
              brand: 'Zewa Deluxe 3 слоя',
              unitHint: '8 рулонов',
              price: '280 ₽',
              expectedDays: 16,
              currentQty: 1,
              maxQty: 8,
              unit: 'рул',
              step: 1,
              daysPerUnit: 2,
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000208`,
          name: 'Батарейки AA (пульты и датчики)',
          description: 'Комплект алкалиновых батареек для ТВ-пульта и климатической панели.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: suppliesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-living', name: 'living' },
          ],
          config: {
            widget: {
              kind: 'supply',
              icon: 'battery_charging_full',
              room: 'Гостиная',
              brand: 'Duracell Ultra',
              unitHint: '12 шт (упаковка)',
              price: '540 ₽',
              expectedDays: 60,
              currentQty: 8,
              maxQty: 12,
              unit: 'шт',
              step: 2,
              daysPerUnit: 10,
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${profileId.slice(0, 24)}-000000000205`,
          name: 'Субботняя уборка и полив цветов',
          description: 'Scheduled Mutex: активирует окно домашней рутины по выходным с 10:00 до 14:00, не отсекая историю.',
          type: FlowType.MUTEX,
          status: FlowStatus.ACTIVE,
          isExclusive: false,
          folderId: routinesId,
          profileId,
          tags: [
            { id: 't-home', name: 'home' },
            { id: 't-routine', name: 'routine' },
          ],
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
          createdAt: now,
          updatedAt: now,
        },
      ];

  const tasks: RoomTask[] = [
    { id: `task-${profileId}-1`, room: 'Кухня', title: 'Почистить фильтр вытяжки и решётку плиты', done: false, createdAt: now, priority: 'medium' },
    { id: `task-${profileId}-2`, room: 'Кухня', title: 'Протереть фасады кухонного гарнитура', done: true, createdAt: now, priority: 'low' },
    { id: `task-${profileId}-3`, room: 'Ванная', title: 'Запустить цикл самоочистки барабана стиральной машины', done: false, createdAt: now, priority: 'high' },
    { id: `task-${profileId}-4`, room: 'Ванная', title: 'Заменить диффузор аромата и повесить свежие полотенца', done: true, createdAt: now, priority: 'low' },
    { id: `task-${profileId}-5`, room: 'Гостиная', title: 'Пропылесосить мягкую мебель и ковер', done: false, createdAt: now, priority: 'medium' },
    { id: `task-${profileId}-6`, room: 'Гостиная', title: 'Полить монстеру и фикус', done: true, createdAt: now, priority: 'low' },
  ];

  const activities: HomeActivityItem[] = [
    {
      id: `act-${profileId}-1`,
      flowId: flows[1].id,
      flowName: flows[1].name,
      eventType: 'DEPLETED',
      note: 'Запас закончился -> мьютекс переведен в INACTIVE (добавлено в список покупок)',
      createdAt: now,
      icon: 'shopping_cart_checkout',
    },
    {
      id: `act-${profileId}-2`,
      flowId: flows[0].id,
      flowName: flows[0].name,
      eventType: 'RESTOCKED',
      note: 'Пополнено дома -> открыта новая сессия наличия в flow_sessions',
      createdAt: now,
      icon: 'check_circle',
    },
  ];

  return { folders, flows, activities, tasks };
}

/**
 * Императивно-реактивный сервис приложения «Lemon Home (Трекер ресурсов дома)».
 * Работает поверх Core Combinator API строго в пределах `scope = 'home'` текущего профиля (`profileId`).
 */
@Injectable({ providedIn: 'root' })
export class HomeTrackerService {
  readonly scope = 'home';

  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly coreOrchestrator = inject(FlowOrchestratorService);

  private readonly localStores = new Map<string, ProfileLocalStore>();

  private readonly homeFoldersSubject = new BehaviorSubject<Folder[]>([]);
  private readonly homeFlowsSubject = new BehaviorSubject<Flow[]>([]);
  private readonly activitiesSubject = new BehaviorSubject<HomeActivityItem[]>([]);
  private readonly selectedRoomSubject = new BehaviorSubject<string>('ALL');

  readonly homeFolders$: Observable<Folder[]> = this.homeFoldersSubject.asObservable();
  readonly homeFlows$: Observable<Flow[]> = this.homeFlowsSubject.asObservable();
  readonly activities$: Observable<HomeActivityItem[]> = this.activitiesSubject.asObservable();
  readonly selectedRoom$: Observable<string> = this.selectedRoomSubject.asObservable();
  get currentRoom(): string {
    return this.selectedRoomSubject.value;
  }

  /** Все домашние виджеты, обогащенные доменной мета-информацией. */
  readonly widgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.homeFlows$,
    this.homeFolders$,
  ]).pipe(
    map(([flows, folders]) =>
      flows.map((flow) => {
        const folderPath = folders.find((f) => f.id === flow.folderId)?.path ?? 'home.supplies';
        const rawConfig = (flow.config ?? {}) as { widget?: HomeWidgetMeta };
        const meta: HomeWidgetMeta = rawConfig.widget ?? {};
        const isRoutine =
          meta.kind === 'routine' ||
          folderPath.includes('routines') ||
          Boolean(flow.orchestratorRules?.schedule?.enabled);

        const updatedMs = new Date(flow.updatedAt || flow.createdAt).getTime();
        const daysSinceUpdate = Math.max(0, Math.floor((Date.now() - updatedMs) / (1000 * 60 * 60 * 24)));

        const currentQty =
          meta.currentQty !== undefined
            ? meta.currentQty
            : (flow.status === FlowStatus.ACTIVE ? (meta.maxQty ?? 1) : 0);
        const maxQty = meta.maxQty && meta.maxQty > 0 ? meta.maxQty : Math.max(currentQty, 1);
        const unit = meta.unit || (meta.unitHint ? meta.unitHint.split(' ')[1] || 'шт' : 'шт');
        const step = meta.step && meta.step > 0 ? meta.step : 1;
        const daysPerUnit = meta.daysPerUnit || 1;
        const percentage = maxQty > 0 ? Math.min(100, Math.round((currentQty / maxQty) * 100)) : 0;

        return {
          flow,
          kind: isRoutine ? 'routine' : 'supply',
          icon: meta.icon || (isRoutine ? 'schedule' : 'inventory_2'),
          room: meta.room || (isRoutine ? 'Весь дом' : 'Дом'),
          expectedDays: meta.expectedDays || 14,
          unitHint: meta.unitHint || `${maxQty} ${unit}`,
          brand: meta.brand,
          price: meta.price,
          note: meta.note,
          scheduleLabel: meta.scheduleLabel || this.formatScheduleLabel(flow),
          isInStock: flow.status === FlowStatus.ACTIVE || flow.status === FlowStatus.PROCESSING,
          daysSinceUpdate,
          folderPath,
          currentQty,
          maxQty,
          unit,
          step,
          daysPerUnit,
          percentage,
        } satisfies HomeWidgetView;
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Список уникальных комнат/зон дома для фильтрации. */
  readonly rooms$: Observable<string[]> = this.widgets$.pipe(
    map((widgets) => {
      const set = new Set<string>();
      widgets.forEach((w) => set.add(w.room));
      return ['ALL', ...Array.from(set)];
    }),
  );

  /** Виджеты запасов с учетом фильтра комнаты. */
  readonly supplyWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'supply' && (room === 'ALL' || w.room === room)),
    ),
  );

  /** Ресурсы в наличии дома (мьютекс ACTIVE). */
  readonly inStockSupplies$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && w.isInStock)),
  );

  /** Реактивный список покупок: все ресурсы, чей мьютекс перешел в INACTIVE! */
  readonly shoppingList$: Observable<HomeWidgetView[]> = this.widgets$.pipe(
    map((widgets) => widgets.filter((w) => w.kind === 'supply' && !w.isInStock)),
  );

  /** Домашние рутины и расписания (Scheduled Mutex). */
  readonly routineWidgets$: Observable<HomeWidgetView[]> = combineLatest([
    this.widgets$,
    this.selectedRoom$,
  ]).pipe(
    map(([widgets, room]) =>
      widgets.filter((w) => w.kind === 'routine' && (room === 'ALL' || w.room === room)),
    ),
  );

  /** Сводная статистика здоровья запасов (Stitch Stock Health Spectrum). */
  readonly healthStats$ = this.widgets$.pipe(
    map((widgets) => {
      const supplies = widgets.filter((w) => w.kind === 'supply');
      const total = supplies.length;
      let empty = 0;
      let low = 0;
      let healthy = 0;

      supplies.forEach((s) => {
        if (!s.isInStock || s.currentQty === 0) {
          empty++;
        } else if (s.percentage < 20) {
          low++;
        } else {
          healthy++;
        }
      });

      const healthPercent = total > 0 ? Math.round((healthy / total) * 100) : 100;
      return { total, empty, low, healthy, healthPercent };
    }),
  );

  private readonly tasksSubject = new BehaviorSubject<RoomTask[]>([]);
  readonly tasks$: Observable<RoomTask[]> = this.tasksSubject.asObservable();

  /** Задачи и todo-лист, отфильтрованные по текущей выбранной комнате */
  readonly tasksForSelectedRoom$: Observable<RoomTask[]> = combineLatest([
    this.tasks$,
    this.selectedRoom$,
  ]).pipe(
    map(([tasks, room]) => (room === 'ALL' ? tasks : tasks.filter((t) => t.room === room))),
  );

  constructor() {
    this.profileService.activeProfile$.subscribe((profile) => {
      this.selectedRoomSubject.next('ALL');
      this.loadProfileHomeScope(profile.id, profile.handle === 'dacha');
    });
  }

  setRoomFilter(room: string): void {
    this.selectedRoomSubject.next(room);
  }

  /**
   * Списание порции ресурса (например -50 г стирального порошка, -1 рулон или -15 мл шампуня).
   * Если остаток падает до 0, мьютекс переводится в INACTIVE (автоматически попадает в список покупок).
   */
  consumePortion(flowId: string, customAmount?: number): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const currentQty =
      oldWidget.currentQty !== undefined
        ? oldWidget.currentQty
        : flow.status === FlowStatus.ACTIVE
          ? (oldWidget.maxQty ?? 1)
          : 0;
    const maxQty = oldWidget.maxQty ?? Math.max(currentQty, 1);
    const step = customAmount ?? oldWidget.step ?? 1;
    const unit = oldWidget.unit || 'ед.';

    const newQty = Math.round(Math.max(0, currentQty - step) * 1000) / 1000;
    const willBeDepleted = newQty === 0;
    const nextStatus = willBeDepleted ? FlowStatus.INACTIVE : FlowStatus.ACTIVE;

    const nextWidget: HomeWidgetMeta = {
      ...oldWidget,
      currentQty: newQty,
      maxQty,
    };

    const nextConfig = {
      ...((flow.config as any) ?? {}),
      widget: nextWidget,
    };

    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status: nextStatus, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    if (willBeDepleted) {
      this.pushActivity({
        flowId,
        flowName: flow.name,
        eventType: 'DEPLETED',
        note: `Списано ${step} ${unit}. Остаток 0 -> запас исчерпан (мьютекс выключен, добавлено в покупки)`,
        icon: 'remove_shopping_cart',
      });
    } else {
      this.pushActivity({
        flowId,
        flowName: flow.name,
        eventType: 'SPEC_CHANGED',
        note: `Расход -${step} ${unit}. Текущий остаток: ${newQty} ${unit} из ${maxQty} (${Math.round((newQty / maxQty) * 100)}%)`,
        icon: 'remove_circle_outline',
      });
    }

    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        if (willBeDepleted || flow.status !== nextStatus) {
          this.api
            .updateFlowStatus(flowId, nextStatus)
            .pipe(catchError(() => of(null)))
            .subscribe(() => {
              this.api
                .appendFlowEvent(flowId, {
                  source: 'lemon-home-app',
                  eventType: willBeDepleted ? 'DEPLETED' : 'CONSUMED',
                  payload: { consumed: step, remaining: newQty, unit },
                })
                .pipe(catchError(() => of(null)))
                .subscribe(() => this.coreOrchestrator.refresh());
            });
        } else {
          this.api
            .appendFlowEvent(flowId, {
              source: 'lemon-home-app',
              eventType: 'CONSUMED',
              payload: { consumed: step, remaining: newQty, unit },
            })
            .pipe(catchError(() => of(null)))
            .subscribe(() => this.coreOrchestrator.refresh());
        }
      });
  }

  /**
   * Пополнение запаса порцией или пачкой (например +50 г или +3000 г пачка).
   * Независимое пополнение: может выполняться даже если ресурс еще в наличии (Mutex уже ACTIVE).
   * Если ресурс был в состоянии INACTIVE (в покупках), он автоматически переходит в ACTIVE (мьютекс включается).
   */
  addPortion(flowId: string, customAmount?: number): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const currentQty =
      oldWidget.currentQty !== undefined
        ? oldWidget.currentQty
        : flow.status === FlowStatus.ACTIVE
          ? (oldWidget.maxQty ?? 1)
          : 0;
    const maxQty = oldWidget.maxQty ?? Math.max(currentQty, 1);
    const step = customAmount ?? oldWidget.step ?? 1;
    const unit = oldWidget.unit || 'ед.';

    const newQty = Math.round((currentQty + step) * 1000) / 1000;
    const adjustedMax = Math.max(maxQty, newQty);
    const wasInactive = flow.status === FlowStatus.INACTIVE || currentQty === 0;

    const nextWidget: HomeWidgetMeta = {
      ...oldWidget,
      currentQty: newQty,
      maxQty: adjustedMax,
    };

    const nextConfig = {
      ...((flow.config as any) ?? {}),
      widget: nextWidget,
    };

    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status: FlowStatus.ACTIVE, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: wasInactive
        ? `Пополнено +${step} ${unit} -> мьютекс включен в ACTIVE (убрано из списка покупок)`
        : `Независимое пополнение запаса: +${step} ${unit}. Всего: ${newQty} ${unit}`,
      icon: 'add_circle',
    });

    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .updateFlowStatus(flowId, FlowStatus.ACTIVE)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.api
              .appendFlowEvent(flowId, {
                source: 'lemon-home-app',
                eventType: 'RESTOCKED',
                payload: { added: step, total: newQty, unit, wasInactive },
              })
              .pipe(catchError(() => of(null)))
              .subscribe(() => this.coreOrchestrator.refresh());
          });
      });
  }

  /**
   * Заполнить все ресурсы выбранной комнаты до 100% максимального объема (аналог "Max All" из Stitch).
   */
  maxAllInRoom(roomName: string): void {
    const flows = this.homeFlowsSubject.value;
    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();

    const updated = flows.map((f) => {
      const widget = (((f.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
      if (widget.kind !== 'routine' && (roomName === 'ALL' || widget.room === roomName)) {
        const maxQty = widget.maxQty ?? (widget.currentQty || 1);
        return {
          ...f,
          status: FlowStatus.ACTIVE,
          config: {
            ...((f.config as any) ?? {}),
            widget: {
              ...widget,
              currentQty: maxQty,
            },
          },
          updatedAt: now,
        };
      }
      return f;
    });

    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId: `room-${roomName}`,
      flowName: roomName === 'ALL' ? 'Все зоны дома' : roomName,
      eventType: 'RESTOCKED',
      note: `Все ресурсы зоны «${roomName === 'ALL' ? 'Все зоны' : roomName}» пополнены до максимума (Max All)`,
      icon: 'done_all',
    });
  }

  toggleRoomTask(taskId: string): void {
    const next = this.tasksSubject.value.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    this.tasksSubject.next(next);
  }

  addRoomTask(room: string, title: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    if (!title.trim()) return;
    const newTask: RoomTask = {
      id: `task-${Date.now()}`,
      room: room === 'ALL' ? 'Кухня' : room,
      title: title.trim(),
      done: false,
      createdAt: new Date().toISOString(),
      priority,
    };
    this.tasksSubject.next([newTask, ...this.tasksSubject.value]);
  }

  deleteRoomTask(taskId: string): void {
    this.tasksSubject.next(this.tasksSubject.value.filter((t) => t.id !== taskId));
  }

  /**
   * Императивное действие: «Закончилось дома (В список покупок)».
   * Переводит мьютекс ресурса в INACTIVE (закрывая сессию наличия) и пишет событие DEPLETED в хронику.
   */
  markDepleted(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const nextWidget: HomeWidgetMeta = { ...oldWidget, currentQty: 0 };
    const nextConfig = { ...((flow.config as any) ?? {}), widget: nextWidget };

    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status: FlowStatus.INACTIVE, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'DEPLETED',
      note: 'Запас исчерпан -> мьютекс снят (добавлено в список покупок)',
      icon: 'remove_shopping_cart',
    });

    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .updateFlowStatus(flowId, FlowStatus.INACTIVE)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.api
              .appendFlowEvent(flowId, {
                source: 'lemon-home-app',
                eventType: 'DEPLETED',
                payload: { action: 'moved_to_shopping_list', currentQty: 0 },
              })
              .pipe(catchError(() => of(null)))
              .subscribe(() => this.coreOrchestrator.refresh());
          });
      });
  }

  /**
   * Императивное действие: «Купили / Пополнили запас» с фиксацией или изменением условий карточки
   * (смена бренда, веса/килограммов, цены чека, срока расхода).
   * Сохраняет новую спецификацию в config.widget, переводит Mutex в ACTIVE и пишет подробный лог в flow_events.
   */
  restockWithSpec(input: RestockWithSpecInput): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === input.flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const changes: string[] = [];

    if (input.brand !== undefined && input.brand.trim() !== (oldWidget.brand ?? '')) {
      changes.push(`Марка: ${oldWidget.brand || 'не указана'} → ${input.brand.trim()}`);
    }
    if (input.unitHint !== undefined && input.unitHint.trim() !== (oldWidget.unitHint ?? '')) {
      changes.push(`Фасовка: ${oldWidget.unitHint || 'не указана'} → ${input.unitHint.trim()}`);
    }
    if (input.price !== undefined && input.price.trim() !== (oldWidget.price ?? '')) {
      changes.push(`Цена/чек: ${input.price.trim()}`);
    }
    if (input.expectedDays !== undefined && input.expectedDays !== oldWidget.expectedDays) {
      changes.push(`Срок: ${oldWidget.expectedDays || 14} дн. → ${input.expectedDays} дн.`);
    }

    const changesSummary = changes.length > 0 ? changes.join('; ') : 'Условия подтверждены без изменений';

    const nextWidget: HomeWidgetMeta = {
      ...oldWidget,
      brand: input.brand !== undefined ? input.brand.trim() : oldWidget.brand,
      unitHint: input.unitHint !== undefined ? input.unitHint.trim() : oldWidget.unitHint,
      price: input.price !== undefined ? input.price.trim() : oldWidget.price,
      expectedDays: input.expectedDays !== undefined ? input.expectedDays : oldWidget.expectedDays,
      note: input.note !== undefined ? input.note.trim() : oldWidget.note,
    };

    const nextConfig = {
      ...((flow.config as any) ?? {}),
      widget: nextWidget,
    };

    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === input.flowId ? { ...f, status: FlowStatus.ACTIVE, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId: flow.id,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: `Пополнено с обновлением условий: ${changesSummary}`,
      icon: 'inventory',
    });

    this.api
      .updateFlow(flow.id, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .updateFlowStatus(flow.id, FlowStatus.ACTIVE)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.api
              .appendFlowEvent(flow.id, {
                source: 'lemon-home-app',
                eventType: 'RESTOCKED',
                payload: {
                  action: 'restocked_with_spec_change',
                  brand: nextWidget.brand,
                  unitHint: nextWidget.unitHint,
                  price: nextWidget.price,
                  expectedDays: nextWidget.expectedDays,
                  note: nextWidget.note,
                  previousSpec: {
                    brand: oldWidget.brand,
                    unitHint: oldWidget.unitHint,
                    price: oldWidget.price,
                    expectedDays: oldWidget.expectedDays,
                  },
                  changesSummary,
                },
              })
              .pipe(catchError(() => of(null)))
              .subscribe(() => this.coreOrchestrator.refresh());
          });
      });
  }

  /**
   * Корректировка условий карточки без изменения статуса Mutex
   * (например, изменился используемый вес или бренд до истощения запаса).
   */
  updateWidgetSpec(input: UpdateWidgetSpecInput): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === input.flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const changes: string[] = [];

    if (input.name && input.name.trim() !== flow.name) {
      changes.push(`Название: ${flow.name} → ${input.name.trim()}`);
    }
    if (input.brand !== undefined && input.brand.trim() !== (oldWidget.brand ?? '')) {
      changes.push(`Марка: ${oldWidget.brand || 'не указана'} → ${input.brand.trim()}`);
    }
    if (input.unitHint !== undefined && input.unitHint.trim() !== (oldWidget.unitHint ?? '')) {
      changes.push(`Фасовка: ${oldWidget.unitHint || 'не указана'} → ${input.unitHint.trim()}`);
    }
    if (input.price !== undefined && input.price.trim() !== (oldWidget.price ?? '')) {
      changes.push(`Цена/чек: ${input.price.trim()}`);
    }
    if (input.expectedDays !== undefined && input.expectedDays !== oldWidget.expectedDays) {
      changes.push(`Срок: ${oldWidget.expectedDays || 14} дн. → ${input.expectedDays} дн.`);
    }

    const changesSummary = changes.length > 0 ? changes.join('; ') : 'Условия сохранены';

    const nextWidget: HomeWidgetMeta = {
      ...oldWidget,
      brand: input.brand !== undefined ? input.brand.trim() : oldWidget.brand,
      unitHint: input.unitHint !== undefined ? input.unitHint.trim() : oldWidget.unitHint,
      price: input.price !== undefined ? input.price.trim() : oldWidget.price,
      expectedDays: input.expectedDays !== undefined ? input.expectedDays : oldWidget.expectedDays,
      room: input.room !== undefined ? input.room.trim() : oldWidget.room,
      note: input.note !== undefined ? input.note.trim() : oldWidget.note,
    };

    const nextConfig = {
      ...((flow.config as any) ?? {}),
      widget: nextWidget,
    };

    const nextName = input.name?.trim() || flow.name;
    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === input.flowId ? { ...f, name: nextName, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId: flow.id,
      flowName: nextName,
      eventType: 'SPEC_CHANGED',
      note: `Изменены условия карточки: ${changesSummary}`,
      icon: 'tune',
    });

    this.api
      .updateFlow(flow.id, { name: nextName, config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .appendFlowEvent(flow.id, {
            source: 'lemon-home-app',
            eventType: 'SPEC_CHANGED',
            payload: {
              action: 'spec_updated',
              brand: nextWidget.brand,
              unitHint: nextWidget.unitHint,
              price: nextWidget.price,
              expectedDays: nextWidget.expectedDays,
              note: nextWidget.note,
              changesSummary,
            },
          })
          .pipe(catchError(() => of(null)))
          .subscribe(() => this.coreOrchestrator.refresh());
      });
  }

  /** Получает полную историю событий и изменений для конкретной карточки */
  getWidgetEvents(flowId: string) {
    return this.api.getFlowEvents(flowId);
  }

  /**
   * Императивное действие: «Купили / Пополнили запас».
   * Включает мьютекс ресурса в ACTIVE (открывая новую сессию наличия в flow_sessions) и пишет событие RESTOCKED.
   */
  markRestocked(flowId: string): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    const oldWidget = (((flow.config as any) ?? {}).widget ?? {}) as HomeWidgetMeta;
    const restoredQty = oldWidget.maxQty && oldWidget.maxQty > 0 ? oldWidget.maxQty : 1;
    const nextWidget: HomeWidgetMeta = { ...oldWidget, currentQty: restoredQty };
    const nextConfig = { ...((flow.config as any) ?? {}), widget: nextWidget };

    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status: FlowStatus.ACTIVE, config: nextConfig, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);

    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'RESTOCKED',
      note: `Запас пополнен (+${restoredQty} ${oldWidget.unit || 'ед.'}) -> мьютекс наличия активен`,
      icon: 'inventory',
    });

    this.api
      .updateFlow(flowId, { config: nextConfig })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.api
          .updateFlowStatus(flowId, FlowStatus.ACTIVE)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.api
              .appendFlowEvent(flowId, {
                source: 'lemon-home-app',
                eventType: 'RESTOCKED',
                payload: { action: 'restocked_at_home', currentQty: restoredQty },
              })
              .pipe(catchError(() => of(null)))
              .subscribe(() => this.coreOrchestrator.refresh());
          });
      });
  }

  /**
   * Императивное действие: отметить выполнение домашней рутины в рамках Scheduled Mutex.
   * Не прерывает расписание, а добавляет запись в `flow_events` со слепком текущей сессии.
   */
  completeRoutine(flowId: string, note = 'Выполнено по расписанию'): void {
    const flow = this.homeFlowsSubject.value.find((f) => f.id === flowId);
    if (!flow) return;

    this.pushActivity({
      flowId,
      flowName: flow.name,
      eventType: 'ROUTINE_DONE',
      note,
      icon: 'task_alt',
    });

    this.api
      .appendFlowEvent(flowId, {
        source: 'lemon-home-app',
        eventType: 'ROUTINE_DONE',
        payload: { note, completedAt: new Date().toISOString() },
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.coreOrchestrator.refresh());
  }

  /**
   * Создает новый бытовой виджет (запас или рутину по расписанию) в профиле пользователя
   * внутри контейнера `home.supplies` или `home.routines`.
   */
  createHomeWidget(input: CreateHomeWidgetInput): void {
    const profileId = this.profileService.currentProfileId;
    const folders = this.homeFoldersSubject.value;
    const targetPath = input.kind === 'routine' ? 'home.routines' : 'home.supplies';
    const targetFolder =
      folders.find((f) => f.path === targetPath) ??
      folders.find((f) => f.path === 'home') ??
      folders[0];

    const days = input.scheduleDays?.length ? input.scheduleDays : [6, 0];
    const start = input.scheduleStart || '10:00';
    const end = input.scheduleEnd || '14:00';

    const payload: CreateFlowPayload = {
      name: input.name.trim(),
      description:
        input.description?.trim() ||
        (input.kind === 'routine'
          ? 'Домашняя рутина под управлением Scheduled Mutex.'
          : 'Бытовой мьютекс наличия ресурса в доме.'),
      type: FlowType.MUTEX,
      isExclusive: false,
      folderId: targetFolder?.id ?? null,
      profileId,
      tags: input.kind === 'routine' ? ['home', 'routine', 'schedule'] : ['home', 'supplies', 'mutex'],
      config: {
        widget: {
          kind: input.kind,
          icon: input.icon || (input.kind === 'routine' ? 'cleaning_services' : 'inventory_2'),
          room: input.room.trim() || 'Дом',
          brand: input.brand?.trim() || undefined,
          unitHint: input.unitHint?.trim() || '1 шт.',
          price: input.price?.trim() || undefined,
          expectedDays: input.expectedDays || 14,
          note: input.note?.trim() || undefined,
          scheduleLabel: input.kind === 'routine' ? `${start}–${end}` : undefined,
          currentQty: input.currentQty !== undefined ? input.currentQty : (input.maxQty || 1),
          maxQty: input.maxQty !== undefined ? input.maxQty : 1,
          unit: input.unit || 'шт',
          step: input.step !== undefined ? input.step : 1,
          daysPerUnit: input.daysPerUnit || 1,
        } satisfies HomeWidgetMeta,
      },
      orchestratorRules:
        input.kind === 'routine'
          ? {
              schedule: {
                enabled: true,
                windows: [{ days, start, end }],
              },
            }
          : undefined,
    };

    const now = new Date().toISOString();
    const optimisticFlow: Flow = {
      id: `local-flow-${Date.now()}`,
      name: payload.name,
      description: payload.description,
      type: FlowType.MUTEX,
      status: FlowStatus.ACTIVE,
      isExclusive: false,
      folderId: payload.folderId ?? null,
      profileId,
      tags: (payload.tags ?? []).map((t, i) => ({ id: `tag-${i}`, name: t })),
      config: payload.config,
      orchestratorRules: payload.orchestratorRules,
      createdAt: now,
      updatedAt: now,
    };

    const nextFlows = [...this.homeFlowsSubject.value, optimisticFlow];
    this.homeFlowsSubject.next(nextFlows);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, nextFlows);
    this.pushActivity({
      flowId: optimisticFlow.id,
      flowName: optimisticFlow.name,
      eventType: 'WIDGET_CREATED',
      note: `Создан виджет (${input.kind === 'routine' ? 'Рутина по расписанию' : 'Запас дома'}) в комнате «${input.room || 'Дом'}»`,
      icon: 'add_home',
    });

    this.api
      .createFlow(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((created) => {
        if (created) {
          this.api
            .updateFlowStatus(created.id, FlowStatus.ACTIVE)
            .pipe(catchError(() => of(null)))
            .subscribe(() => {
              this.loadProfileHomeScope(profileId, false);
              this.coreOrchestrator.refresh();
            });
        }
      });
  }

  deleteWidget(flowId: string): void {
    const profileId = this.profileService.currentProfileId;
    const nextFlows = this.homeFlowsSubject.value.filter((f) => f.id !== flowId);
    this.homeFlowsSubject.next(nextFlows);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, nextFlows);

    this.api
      .deleteFlow(flowId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.coreOrchestrator.refresh());
  }

  private loadProfileHomeScope(profileId: string, isDachaFallback: boolean): void {
    const fallbackStore = this.getOrInitLocalStore(profileId, isDachaFallback);

    this.api
      .getFolders({ profileId, scope: this.scope })
      .pipe(catchError(() => of(fallbackStore.folders)))
      .subscribe((folders) => {
        const resolvedFolders = folders.length > 0 ? folders : fallbackStore.folders;
        this.homeFoldersSubject.next(resolvedFolders);
      });

    this.api
      .getFlows({ profileId, scope: this.scope })
      .pipe(catchError(() => of(fallbackStore.flows)))
      .subscribe((flows) => {
        const resolvedFlows = flows.length > 0 ? flows : fallbackStore.flows;
        this.homeFlowsSubject.next(resolvedFlows);
        this.saveToLocalStore(profileId, this.homeFoldersSubject.value, resolvedFlows);
      });

    this.activitiesSubject.next(fallbackStore.activities);
    this.tasksSubject.next(fallbackStore.tasks ?? []);
  }

  private getOrInitLocalStore(profileId: string, isDacha = false): ProfileLocalStore {
    let store = this.localStores.get(profileId);
    if (!store) {
      store = buildStarterProfileStore(profileId, isDacha);
      this.localStores.set(profileId, store);
    }
    return store;
  }

  private saveToLocalStore(profileId: string, folders: Folder[], flows: Flow[]): void {
    const existing = this.getOrInitLocalStore(profileId);
    this.localStores.set(profileId, {
      ...existing,
      folders,
      flows,
      tasks: this.tasksSubject.value,
    });
  }

  private applyLocalFlowStatus(flowId: string, status: FlowStatus): void {
    const profileId = this.profileService.currentProfileId;
    const now = new Date().toISOString();
    const updated = this.homeFlowsSubject.value.map((f) =>
      f.id === flowId ? { ...f, status, updatedAt: now } : f,
    );
    this.homeFlowsSubject.next(updated);
    this.saveToLocalStore(profileId, this.homeFoldersSubject.value, updated);
  }

  private pushActivity(item: Omit<HomeActivityItem, 'id' | 'createdAt'>): void {
    const profileId = this.profileService.currentProfileId;
    const store = this.getOrInitLocalStore(profileId);
    const record: HomeActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...store.activities].slice(0, 25);
    store.activities = next;
    this.activitiesSubject.next(next);
  }

  private formatScheduleLabel(flow: Flow): string {
    const win = flow.orchestratorRules?.schedule?.windows?.[0];
    if (!win) return 'По расписанию';
    return `${win.start}–${win.end}`;
  }
}
