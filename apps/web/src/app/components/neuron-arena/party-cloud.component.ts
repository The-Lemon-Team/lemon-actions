import { AsyncPipe, DatePipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaDesireCard,
  CloudDateTab,
  CloudDayNote,
  CloudItemType,
} from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { PartyRealtimeService } from '../../core/services/party-realtime.service';
import { PartySoundService } from '../../party-game/party-sound.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses, getAccentPillClasses } from './arena-ui.utils';

export type CloudViewMode = 'CLOUD_TIMELINE' | 'DAY_FEED' | 'ORBIT' | 'CALENDAR_TIMELINE';
export type CloudFilterLayer =
  | 'ALL'
  | 'THOUGHTS'
  | 'PROPOSALS'
  | 'ACTIONS'
  | 'CHARACTERS'
  | 'ACTIVITIES';

export interface CalendarCoordinateSlot {
  id: string;
  dateKey: string;
  dayLabel: string;
  dateNumber: string;
  timeSlot: string;
  title: string;
  isToday: boolean;
  assignedCards: string[];
  assignedActors: string[];
}

export interface IdeaPitchPreset {
  title: string;
  icon: string;
  category: string;
  colorTheme: ArenaAccentColor;
}

export type CloudDayVibeId = 'CHRONO_DAYFLOW' | 'COZY_CHILL' | 'SYNTHWAVE' | 'NATURE_ZEN';

export interface CloudDayVibe {
  id: CloudDayVibeId;
  name: string;
  icon: string;
  badge: string;
  description: string;
  skyGradient: string;
  stageBorderClass: string;
  atmosphereEmoji: string[];
}

export interface TimelineCluster {
  id: string;
  timeMinutes: number;
  time: string;
  timeSpanLabel?: string;
  notes: CloudDayNote[];
  isCluster: boolean;
}

export const CLOUD_DAY_VIBES: CloudDayVibe[] = [
  {
    id: 'CHRONO_DAYFLOW',
    name: 'Хроно-День (Рассвет → Ночь)',
    icon: '🌅',
    badge: 'Живой Градиент',
    description: 'Плавный суточный переход от утренней зари через полуденное солнце к закату и ночному небу с пунктирными меридианами.',
    skyGradient: 'bg-gradient-to-r from-amber-100/60 via-sky-100/40 via-purple-100/45 to-indigo-900/25 dark:from-amber-950/30 dark:via-sky-950/20 dark:via-purple-950/35 dark:to-slate-950/80',
    stageBorderClass: 'border-amber-300/60 dark:border-amber-400/30',
    atmosphereEmoji: ['🌅', '☀️', '🌆', '🌙'],
  },
  {
    id: 'COZY_CHILL',
    name: 'Пятничный Чилл & Уют',
    icon: '🛋️',
    badge: 'Тёплый вечер',
    description: 'Пастельные кофейные и персиковые тона, атмосфера пледа, горячего чая и дружеских посиделок.',
    skyGradient: 'bg-gradient-to-r from-orange-100/70 via-rose-100/50 via-amber-100/60 to-purple-200/40 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-purple-950/40',
    stageBorderClass: 'border-rose-300/60 dark:border-rose-400/30',
    atmosphereEmoji: ['☕', '🕯️', '🍕', '🛋️'],
  },
  {
    id: 'SYNTHWAVE',
    name: 'Неоновый Космос & Синтвейв',
    icon: '🌌',
    badge: 'Cyber Party',
    description: 'Глубокий неоновый космос, фиолетовые закатные градиенты и синтвейв-вайб под треки DJ Pixel.',
    skyGradient: 'bg-gradient-to-r from-indigo-200/50 via-purple-200/60 via-pink-200/40 to-slate-900/60 dark:from-[#0f1123] dark:via-[#1c1236] dark:via-[#2b1040] dark:to-[#0a0c1a]',
    stageBorderClass: 'border-purple-400/60 dark:border-purple-500/40',
    atmosphereEmoji: ['🕹️', '✨', '🎧', '🪐'],
  },
  {
    id: 'NATURE_ZEN',
    name: 'Горный Дзен & Свежесть',
    icon: '🌲',
    badge: 'Эко-Баланс',
    description: 'Свежие бирюзовые и изумрудные тона утреннего леса, чистый воздух и кристальная ясность мыслей.',
    skyGradient: 'bg-gradient-to-r from-emerald-100/60 via-teal-100/50 via-cyan-100/45 to-sky-200/50 dark:from-emerald-950/35 dark:via-teal-950/25 dark:to-cyan-950/40',
    stageBorderClass: 'border-emerald-300/60 dark:border-emerald-400/30',
    atmosphereEmoji: ['🍃', '☀️', '🌲', '✨'],
  },
];

const STORAGE_NOTES_KEY = 'lemon-party:cloud-notes-v3';

const SEED_NOTES: Record<string, CloudDayNote[]> = {
  '2026-11-06': [
    {
      id: 'note-today-1',
      dateKey: '2026-11-06',
      time: '08:30',
      timeMinutes: 510,
      type: 'thought',
      actorId: 'actor-owl-detective',
      actorName: 'Детектив Сова',
      actorAvatar: 'owl',
      actorAccent: 'indigo',
      actorTitle: 'Аналитик Внимания',
      text: 'Утренний эспрессо готов. Сегодня нужно разгадать главный парадокс дня и найти баланс!',
      supporters: ['actor-dr-cerebro', 'actor-eva-ai'],
      votesCount: 3,
      moodEmoji: '☕',
      createdAt: '2026-11-06T08:30:00Z',
    },
    {
      id: 'note-today-2',
      dateKey: '2026-11-06',
      time: '10:15',
      timeMinutes: 615,
      type: 'proposal',
      actorId: 'actor-kot-rebel',
      actorName: 'Бунтарь Кот',
      actorAvatar: 'kot-rebel',
      actorAccent: 'amber',
      actorTitle: 'Магистр Спонтанности',
      text: 'Предлагаю на обед заказать пиццу с пепперони и двойным сыром. Никаких диет в пятницу!',
      supporters: ['actor-ratatouille', 'actor-alexey', 'actor-misha'],
      votesCount: 4,
      moodEmoji: '🍕',
      createdAt: '2026-11-06T10:15:00Z',
    },
    {
      id: 'note-today-3',
      dateKey: '2026-11-06',
      time: '12:45',
      timeMinutes: 765,
      type: 'thought',
      actorId: 'actor-dr-cerebro',
      actorName: 'Доктор Церебро',
      actorAvatar: 'cerebro',
      actorAccent: 'cyan',
      actorTitle: 'Кибернетик',
      text: 'Нейросети показывают 94% вероятность успешного завершения всех задач до 18:00.',
      supporters: ['actor-eva-ai'],
      votesCount: 2,
      moodEmoji: '🧠',
      createdAt: '2026-11-06T12:45:00Z',
    },
    {
      id: 'note-today-4',
      dateKey: '2026-11-06',
      time: '14:20',
      timeMinutes: 860,
      type: 'action',
      actorId: 'actor-kapitan-zaryad',
      actorName: 'Капитан Заряд',
      actorAvatar: 'kapitan',
      actorAccent: 'emerald',
      actorTitle: 'Энергетический Коуч',
      text: 'Пятиминутка бодрости! Сделал 50 отжиманий и выпил имбирный смузи. Кто со мной?',
      supporters: ['actor-viking-bjorn'],
      votesCount: 2,
      moodEmoji: '⚡',
      createdAt: '2026-11-06T14:20:00Z',
    },
    {
      id: 'note-today-cluster-1',
      dateKey: '2026-11-06',
      time: '15:58',
      timeMinutes: 958,
      type: 'proposal',
      actorId: 'actor-zeus',
      actorName: 'Зевс',
      actorAvatar: 'zeus',
      actorAccent: 'amber',
      actorTitle: 'Громовержец & Лидер',
      text: 'Заказать пиццу с пепперони и двойным сыром к вечерней игре!',
      supporters: ['actor-alexey', 'actor-solomon'],
      votesCount: 3,
      moodEmoji: '🍕',
      createdAt: '2026-11-06T15:58:00Z',
    },
    {
      id: 'note-today-cluster-2',
      dateKey: '2026-11-06',
      time: '15:58',
      timeMinutes: 958,
      type: 'thought',
      actorId: 'actor-zeus',
      actorName: 'Зевс',
      actorAvatar: 'zeus',
      actorAccent: 'amber',
      actorTitle: 'Громовержец & Лидер',
      text: 'И лимонад со льдом, пятничный настрой должен быть на максимуме.',
      supporters: ['actor-misha'],
      votesCount: 2,
      moodEmoji: '🥤',
      createdAt: '2026-11-06T15:58:30Z',
    },
    {
      id: 'note-today-cluster-3',
      dateKey: '2026-11-06',
      time: '16:15',
      timeMinutes: 975,
      type: 'action',
      actorId: 'actor-solomon',
      actorName: 'Мудрец Соломон',
      actorAvatar: 'solomon',
      actorAccent: 'violet',
      actorTitle: 'Хранитель Баланса',
      text: 'Заказ пиццы утвержден! Курьер прибудет к 17:00.',
      supporters: ['actor-zeus', 'actor-kot-rebel'],
      votesCount: 4,
      moodEmoji: '📦',
      createdAt: '2026-11-06T16:15:00Z',
    },
    {
      id: 'note-today-5',
      dateKey: '2026-11-06',
      time: '17:00',
      timeMinutes: 1020,
      type: 'proposal',
      actorId: 'actor-solomon',
      actorName: 'Мудрец Соломон',
      actorAvatar: 'solomon',
      actorAccent: 'violet',
      actorTitle: 'Хранитель Баланса',
      text: 'Предлагаю собраться за круглым столом в 19:30 и сыграть в настольные стратегии.',
      supporters: ['actor-alexey', 'actor-misha', 'actor-baker-croissant'],
      votesCount: 4,
      moodEmoji: '🎲',
      createdAt: '2026-11-06T17:00:00Z',
    },
    {
      id: 'note-today-6',
      dateKey: '2026-11-06',
      time: '19:45',
      timeMinutes: 1185,
      type: 'thought',
      actorId: 'actor-alexey',
      actorName: 'Алексей (в халате)',
      actorAvatar: 'alexey',
      actorAccent: 'rose',
      actorTitle: 'Архитектор Уюта',
      text: 'Халат надет, чай заварен, уют максимальный. Пятничный вечер обещает быть душевным.',
      supporters: ['actor-kot-rebel', 'actor-fairy-home'],
      votesCount: 3,
      moodEmoji: '🛋️',
      createdAt: '2026-11-06T19:45:00Z',
    },
    {
      id: 'note-today-7',
      dateKey: '2026-11-06',
      time: '21:30',
      timeMinutes: 1290,
      type: 'action',
      actorId: 'actor-dj-pixel',
      actorName: 'DJ Pixel',
      actorAvatar: 'pixel',
      actorAccent: 'violet',
      actorTitle: 'Синтезатор Атмосферы',
      text: 'Запустил вечерний сет чилл-хопа и синтвейва на колонках в общем зале. Звук пошёл!',
      supporters: ['actor-cyber-ninja', 'actor-kot-rebel'],
      votesCount: 3,
      moodEmoji: '🎧',
      createdAt: '2026-11-06T21:30:00Z',
    },
  ],
  '2026-11-05': [
    {
      id: 'note-yest-1',
      dateKey: '2026-11-05',
      time: '09:00',
      timeMinutes: 540,
      type: 'thought',
      actorId: 'actor-misha',
      actorName: 'Миша (Студент)',
      actorAvatar: 'misha',
      actorAccent: 'cyan',
      actorTitle: 'Любитель Настолок',
      text: 'Вчерашний шторм идей показал, что мы готовы к новому турниру по Манчкину!',
      supporters: ['actor-solomon'],
      votesCount: 2,
      moodEmoji: '💡',
      createdAt: '2026-11-05T09:00:00Z',
    },
    {
      id: 'note-yest-2',
      dateKey: '2026-11-05',
      time: '16:30',
      timeMinutes: 990,
      type: 'proposal',
      actorId: 'actor-ratatouille',
      actorName: 'Рататуй',
      actorAvatar: 'ratatouille',
      actorAccent: 'amber',
      actorTitle: 'Шеф Вкусовых Парадоксов',
      text: 'Провели дегустацию десертов с сыром. Теперь это наш фирменный перекус.',
      supporters: ['actor-baker-croissant', 'actor-alexey'],
      votesCount: 3,
      moodEmoji: '🧀',
      createdAt: '2026-11-05T16:30:00Z',
    },
    {
      id: 'note-yest-3',
      dateKey: '2026-11-05',
      time: '20:15',
      timeMinutes: 1215,
      type: 'action',
      actorId: 'actor-cyber-ninja',
      actorName: 'Кибер Ниндзя',
      actorAvatar: 'ninja',
      actorAccent: 'emerald',
      actorTitle: 'Спидраннер',
      text: 'Спидран аркады закрыт за 14 минут без единой потери жизней!',
      supporters: ['actor-dj-pixel'],
      votesCount: 2,
      moodEmoji: '🕹️',
      createdAt: '2026-11-05T20:15:00Z',
    },
  ],
  '2026-11-07': [
    {
      id: 'note-tom-1',
      dateKey: '2026-11-07',
      time: '11:00',
      timeMinutes: 660,
      type: 'proposal',
      actorId: 'actor-major-falcon',
      actorName: 'Майор Сокол',
      actorAvatar: 'falcon',
      actorAccent: 'amber',
      actorTitle: 'Инструктор Дисциплины',
      text: 'Субботнее предложение: утренний марш-бросок в парк и кофе на свежем воздухе.',
      supporters: ['actor-kapitan-zaryad'],
      votesCount: 2,
      moodEmoji: '🌲',
      createdAt: '2026-11-07T11:00:00Z',
    },
    {
      id: 'note-tom-2',
      dateKey: '2026-11-07',
      time: '15:30',
      timeMinutes: 930,
      type: 'thought',
      actorId: 'actor-fairy-home',
      actorName: 'Домашняя Фея',
      actorAvatar: 'fairy',
      actorAccent: 'rose',
      actorTitle: 'Фея Уюта',
      text: 'Завтра планирую испечь тыквенный пирог с корицей для всей компании.',
      supporters: ['actor-alexey', 'actor-baker-croissant'],
      votesCount: 3,
      moodEmoji: '🥧',
      createdAt: '2026-11-07T15:30:00Z',
    },
    {
      id: 'note-tom-3',
      dateKey: '2026-11-07',
      time: '20:00',
      timeMinutes: 1200,
      type: 'proposal',
      actorId: 'actor-baker-croissant',
      actorName: 'Пекарь Круассан',
      actorAvatar: 'baker',
      actorAccent: 'amber',
      actorTitle: 'Мастер Выпечки',
      text: 'Киноночь субботы: смотрим космическую фантастику под свежую выпечку.',
      supporters: ['actor-solomon', 'actor-misha'],
      votesCount: 2,
      moodEmoji: '🍿',
      createdAt: '2026-11-07T20:00:00Z',
    },
  ],
};

@Component({
  selector: 'app-party-cloud',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    SlicePipe,
    FormsModule,
    RouterLink,
    ActorAvatarComponent,
    ModalOverlayDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes thoughtPopIn {
        0% {
          transform: scale(0.8) translateY(8px);
          opacity: 0;
        }
        70% {
          transform: scale(1.02) translateY(-2px);
          opacity: 1;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }

      @keyframes pulseGlowRing {
        0%,
        100% {
          opacity: 0.35;
          transform: scale(1);
        }
        50% {
          opacity: 0.85;
          transform: scale(1.06);
        }
      }

      .thought-pop {
        animation: thoughtPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }

      .now-sun-glow {
        animation: pulseGlowRing 2.4s ease-in-out infinite;
      }
    `,
  ],
  template: `
    <div class="flex flex-col gap-space-lg pb-16">
      <!-- 1. TOP BREADCRUMB & ROOM REAL-TIME HUD -->
      <nav class="flex items-center justify-between gap-space-md flex-wrap">
        <div class="flex items-center gap-2 text-xs font-label-ui">
          <a
            routerLink="/party"
            class="text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold no-underline"
          >
            <span class="material-symbols-rounded text-base">arrow_back</span>
            <span>Главное Меню</span>
          </a>
          <span class="text-outline-variant">/</span>
          <span class="text-primary font-bold flex items-center gap-1">
            <span class="material-symbols-rounded text-base">cloud</span>
            <span>Хроно-Облако: День Персонажей</span>
          </span>
          <span
            class="font-label-code-sm text-[10px] px-2 py-0.2 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-300 font-extrabold uppercase ml-1"
          >
            ⭐ Главная Игра
          </span>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div
            class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-label-code-sm text-emerald-700 dark:text-emerald-300 font-bold"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Лобби Активно ({{ realtime.latencyMs() }}ms)</span>
          </div>

          <button
            type="button"
            (click)="openCreateSpaceModal()"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold transition-all border border-outline-variant/30 shadow-xs cursor-pointer"
          >
            <span class="material-symbols-rounded text-base text-primary">add_circle</span>
            <span>+ Новое Пространство</span>
          </button>
        </div>
      </nav>

      <!-- 2. DATE SELECTOR & CLOUD CONTROLS STRIP (CLEAN & SPACIOUS) -->
      <section
        class="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 shadow-xs border border-outline-variant/30 flex flex-col gap-4"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <!-- Date Tabs Attached to Date -->
          <div class="flex items-center gap-2 overflow-x-auto py-1">
            <span class="font-label-ui text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1 flex-shrink-0 flex items-center gap-1">
              <span class="material-symbols-rounded text-base text-primary">calendar_today</span>
              День:
            </span>

            @for (tab of dateTabs(); track tab.dateKey) {
              <button
                type="button"
                (click)="selectDate(tab.dateKey)"
                class="px-3.5 py-2 rounded-2xl font-label-ui text-xs font-bold transition-all flex items-center gap-2 border flex-shrink-0 cursor-pointer"
                [class]="
                  selectedDateKey() === tab.dateKey
                    ? 'bg-primary text-on-primary border-primary shadow-sm scale-102'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
                "
              >
                <span>{{ tab.label }}</span>
                <span
                  class="text-[10px] px-1.5 py-0.2 rounded-full font-label-code-sm"
                  [class]="
                    selectedDateKey() === tab.dateKey
                      ? 'bg-on-primary/20 text-on-primary'
                      : 'bg-surface-container-highest text-outline font-semibold'
                  "
                >
                  {{ tab.notesCount }} мыслей
                </span>
              </button>
            }
          </div>

          <!-- View Mode Toggle: Interactive Cloud Canvas vs Daily Feed -->
          <div class="flex items-center gap-1.5 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30 self-start lg:self-center">
            <button
              type="button"
              (click)="viewMode.set('CLOUD_TIMELINE')"
              class="px-3.5 py-1.5 rounded-xl font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
              [class]="
                isCloudView()
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">cloud</span>
              <span>☁️ Мультяшное Облако</span>
            </button>

            <button
              type="button"
              (click)="viewMode.set('DAY_FEED')"
              class="px-3.5 py-1.5 rounded-xl font-label-ui text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
              [class]="
                isFeedView()
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span class="material-symbols-rounded text-base">format_list_bulleted</span>
              <span>📋 Хроника Дня</span>
            </button>
          </div>
        </div>

        <!-- Filter Action Types & Subtitle -->
        <div class="flex items-center justify-between gap-3 pt-3 border-t border-outline-variant/20 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-label-ui text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1">
              Фильтр записей:
            </span>
            <button
              type="button"
              (click)="activeLayer.set('ALL')"
              class="px-3 py-1 rounded-xl font-label-ui text-xs font-semibold transition-all border cursor-pointer"
              [class]="
                activeLayer() === 'ALL'
                  ? 'bg-primary-container text-on-primary-container border-primary font-bold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/25'
              "
            >
              Все ({{ activeDateNotes().length }})
            </button>

            <button
              type="button"
              (click)="activeLayer.set('THOUGHTS')"
              class="px-3 py-1 rounded-xl font-label-ui text-xs font-semibold transition-all border cursor-pointer"
              [class]="
                activeLayer() === 'THOUGHTS'
                  ? 'bg-amber-400/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/25'
              "
            >
              💭 Мысли ({{ countNotesByType('thought') }})
            </button>

            <button
              type="button"
              (click)="activeLayer.set('PROPOSALS')"
              class="px-3 py-1 rounded-xl font-label-ui text-xs font-semibold transition-all border cursor-pointer"
              [class]="
                activeLayer() === 'PROPOSALS'
                  ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500 font-bold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/25'
              "
            >
              💡 Предложения ({{ countNotesByType('proposal') }})
            </button>

            <button
              type="button"
              (click)="activeLayer.set('ACTIONS')"
              class="px-3 py-1 rounded-xl font-label-ui text-xs font-semibold transition-all border cursor-pointer"
              [class]="
                activeLayer() === 'ACTIONS'
                  ? 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border-indigo-500 font-bold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/25'
              "
            >
              ⚡ Экшены ({{ countNotesByType('action') }})
            </button>
          </div>

          <div class="text-[11px] font-label-code-sm text-on-surface-variant flex items-center gap-2">
            <span>{{ visibleNotes().length }} записей отображается</span>
            <span class="text-outline">·</span>
            <span>Кликните по таймлайну внизу для выбора часа</span>
          </div>
        </div>
      </section>

      <!-- 3. MAIN CARTOON CLOUD STAGE (STATIC CONTAINER, BOTTOM TIMELINE WITH CANDLESTICK COLUMNS) -->
      @if (isCloudView()) {
        <div
          class="relative w-full rounded-[44px] bg-gradient-to-b from-sky-100/70 via-amber-50/40 to-sky-100/50 dark:from-slate-950 dark:via-[#161b2b] dark:to-slate-900 border-3 border-amber-300/50 dark:border-amber-400/25 p-4 sm:p-6 lg:p-8 overflow-hidden shadow-xl isolate select-none"
        >
          <!-- Background Atmospheric Sparks & Companion Clouds (Static) -->
          <div class="absolute top-4 left-6 pointer-events-none opacity-40">
            <span class="text-4xl">☁️</span>
          </div>
          <div class="absolute top-8 right-12 pointer-events-none opacity-35">
            <span class="text-3xl">✨</span>
          </div>
          <div class="absolute bottom-6 left-16 pointer-events-none opacity-30">
            <span class="text-2xl">⭐</span>
          </div>

          <!-- THE GRAND FLUFFY CARTOON CLOUD CONTAINER (STATIC - CRISP & HIGH PERFORMANCE) -->
          <div
            class="relative w-full min-h-[640px] bg-white/95 dark:bg-[#1b1e2a]/95 backdrop-blur-md rounded-[48px] border-4 border-amber-300 dark:border-amber-400/50 shadow-xl p-5 sm:p-7 flex flex-col justify-between overflow-x-auto"
          >
            <!-- Decorative Puffy Lobes on Top of Cloud (Static SVG/CSS) -->
            <div class="absolute -top-6 left-12 w-20 h-14 bg-white/95 dark:bg-[#1b1e2a]/95 rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>
            <div class="absolute -top-10 left-36 w-32 h-20 bg-white/95 dark:bg-[#1b1e2a]/95 rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>
            <div class="absolute -top-7 right-32 w-24 h-16 bg-white/95 dark:bg-[#1b1e2a]/95 rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>

            <!-- In-Cloud Header Strip -->
            <div class="relative z-10 flex items-center justify-between gap-3 border-b border-amber-200/60 dark:border-outline-variant/30 pb-3 flex-wrap">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-2xl bg-amber-400/25 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xl shadow-xs">
                  ☁️
                </div>
                <div>
                  <h2 class="font-headline-sm text-base sm:text-lg font-black text-on-surface">
                    Хроно-Облако Дня: {{ getActiveDateFormatted() }}
                  </h2>
                  <p class="font-body-sm text-[11px] text-on-surface-variant">
                    Таймлайн мыслей и предложений с 08:00 до 24:00 · График временных столбцов
                  </p>
                </div>
              </div>

              <!-- Day Mood & Vibe Badges -->
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Vibe Selector Button -->
                <button
                  type="button"
                  (click)="toggleVibePicker()"
                  class="px-3 py-1.5 rounded-full bg-surface-container-high/90 hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 text-xs font-bold font-label-ui flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  title="Настроить вайб и атмосферный фон дня"
                >
                  <span>{{ currentVibe().icon }}</span>
                  <span>Вайб: {{ currentVibe().name.split(' (')[0] }}</span>
                  <span class="material-symbols-rounded text-sm text-outline">tune</span>
                </button>

                <!-- Synergy Badge -->
                <span class="px-3 py-1.5 rounded-full bg-amber-400/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 text-xs font-bold font-label-code-sm flex items-center gap-1.5 shadow-2xs">
                  <span class="text-sm">☀️</span>
                  <span>{{ synergyPercent() }}% Синергия</span>
                </span>
              </div>
            </div>

            <!-- CENTRAL IN-CLOUD TIMELINE SKY (CANDLESTICK STEM CHART WITH ATMOSPHERIC DAY SECTORS) -->
            <div class="relative z-10 flex-1 my-4 min-h-[520px] flex flex-col justify-end min-w-[920px] px-8 pb-3 pt-4 rounded-3xl overflow-hidden border border-outline-variant/20 shadow-inner isolate">
              <!-- 1. DYNAMIC SKY GRADIENT & TIME-OF-DAY ATMOSPHERIC SECTORS -->
              <div class="absolute inset-0 transition-all duration-700 pointer-events-none -z-10" [class]="currentVibe().skyGradient">
                <!-- Ambient sky lighting wash -->
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/40 dark:to-slate-950/50"></div>

                <!-- TIME OF DAY DIVIDERS WITH DASHED MERIDIANS & SECTOR CHIPS -->
                <!-- Sector 1: Morning (08:00 — 12:00 = 25% width) -->
                <div class="absolute inset-y-0 left-0 w-[25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-amber-500/35 pointer-events-none">
                  <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 text-[10px] font-bold font-label-code-sm self-start backdrop-blur-xs shadow-2xs">
                    <span>🌅</span>
                    <span>Утро (08:00 — 12:00)</span>
                  </div>
                  <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[0] }}</div>
                </div>

                <!-- Sector 2: Midday / Afternoon (12:00 — 17:00 = 31.25% width) -->
                <div class="absolute inset-y-0 left-[25%] w-[31.25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-sky-500/35 pointer-events-none">
                  <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-900 dark:text-sky-200 border border-sky-400/40 text-[10px] font-bold font-label-code-sm self-start backdrop-blur-xs shadow-2xs">
                    <span>☀️</span>
                    <span>День (12:00 — 17:00)</span>
                  </div>
                  <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[1] }}</div>
                </div>

                <!-- Sector 3: Evening / Sunset (17:00 — 21:00 = 25% width) -->
                <div class="absolute inset-y-0 left-[56.25%] w-[25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-purple-500/35 pointer-events-none">
                  <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-400/20 text-purple-900 dark:text-purple-200 border border-purple-400/40 text-[10px] font-bold font-label-code-sm self-start backdrop-blur-xs shadow-2xs">
                    <span>🌆</span>
                    <span>Вечер (17:00 — 21:00)</span>
                  </div>
                  <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[2] }}</div>
                </div>

                <!-- Sector 4: Night / Starlight (21:00 — 24:00 = 18.75% width) -->
                <div class="absolute inset-y-0 left-[81.25%] right-0 flex flex-col justify-between p-3 pointer-events-none">
                  <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border border-indigo-400/40 text-[10px] font-bold font-label-code-sm self-start backdrop-blur-xs shadow-2xs">
                    <span>🌙</span>
                    <span>Ночь (21:00 — 24:00)</span>
                  </div>
                  <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[3] }}</div>
                </div>
              </div>

              <!-- CANDLESTICK TIME GRID COLUMNS (BACKGROUND SUBTLE TICKS) -->
              <div class="absolute inset-0 bottom-16 flex pointer-events-none opacity-20 -z-5">
                @for (m of hourMilestones; track m.label; let midx = $index) {
                  <div
                    class="h-full border-r border-dotted border-outline-variant/40 flex-1 relative flex flex-col justify-between"
                  >
                    <span class="text-[9px] font-mono text-outline/60 p-2 font-semibold">{{ m.label }}</span>
                  </div>
                }
              </div>

              <!-- FLOATING THOUGHTS ANCHORED BY VERTICAL CANDLESTICK COLUMNS (WITH 30-MIN STACK CLUSTERING) -->
              @for (cluster of groupedTimelineNotes(); track cluster.id; let idx = $index) {
                @if (getClusterActiveNote(cluster); as note) {
                  <div
                    class="absolute bottom-11 flex flex-col items-center thought-pop group z-10 hover:z-30 pointer-events-auto"
                    [style.left]="getTimelinePercent(cluster.timeMinutes) + '%'"
                    style="transform: translateX(-50%);"
                  >
                    <!-- 1. THOUGHT / PROPOSAL BUBBLE (FLOATING IN THE AIR WITH CARD STACK) -->
                    <div class="relative w-[220px] sm:w-[250px]">
                      <!-- Back Stack Layer 2 (If 3+ notes in cluster) -->
                      @if (cluster.isCluster && cluster.notes.length > 2) {
                        <div
                          class="absolute inset-0 rounded-2xl bg-amber-100/70 dark:bg-slate-700/60 border-2 border-outline-variant/30 shadow-2xs pointer-events-none transform -translate-x-1.5 translate-y-2.5 -rotate-2 -z-20 transition-transform group-hover:-translate-x-2.5 group-hover:translate-y-3.5"
                        ></div>
                      }

                      <!-- Back Stack Layer 1 (If cluster) -->
                      @if (cluster.isCluster) {
                        <div
                          class="absolute inset-0 rounded-2xl bg-white/75 dark:bg-slate-800/75 border-2 border-outline-variant/40 shadow-xs pointer-events-none transform translate-x-1.5 translate-y-1.5 rotate-2 -z-10 transition-transform group-hover:translate-x-2.5 group-hover:translate-y-2.5"
                        ></div>
                      }

                      <!-- Main Active Note Card -->
                      <div
                        (click)="inspectNote(note)"
                        class="relative p-3 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-md group-hover:shadow-2xl group-hover:scale-105 transition-all duration-200 border-2 w-full cursor-pointer"
                        [class]="getNoteBorderClass(note.actorAccent)"
                      >
                        <!-- Mini Header: Avatar + Name + Stack Paginator + Emoji -->
                        <div class="flex items-center gap-1.5 mb-1.5">
                          <app-actor-avatar
                            [avatar]="note.actorAvatar"
                            containerClass="w-7 h-7 rounded-xl shadow-xs ring-1 ring-outline-variant/30 flex-shrink-0"
                          />
                          <div class="flex flex-col truncate min-w-0 flex-1">
                            <span class="text-xs font-bold text-on-surface truncate">{{ note.actorName }}</span>
                            <span class="text-[10px] font-mono text-outline font-semibold">{{ note.time }}</span>
                          </div>

                          <!-- Mini Stack Paginator -->
                          @if (cluster.isCluster) {
                            <div
                              (click)="$event.stopPropagation()"
                              class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold shadow-2xs flex-shrink-0 select-none"
                              [title]="'Стопка: 30-минутное окно (' + cluster.notes.length + ' мыслей)'"
                            >
                              <button
                                type="button"
                                (click)="prevClusterNote(cluster.id, cluster.notes.length, $event)"
                                class="w-4 h-4 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-xs font-black"
                                title="Предыдущая мысль в стопке"
                              >
                                ‹
                              </button>
                              <span class="px-0.5">{{ getClusterActiveIndex(cluster.id) + 1 }}/{{ cluster.notes.length }}</span>
                              <button
                                type="button"
                                (click)="nextClusterNote(cluster.id, cluster.notes.length, $event)"
                                class="w-4 h-4 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-xs font-black"
                                title="Следующая мысль в стопке"
                              >
                                ›
                              </button>
                            </div>
                          }

                          <span class="ml-0.5 text-sm flex-shrink-0" [title]="getTypeLabel(note.type)">
                            {{ getTypeEmoji(note.type) }}
                          </span>
                        </div>

                        <!-- Thought Text -->
                        <p class="text-xs font-body-sm text-on-surface leading-snug line-clamp-3 italic min-h-[2.5rem]">
                          «{{ note.text }}»
                        </p>

                        <!-- Bubble Footer with +1 Support, Dot Indicators & Delete -->
                        <div class="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-outline-variant/20">
                          <button
                            type="button"
                            (click)="voteForNote(note.id, $event)"
                            class="px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-label-code-sm inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                            title="Поддержать мысль персонажа (+1)"
                          >
                            <span>❤️</span>
                            <span>{{ note.votesCount }}</span>
                          </button>

                          <!-- Dot indicators for direct jumps inside stack -->
                          @if (cluster.isCluster) {
                            <div class="flex items-center gap-1" (click)="$event.stopPropagation()">
                              @for (item of cluster.notes; track item.id; let dotIdx = $index) {
                                <button
                                  type="button"
                                  (click)="setClusterIndex(cluster.id, dotIdx, $event)"
                                  class="h-1.5 rounded-full transition-all cursor-pointer"
                                  [class]="dotIdx === getClusterActiveIndex(cluster.id) ? 'w-3.5 bg-amber-500' : 'w-1.5 bg-outline-variant/60 hover:bg-outline-variant'"
                                  [title]="'Мысль ' + (dotIdx + 1) + ': ' + item.actorName + ' (' + item.time + ')'"
                                ></button>
                              }
                            </div>
                          }

                          <button
                            type="button"
                            (click)="deleteNote(note.id, $event)"
                            class="opacity-0 group-hover:opacity-100 p-0.5 rounded text-outline hover:text-rose-500 transition-opacity"
                            title="Удалить мысль"
                          >
                            <span class="material-symbols-rounded text-sm">close</span>
                          </button>
                        </div>

                        <!-- Triangular bottom tail pointing to candlestick column -->
                        <div
                          class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-b-2 border-r-2"
                          [class]="getNoteBorderClass(note.actorAccent)"
                        ></div>
                      </div>
                    </div>

                    <!-- 2. VERTICAL CANDLESTICK COLUMN / STEM (CONNECTS BUBBLE DOWN TO TIMELINE) -->
                    <div
                      class="w-1.5 rounded-full transition-all group-hover:w-2.5 shadow-xs my-0.5"
                      [class]="getAccentStemClasses(note.actorAccent)"
                      [style.height.px]="getNoteStemHeight(idx)"
                    ></div>

                    <!-- 3. BASE PIN ON THE TIMELINE ROAD -->
                    <div class="flex flex-col items-center">
                      <div
                        class="rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs flex items-center justify-center transition-transform group-hover:scale-125"
                        [class]="cluster.isCluster ? 'w-5 h-5 font-mono text-[10px] font-bold text-white' : 'w-3.5 h-3.5'"
                        [class]="getAccentGlowClasses(note.actorAccent)"
                      >
                        @if (cluster.isCluster) {
                          <span>{{ cluster.notes.length }}</span>
                        } @else {
                          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                        }
                      </div>
                      <span class="text-[9px] font-mono font-bold text-on-surface-variant bg-white/90 dark:bg-slate-900/90 px-1 py-0.2 rounded shadow-2xs mt-0.5 whitespace-nowrap">
                        {{ cluster.time }}
                      </span>
                    </div>
                  </div>
                }
              }

              <!-- THE BOTTOM TIMELINE AXIS (TRADING CHART FLOOR) -->
              <div class="relative w-full mt-auto pt-8 pb-1">
                <!-- Horizontal Road Bar -->
                <div
                  (click)="onTimelineRoadClick($event)"
                  class="relative w-full h-5 rounded-full bg-gradient-to-r from-amber-400 via-orange-300 via-sky-400 to-indigo-500 shadow-inner flex items-center cursor-pointer group"
                  title="Кликните в любую точку шкалы, чтобы выбрать время для мысли"
                >
                  <!-- Dashed Center Lane of Cartoon Road -->
                  <div class="absolute inset-x-2 border-t-2 border-dashed border-white/70 pointer-events-none"></div>

                  <!-- Milestone Hour Nodes Along Road -->
                  @for (m of hourMilestones; track m.label) {
                    <div
                      class="absolute flex flex-col items-center pointer-events-none"
                      [style.left]="getTimelinePercent(m.minutes) + '%'"
                      style="transform: translateX(-50%);"
                    >
                      <div class="w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-600 shadow-xs"></div>
                      <span class="text-[10px] font-mono font-bold text-on-surface-variant mt-2 whitespace-nowrap bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.2 rounded-md shadow-2xs">
                        {{ m.icon }} {{ m.label }}
                      </span>
                    </div>
                  }

                  <!-- "СЕЙЧАС" (NOW) INDICATOR PIN -->
                  @if (isTodaySelected()) {
                    <div
                      class="absolute flex flex-col items-center pointer-events-none z-20"
                      [style.left]="getCurrentTimePercent() + '%'"
                      style="transform: translateX(-50%);"
                    >
                      <!-- Vertical dashed line rising through the sky -->
                      <div class="w-0.5 h-80 border-l-2 border-dashed border-amber-500/50 -mb-2"></div>
                      <div class="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-xs now-sun-glow">
                        ☀️
                      </div>
                      <span class="text-[9px] font-label-code-sm font-extrabold text-amber-900 dark:text-amber-200 bg-amber-300 dark:bg-amber-600 px-1.5 py-0.2 rounded-full shadow-xs -mt-1 whitespace-nowrap">
                        Сейчас {{ currentTimeString() }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- In-Cloud Bottom Info Strip -->
            <div class="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-amber-200/50 dark:border-outline-variant/30 text-xs text-on-surface-variant">
              <div class="flex items-center gap-2">
                <span class="text-base">✨</span>
                <span>Каждая мысль прикреплена столбцом ко времени на нижней линии. Кликните по линии времени для выбора часа.</span>
              </div>
              <div class="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-800 dark:text-amber-300">
                <span>Хроно-Шкала: 08:00 — 24:00</span>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- 4. CHRONOLOGICAL DAY FEED (ALTERNATIVE LIST VIEW) -->
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (period of dayPeriods; track period.id) {
              <div class="bg-surface-container-lowest rounded-3xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between min-h-[440px]">
                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-lg">{{ period.icon }}</span>
                      <h3 class="font-headline-sm text-sm font-bold text-on-surface">{{ period.title }}</h3>
                    </div>
                    <span class="font-mono text-[10px] text-outline font-semibold">{{ period.hours }}</span>
                  </div>

                  <!-- Notes in this Period -->
                  <div class="flex flex-col gap-2.5 overflow-y-auto max-h-[320px] pr-1">
                    @for (note of getNotesForPeriod(period.min, period.max); track note.id) {
                      <div
                        class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 hover:border-primary/50 transition-all flex flex-col gap-2"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex items-center gap-2 truncate">
                            <app-actor-avatar
                              [avatar]="note.actorAvatar"
                              containerClass="w-6 h-6 rounded-lg ring-1 ring-outline-variant/30 flex-shrink-0"
                            />
                            <span class="text-xs font-bold text-on-surface truncate">{{ note.actorName }}</span>
                          </div>
                          <span class="font-mono text-[10px] text-outline">{{ note.time }}</span>
                        </div>

                        <p class="text-xs font-body-sm text-on-surface italic leading-snug">
                          «{{ note.text }}»
                        </p>

                        <div class="flex items-center justify-between pt-1 border-t border-outline-variant/15 text-[11px]">
                          <span class="font-label-code-sm text-[10px] text-outline uppercase">{{ getTypeLabel(note.type) }}</span>
                          <button
                            type="button"
                            (click)="voteForNote(note.id)"
                            class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono inline-flex items-center gap-1"
                          >
                            <span>❤️</span>
                            <span>{{ note.votesCount }}</span>
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="text-center py-8 text-xs text-outline italic">
                        В этом слоте пока нет мыслей
                      </div>
                    }
                  </div>
                </div>

                <div class="pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <span class="text-[11px] font-label-code-sm text-outline">
                    {{ getNotesForPeriod(period.min, period.max).length }} записей
                  </span>
                  <button
                    type="button"
                    (click)="setTimeForSlot(period.defaultTime)"
                    class="px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container text-[11px] font-bold font-label-ui transition-all"
                  >
                    + В этот слот
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- 5. MULTI-CHARACTER ROLEPLAY ACTION BAR (OPTIMIZED, SLEEK & COMPACT) -->
      <section
        class="sticky bottom-4 z-30 p-3 sm:p-3.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-primary/30 shadow-lg flex flex-col gap-2 isolate transition-all"
      >
        <!-- Row 1: Hero Selector Chips & Mode Switcher -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <!-- Character Chips Strip -->
          <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 flex-1 scrollbar-none">
            <span class="inline-flex items-center gap-1 text-[11px] font-label-ui font-semibold text-on-surface-variant flex-shrink-0 mr-0.5">
              <span class="material-symbols-rounded text-sm text-primary">theater_comedy</span>
              <span>Герой:</span>
            </span>

            @for (actor of quickActors(); track actor.id) {
              <button
                type="button"
                (click)="selectPitchActor(actor)"
                class="px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer"
                [class]="
                  activePitchActor()?.id === actor.id
                    ? 'border-primary bg-primary-container text-on-primary-container font-bold shadow-xs ring-1 ring-primary/40'
                    : 'border-outline-variant/30 bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                "
              >
                <app-actor-avatar [avatar]="actor.avatarIcon" containerClass="w-5 h-5 rounded-md flex-shrink-0" />
                <span class="text-xs font-label-ui whitespace-nowrap">{{ actor.name }}</span>
              </button>
            }

            <button
              type="button"
              (click)="toggleCharacterPicker()"
              class="px-2.5 py-1 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 flex-shrink-0 transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-sm text-primary">groups</span>
              <span>Все 30...</span>
            </button>
          </div>

          <!-- Action Type Segmented Selector -->
          <div class="flex items-center gap-0.5 bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/30 flex-shrink-0">
            <button
              type="button"
              (click)="selectedActionType.set('thought')"
              class="px-2.5 py-1 rounded-lg text-xs font-bold font-label-ui transition-colors flex items-center gap-1 cursor-pointer"
              [class]="
                selectedActionType() === 'thought'
                  ? 'bg-amber-400/25 text-amber-900 dark:text-amber-200 border border-amber-400/40 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>💭</span>
              <span>Мысль</span>
            </button>

            <button
              type="button"
              (click)="selectedActionType.set('proposal')"
              class="px-2.5 py-1 rounded-lg text-xs font-bold font-label-ui transition-colors flex items-center gap-1 cursor-pointer"
              [class]="
                selectedActionType() === 'proposal'
                  ? 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border border-emerald-500/40 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>💡</span>
              <span>Идея</span>
            </button>

            <button
              type="button"
              (click)="selectedActionType.set('action')"
              class="px-2.5 py-1 rounded-lg text-xs font-bold font-label-ui transition-colors flex items-center gap-1 cursor-pointer"
              [class]="
                selectedActionType() === 'action'
                  ? 'bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 border border-indigo-500/40 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              "
            >
              <span>⚡</span>
              <span>Экшен</span>
            </button>
          </div>
        </div>

        <!-- Row 2: Time, Input & Submit -->
        <div class="flex items-center gap-2">
          <!-- Time Picker Box -->
          <div class="flex items-center gap-1 bg-surface-container-low hover:bg-surface-container px-2.5 py-1.5 rounded-xl border border-outline-variant/40 transition-colors flex-shrink-0">
            <span class="material-symbols-rounded text-sm text-primary">schedule</span>
            <input
              type="time"
              [(ngModel)]="newNoteTime"
              class="bg-transparent text-xs font-mono font-bold text-on-surface focus:outline-none w-14 cursor-pointer"
            />
          </div>

          <!-- Text Input -->
          <input
            type="text"
            [(ngModel)]="newIdeaTitle"
            (keyup.enter)="submitNoteOrIdea()"
            [placeholder]="inputPlaceholder()"
            class="flex-1 px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container-lowest placeholder:text-outline transition-all"
          />

          <!-- Submit Button -->
          <button
            type="button"
            (click)="submitNoteOrIdea()"
            class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-ui text-xs font-bold shadow-xs active:scale-97 transition-all flex-shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span class="material-symbols-rounded text-base">cloud_upload</span>
            <span>В облако ✨</span>
          </button>
        </div>

        <!-- Row 3: Clean Quick Presets -->
        <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span class="inline-flex items-center gap-1 text-[10px] font-label-code-sm text-outline font-extrabold uppercase mr-1 flex-shrink-0">
            <span class="material-symbols-rounded text-xs text-primary">bolt</span>
            <span>Быстро:</span>
          </span>
          @for (preset of thoughtPresets; track preset.title) {
            <button
              type="button"
              (click)="pitchPreset(preset)"
              class="px-2.5 py-0.5 rounded-full bg-surface-container-low hover:bg-primary-container hover:text-on-primary-container hover:border-primary/40 border border-outline-variant/25 text-on-surface-variant text-[11px] font-label-code-sm font-semibold transition-colors flex-shrink-0 cursor-pointer"
            >
              {{ preset.icon }} {{ preset.title }}
            </button>
          }
        </div>
      </section>

      <!-- 6. MODAL: ALL 30 CHARACTERS PICKER (MEETS STRICT AGENT RULES) -->
      @if (isCharacterPickerOpen()) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="closeCharacterPickerModal()"
          aria-labelledby="char-picker-modal-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[85vh] overflow-hidden"
          >
            <!-- Header with Explicit Close Button -->
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-primary text-2xl">groups</span>
                <h2 id="char-picker-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                  Выберите Персонажа для Мыслей & Предложений
                </h2>
              </div>
              <button
                type="button"
                (click)="closeCharacterPickerModal()"
                class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                aria-label="Закрыть"
              >
                <span class="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            <!-- Scrollable 30 Characters Grid -->
            <div class="overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-1">
              @for (actor of allActors(); track actor.id) {
                <button
                  type="button"
                  (click)="selectPitchActor(actor)"
                  class="p-2.5 rounded-2xl border flex flex-col items-center gap-2 hover:bg-surface-container-high transition-colors text-center cursor-pointer group"
                  [class]="
                    activePitchActor()?.id === actor.id
                      ? 'border-primary bg-primary-container/25 ring-2 ring-primary shadow-xs'
                      : 'border-outline-variant/30 bg-surface-container-low'
                  "
                >
                  <app-actor-avatar [avatar]="actor.avatarIcon" containerClass="w-12 h-12 rounded-2xl shadow-xs flex-shrink-0" />
                  <div class="flex flex-col items-center w-full truncate">
                    <span class="font-label-ui text-xs font-bold text-on-surface truncate w-full">{{ actor.name }}</span>
                    <span class="font-label-code-sm text-[10px] text-outline truncate w-full">{{ actor.title }}</span>
                  </div>
                </button>
              }
            </div>

            <!-- Footer with Cancel Button -->
            <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="closeCharacterPickerModal()"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }

      <!-- 7. MODAL: CREATE NEW PARTY SPACE (HOST SPACE) (MEETS STRICT AGENT RULES) -->
      @if (isCreateSpaceModalOpen()) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="closeCreateSpaceModal()"
          aria-labelledby="create-space-modal-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface"
          >
            <!-- Header with Explicit Close Button -->
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-primary text-2xl">add_circle</span>
                <h2 id="create-space-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                  Создать Новое Пространство Вечеринки
                </h2>
              </div>
              <button
                type="button"
                (click)="closeCreateSpaceModal()"
                class="p-1.5 rounded-lg text-outline hover:text-on-surface cursor-pointer"
                aria-label="Закрыть"
              >
                <span class="material-symbols-rounded text-lg">close</span>
              </button>
            </div>

            <!-- Host character selection -->
            <div class="flex flex-col gap-1.5">
              <label for="host-select" class="font-label-ui text-xs font-bold text-on-surface-variant">
                👑 Хост / Создатель пространства:
              </label>
              <select
                id="host-select"
                [ngModel]="newSpaceHostId()"
                (ngModelChange)="onHostChange($event)"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                @for (actor of allActors(); track actor.id) {
                  <option [value]="actor.id">{{ actor.name }} ({{ actor.title }})</option>
                }
              </select>
            </div>

            <!-- Title -->
            <div class="flex flex-col gap-1.5">
              <label for="space-title-input" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Название пространства:
              </label>
              <input
                id="space-title-input"
                type="text"
                [(ngModel)]="newSpaceTitle"
                placeholder="Напр. Friday Chill Core / Логово Кота / Лаборатория"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
              />
            </div>

            <!-- Description -->
            <div class="flex flex-col gap-1.5">
              <label for="space-desc-input" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Тема встречи & Описание:
              </label>
              <textarea
                id="space-desc-input"
                [(ngModel)]="newSpaceDescription"
                rows="2"
                placeholder="Напр. Собираемся на чилл, обсуждаем игры и делимся мыслями..."
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface resize-none"
              ></textarea>
            </div>

            <!-- Footer with Cancel and Submit -->
            <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="closeCreateSpaceModal()"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                (click)="submitCreateSpace()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-95 cursor-pointer"
              >
                🚀 Запустить Пространство
              </button>
            </div>
          </div>
        </div>
      }

      <!-- 8. MODAL: INSPECT DAY NOTE / CARD DETAIL (COMPLIES WITH MODAL DIALOGS RULE) -->
      @if (inspectedNote(); as note) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="closeInspectModal()"
          aria-labelledby="inspect-note-modal-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface animate-scale-in"
          >
            <!-- Header with Explicit Close Button & Cluster Paginator -->
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getTypeEmoji(note.type) }}</span>
                <h2 id="inspect-note-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                  {{ getTypeLabel(note.type) }}: {{ note.actorName }}
                </h2>
              </div>
              <div class="flex items-center gap-2">
                @if (getInspectedNoteCluster(); as cluster) {
                  <div
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold"
                    [title]="'Навигация по стопке (' + cluster.notes.length + ' мыслей)'"
                  >
                    <button
                      type="button"
                      (click)="prevInspectedClusterNote(cluster)"
                      class="w-5 h-5 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-sm font-black"
                      title="Предыдущая мысль в стопке"
                    >
                      ‹
                    </button>
                    <span>
                      {{ getInspectedNoteClusterIndex(cluster) + 1 }} / {{ cluster.notes.length }}
                    </span>
                    <button
                      type="button"
                      (click)="nextInspectedClusterNote(cluster)"
                      class="w-5 h-5 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-sm font-black"
                      title="Следующая мысль в стопке"
                    >
                      ›
                    </button>
                  </div>
                }

                <button
                  type="button"
                  (click)="closeInspectModal()"
                  class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  aria-label="Закрыть"
                >
                  <span class="material-symbols-rounded text-xl">close</span>
                </button>
              </div>
            </div>

            <!-- Hero Identity Strip -->
            <div class="flex items-center gap-3.5 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <app-actor-avatar
                [avatar]="note.actorAvatar"
                containerClass="w-14 h-14 rounded-2xl shadow-sm ring-2 ring-primary/40 flex-shrink-0"
              />
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-headline-sm text-base font-black text-on-surface truncate">{{ note.actorName }}</span>
                  <span class="text-[11px] px-2 py-0.5 rounded-full font-label-code-sm font-bold" [class]="getNoteBorderClass(note.actorAccent)">
                    {{ getTypeEmoji(note.type) }} {{ getTypeLabel(note.type) }}
                  </span>
                </div>
                <span class="text-xs font-label-ui text-primary font-semibold truncate">{{ note.actorTitle || inspectedActor()?.title }}</span>
                <div class="flex items-center gap-2 text-[11px] font-mono text-outline mt-0.5">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-rounded text-xs">schedule</span>
                    <span>{{ note.time }}</span>
                  </span>
                  <span>·</span>
                  <span>{{ getActiveDateFormatted() }}</span>
                </div>
              </div>
            </div>

            <!-- Hybrid Model Badges (Pin in Hero, Pin in Cloud, Visibility, Forked) -->
            <div class="flex items-center gap-1.5 flex-wrap px-1">
              @if (note.isPinnedToHero) {
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-bold">
                  <span class="material-symbols-rounded text-xs">push_pin</span>
                  <span>В карточке героя</span>
                </span>
              }
              @if (note.isPinnedToCloud) {
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-800 dark:text-sky-300 font-mono text-[10px] font-bold">
                  <span class="material-symbols-rounded text-xs">cloud</span>
                  <span>Запинено в облаках</span>
                </span>
              }
              @if (note.visibility === 'PRIVATE') {
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container font-mono text-[10px] font-bold">
                  <span class="material-symbols-rounded text-xs">lock</span>
                  <span>Личная заметка</span>
                </span>
              } @else {
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-semibold">
                  <span class="material-symbols-rounded text-xs">public</span>
                  <span>Общий Хаб</span>
                </span>
              }
              @if (note.forkedFromNoteId) {
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-mono text-[10px]">
                  <span class="material-symbols-rounded text-xs">download_done</span>
                  <span>Забрано из Общего облака ({{ note.forkedFromAuthorName }})</span>
                </span>
              }
            </div>

            <!-- Note Text Bubble -->
            <div class="p-4 sm:p-5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/30 shadow-inner relative flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-label-code-sm uppercase tracking-wider text-outline font-bold">
                  Содержание:
                </span>
                <span class="text-lg">{{ note.moodEmoji }}</span>
              </div>
              <p class="font-body-lg text-sm sm:text-base text-on-surface italic leading-relaxed whitespace-pre-wrap select-text">
                «{{ note.text }}»
              </p>
            </div>

            <!-- Supporters & Likes Strip -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/25 flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold font-label-ui text-on-surface">Поддержка мысли:</span>
                <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ❤️ {{ note.votesCount }}
                </span>
              </div>
              <button
                type="button"
                (click)="voteForNote(note.id)"
                class="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold font-label-ui inline-flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              >
                <span>❤️</span>
                <span>Поддержать (+1)</span>
              </button>
            </div>

            @if (inspectedActor()?.quote) {
              <div class="text-xs text-on-surface-variant flex items-center gap-2 italic px-1">
                <span class="material-symbols-rounded text-sm text-outline">format_quote</span>
                <span class="truncate">Цитата героя: «{{ inspectedActor()!.quote }}»</span>
              </div>
            }

            <!-- Footer: Hero Roleplay Switch, Adopt to Private, Pin, Delete & Close Button -->
            <div class="flex items-center justify-between gap-2 pt-3 border-t border-outline-variant/20 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  (click)="selectPitchActorFromInspect()"
                  class="px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container hover:brightness-105 font-label-ui text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Выбрать этого героя в нижней плашке"
                >
                  <span class="material-symbols-rounded text-sm">theater_comedy</span>
                  <span>Действовать как герой</span>
                </button>

                <!-- Adopt to Private / Забрать себе в личные -->
                <button
                  type="button"
                  (click)="adoptInspectedNoteToPrivate()"
                  class="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 font-label-ui text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors border border-amber-500/30"
                  title="Забрать эту мысль из Общего облака себе в личный блокнот героя"
                >
                  <span class="material-symbols-rounded text-sm">file_download</span>
                  <span>Забрать себе</span>
                </button>

                <!-- Pin in Hero toggle -->
                <button
                  type="button"
                  (click)="togglePinInspectedToHero()"
                  class="px-2.5 py-1.5 rounded-xl font-label-ui text-xs font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer"
                  [class]="
                    note.isPinnedToHero
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                  "
                  title="Закрепить или открепить в карточке этого персонажа"
                >
                  <span class="material-symbols-rounded text-sm">push_pin</span>
                  <span>{{ note.isPinnedToHero ? 'В герое 📌' : '📌 В героя' }}</span>
                </button>

                <!-- Pin in Cloud toggle -->
                <button
                  type="button"
                  (click)="togglePinInspectedToCloud()"
                  class="px-2.5 py-1.5 rounded-xl font-label-ui text-xs font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer"
                  [class]="
                    note.isPinnedToCloud
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                  "
                  title="Закрепить или открепить в летающих облачках"
                >
                  <span class="material-symbols-rounded text-sm">cloud</span>
                  <span>{{ note.isPinnedToCloud ? 'В облаках ☁️' : '☁️ В облака' }}</span>
                </button>

                <button
                  type="button"
                  (click)="deleteInspectedNote()"
                  class="p-1.5 rounded-xl text-outline hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Удалить мысль"
                  aria-label="Удалить"
                >
                  <span class="material-symbols-rounded text-lg">delete</span>
                </button>
              </div>

              <button
                type="button"
                (click)="closeInspectModal()"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }

      <!-- 9. MODAL: DAY VIBE SELECTOR (MEETS STRICT MODAL RULES) -->
      @if (isVibePickerOpen()) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="closeVibePickerModal()"
          aria-labelledby="vibe-picker-modal-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface animate-scale-in"
          >
            <!-- Header with Explicit Close Button -->
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-primary text-2xl">palette</span>
                <h2 id="vibe-picker-modal-title" class="font-headline-sm text-base font-bold text-on-surface">
                  Настроить Вайб & Фон Небосвода
                </h2>
              </div>
              <button
                type="button"
                (click)="closeVibePickerModal()"
                class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                aria-label="Закрыть"
              >
                <span class="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            <!-- Vibe Presets List -->
            <div class="flex flex-col gap-2.5">
              @for (vibe of vibes; track vibe.id) {
                <button
                  type="button"
                  (click)="selectVibe(vibe.id)"
                  class="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                  [class]="
                    selectedVibeId() === vibe.id
                      ? 'border-primary bg-primary-container/20 ring-2 ring-primary shadow-xs'
                      : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high'
                  "
                >
                  <div class="flex items-center gap-3">
                    <span class="text-3xl group-hover:scale-110 transition-transform">{{ vibe.icon }}</span>
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-label-ui text-sm font-bold text-on-surface">{{ vibe.name }}</span>
                        <span class="text-[10px] font-label-code-sm font-extrabold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                          {{ vibe.badge }}
                        </span>
                      </div>
                      <span class="font-body-sm text-xs text-on-surface-variant leading-snug mt-0.5">
                        {{ vibe.description }}
                      </span>
                    </div>
                  </div>

                  @if (selectedVibeId() === vibe.id) {
                    <span class="material-symbols-rounded text-primary text-xl flex-shrink-0">check_circle</span>
                  }
                </button>
              }
            </div>

            <!-- Footer with Cancel Button -->
            <div class="flex items-center justify-between pt-3 border-t border-outline-variant/20">
              <span class="text-xs font-label-code-sm text-outline">
                Вайб сохраняется в браузере
              </span>
              <button
                type="button"
                (click)="closeVibePickerModal()"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PartyCloudComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly realtime = inject(PartyRealtimeService);
  protected readonly sound = inject(PartySoundService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  // Day Vibes system
  readonly vibes = CLOUD_DAY_VIBES;
  readonly selectedVibeId = signal<CloudDayVibeId>(this.loadInitialVibe());
  readonly isVibePickerOpen = signal<boolean>(false);

  readonly currentVibe = computed<CloudDayVibe>(() => {
    const id = this.selectedVibeId();
    return CLOUD_DAY_VIBES.find((v) => v.id === id) || CLOUD_DAY_VIBES[0];
  });

  readonly viewMode = signal<CloudViewMode>('CLOUD_TIMELINE');
  readonly activeLayer = signal<CloudFilterLayer>('ALL');

  // Selected Date Key (Defaults to Today 2026-11-06)
  readonly selectedDateKey = signal<string>('2026-11-06');

  // Notes Store (dateKey -> CloudDayNote[])
  readonly notesStore = signal<Record<string, CloudDayNote[]>>(this.loadInitialNotes());

  // Input states for new thought/proposal/action
  readonly selectedActionType = signal<CloudItemType>('thought');
  readonly newNoteTime = signal<string>(this.getCurrentTimeString());
  readonly newIdeaTitle = signal<string>('');

  // Active Roleplay Character & Actors signals
  readonly allActors = signal<ArenaActorCard[]>([]);
  readonly quickActors = computed(() => this.allActors().slice(0, 7));
  readonly activePitchActor = signal<ArenaActorCard | null>(null);
  readonly isCharacterPickerOpen = signal<boolean>(false);

  // Inspector & Space Creation
  readonly inspectedNote = signal<CloudDayNote | null>(null);
  readonly inspectedActor = signal<ArenaActorCard | null>(null);
  readonly inspectedCard = signal<ArenaDesireCard | null>(null);
  readonly activeSpaceTitle = signal<string>('Friday Chill Core');
  readonly hostActorName = signal<string>('Бунтарь Кот');
  readonly isCreateSpaceModalOpen = signal<boolean>(false);
  readonly newSpaceTitle = signal<string>('');
  readonly newSpaceDescription = signal<string>('');
  readonly newSpaceHostId = signal<string>('');

  readonly cardSupporters = signal<Record<string, string[]>>({
    'card-board-games': ['actor-misha', 'actor-kot-rebel', 'actor-solomon'],
    'card-burger-bbq': ['actor-ratatouille', 'actor-kapitan-zaryad'],
  });

  readonly timelineSlots: CalendarCoordinateSlot[] = [
    {
      id: 'slot-today-night',
      dateKey: '2026-11-06',
      dayLabel: 'Сегодня (Пт)',
      dateNumber: '6 Ноя',
      timeSlot: '20:00 — 23:30',
      title: '🍕 Пятничный Чилл & Пицца',
      isToday: true,
      assignedCards: ['card-board-games'],
      assignedActors: ['actor-misha', 'actor-kot-rebel'],
    },
  ];

  // Candlestick Chart Hour Milestones (08:00 to 24:00 range)
  readonly hourMilestones = [
    { label: '08:00', icon: '🌅', minutes: 480 },
    { label: '10:00', icon: '☕', minutes: 600 },
    { label: '12:00', icon: '☀️', minutes: 720 },
    { label: '14:00', icon: '🍕', minutes: 840 },
    { label: '16:00', icon: '💡', minutes: 960 },
    { label: '18:00', icon: '🌆', minutes: 1080 },
    { label: '20:00', icon: '🎮', minutes: 1200 },
    { label: '22:00', icon: '🌙', minutes: 1320 },
    { label: '24:00', icon: '💤', minutes: 1440 },
  ];

  readonly dayPeriods = [
    { id: 'morning', title: 'Утро (06:00 — 12:00)', icon: '🌅', hours: '06:00 — 12:00', min: 360, max: 720, defaultTime: '09:00' },
    { id: 'afternoon', title: 'День (12:00 — 17:00)', icon: '☀️', hours: '12:00 — 17:00', min: 720, max: 1020, defaultTime: '13:30' },
    { id: 'evening', title: 'Вечер (17:00 — 22:00)', icon: '🌆', hours: '17:00 — 22:00', min: 1020, max: 1320, defaultTime: '19:00' },
    { id: 'night', title: 'Ночь (22:00 — 04:00)', icon: '🌙', hours: '22:00 — 04:00', min: 1320, max: 1440, defaultTime: '22:30' },
  ];

  readonly thoughtPresets: IdeaPitchPreset[] = [
    { title: 'Кофе-брейк', icon: '☕', category: 'Чат', colorTheme: 'amber' },
    { title: 'Заказать пиццу', icon: '🍕', category: 'Еда', colorTheme: 'amber' },
    { title: 'Сыграть в CS2 / Настолки', icon: '🎮', category: 'Игры', colorTheme: 'emerald' },
    { title: 'Гениальная мысль', icon: '💡', category: 'Идея', colorTheme: 'cyan' },
    { title: 'Пора отдохнуть', icon: '🏖️', category: 'Чилл', colorTheme: 'rose' },
    { title: 'Врубить музыку', icon: '🎵', category: 'Музыка', colorTheme: 'violet' },
  ];

  readonly dateTabs = computed<CloudDateTab[]>(() => {
    const store = this.notesStore();
    return [
      {
        dateKey: '2026-11-05',
        label: 'Вчера',
        subLabel: '5 Ноября',
        isToday: false,
        notesCount: (store['2026-11-05'] ?? []).length,
      },
      {
        dateKey: '2026-11-06',
        label: 'Сегодня (Пт)',
        subLabel: '6 Ноября',
        isToday: true,
        notesCount: (store['2026-11-06'] ?? []).length,
      },
      {
        dateKey: '2026-11-07',
        label: 'Завтра (Сб)',
        subLabel: '7 Ноября',
        isToday: false,
        notesCount: (store['2026-11-07'] ?? []).length,
      },
    ];
  });

  readonly activeDateNotes = computed<CloudDayNote[]>(() => {
    const store = this.notesStore();
    const key = this.selectedDateKey();
    const notes = store[key] ?? [];
    return [...notes].sort((a, b) => a.timeMinutes - b.timeMinutes);
  });

  readonly visibleNotes = computed<CloudDayNote[]>(() => {
    const notes = this.activeDateNotes();
    const layer = this.activeLayer();
    if (layer === 'ALL') return notes;
    if (layer === 'THOUGHTS') return notes.filter((n) => n.type === 'thought');
    if (layer === 'PROPOSALS') return notes.filter((n) => n.type === 'proposal');
    if (layer === 'ACTIONS') return notes.filter((n) => n.type === 'action');
    return notes;
  });

  readonly CLUSTER_GAP_MINUTES = 30;
  readonly clusterActiveIndices = signal<Record<string, number>>({});

  readonly groupedTimelineNotes = computed<TimelineCluster[]>(() => {
    const notes = this.visibleNotes();
    if (notes.length === 0) return [];

    const clusters: TimelineCluster[] = [];
    let currentGroup: CloudDayNote[] = [];

    for (const note of notes) {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
      } else {
        const clusterStart = currentGroup[0].timeMinutes;
        if (note.timeMinutes - clusterStart <= this.CLUSTER_GAP_MINUTES) {
          currentGroup.push(note);
        } else {
          clusters.push(this.buildTimelineCluster(currentGroup));
          currentGroup = [note];
        }
      }
    }

    if (currentGroup.length > 0) {
      clusters.push(this.buildTimelineCluster(currentGroup));
    }

    return clusters;
  });

  readonly inputPlaceholder = computed(() => {
    const actor = this.activePitchActor();
    const name = actor ? actor.name : 'Участник';
    const type = this.selectedActionType();
    if (type === 'thought') {
      return `«${name}»: поделиться мыслью... (нажмите Enter)`;
    }
    if (type === 'proposal') {
      return `«${name}»: предложить идею... (нажмите Enter)`;
    }
    return `«${name}»: совершить экшен... (нажмите Enter)`;
  });

  readonly synergyPercent = computed(() => {
    const notes = this.activeDateNotes();
    let totalVotes = 0;
    for (const n of notes) {
      totalVotes += n.votesCount;
    }
    return Math.min(99, 70 + Math.floor(totalVotes * 1.8));
  });

  readonly gravityPull = computed(() => {
    return (8.0 + (this.synergyPercent() - 70) * 0.12).toFixed(1);
  });

  constructor() {
    this.arena.leadActor$.subscribe((actor) => {
      if (actor && !this.activePitchActor()) {
        this.activePitchActor.set(actor);
        this.hostActorName.set(actor.name);
      }
    });

    this.arena.actors$.subscribe((actors) => {
      this.allActors.set(actors);
      if (!this.activePitchActor() && actors.length > 0) {
        this.activePitchActor.set(actors[0]);
      }
    });

    this.arena.notesMap$.subscribe((map) => {
      this.notesStore.set(map);
    });
  }

  isCloudView(): boolean {
    const m = this.viewMode();
    return m === 'CLOUD_TIMELINE' || m === 'ORBIT';
  }

  isFeedView(): boolean {
    const m = this.viewMode();
    return m === 'DAY_FEED' || m === 'CALENDAR_TIMELINE';
  }

  isTodaySelected(): boolean {
    return this.selectedDateKey() === '2026-11-06';
  }

  selectDate(dateKey: string): void {
    this.selectedDateKey.set(dateKey);
    this.sound.playClick();
  }

  getActiveDateFormatted(): string {
    const key = this.selectedDateKey();
    if (key === '2026-11-06') return 'Сегодня (Пятница, 6 Ноября)';
    if (key === '2026-11-05') return 'Вчера (Четверг, 5 Ноября)';
    if (key === '2026-11-07') return 'Завтра (Суббота, 7 Ноября)';
    return key;
  }

  countNotesByType(type: CloudItemType): number {
    return this.activeDateNotes().filter((n) => n.type === type).length;
  }

  getTopLaneNotes(): CloudDayNote[] {
    return this.visibleNotes().filter((_, idx) => idx % 2 === 0);
  }

  getBottomLaneNotes(): CloudDayNote[] {
    return this.visibleNotes().filter((_, idx) => idx % 2 === 1);
  }

  // Altitude stem height for trading candlestick chart (staggered across 3 tiers)
  getNoteStemHeight(index: number): number {
    return (index % 3) * 115 + 40;
  }

  getAccentStemClasses(accent: ArenaAccentColor): string {
    switch (accent) {
      case 'amber':
        return 'bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 shadow-amber-500/20';
      case 'emerald':
        return 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 shadow-emerald-500/20';
      case 'indigo':
        return 'bg-gradient-to-t from-indigo-500 via-indigo-400 to-indigo-300 shadow-indigo-500/20';
      case 'rose':
        return 'bg-gradient-to-t from-rose-500 via-rose-400 to-rose-300 shadow-rose-500/20';
      case 'cyan':
        return 'bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-cyan-500/20';
      case 'violet':
        return 'bg-gradient-to-t from-violet-500 via-violet-400 to-violet-300 shadow-violet-500/20';
      default:
        return 'bg-amber-400';
    }
  }

  getAccentGlowClasses(accent: ArenaAccentColor): string {
    switch (accent) {
      case 'amber':
        return 'bg-amber-500 ring-amber-400/50';
      case 'emerald':
        return 'bg-emerald-500 ring-emerald-400/50';
      case 'indigo':
        return 'bg-indigo-500 ring-indigo-400/50';
      case 'rose':
        return 'bg-rose-500 ring-rose-400/50';
      case 'cyan':
        return 'bg-cyan-500 ring-cyan-400/50';
      case 'violet':
        return 'bg-violet-500 ring-violet-400/50';
      default:
        return 'bg-amber-500 ring-amber-400/50';
    }
  }

  // Converts minutes (08:00=480 to 24:00=1440) to percentage (6% to 94%)
  getTimelinePercent(timeMinutes: number): number {
    const startMins = 480; // 08:00
    const endMins = 1440; // 24:00
    const clamped = Math.max(startMins, Math.min(endMins, timeMinutes));
    const pct = ((clamped - startMins) / (endMins - startMins)) * 88 + 6;
    return Math.round(pct * 10) / 10;
  }

  getCurrentTimePercent(): number {
    const now = new Date();
    const hours = now.getHours() || 13;
    const mins = now.getMinutes() || 45;
    return this.getTimelinePercent(hours * 60 + mins);
  }

  currentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours() || 13).padStart(2, '0');
    const m = String(now.getMinutes() || 45).padStart(2, '0');
    return `${h}:${m}`;
  }

  onTimelineRoadClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const rawRatio = Math.max(0, Math.min(1, clickX / rect.width));

    // Normalize from the 6% to 94% span
    const normalized = Math.max(0, Math.min(1, (rawRatio - 0.06) / 0.88));
    const mins = Math.round(480 + normalized * (1440 - 480));
    const h = Math.floor(mins / 60);
    const m = Math.round((mins % 60) / 15) * 15;
    const formatted = `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    this.newNoteTime.set(formatted);
    this.sound.playTick();
  }

  setTimeForSlot(time: string): void {
    this.newNoteTime.set(time);
    this.sound.playTick();
  }

  getNotesForPeriod(min: number, max: number): CloudDayNote[] {
    return this.visibleNotes().filter((n) => n.timeMinutes >= min && n.timeMinutes < max);
  }

  getInputPlaceholder(): string {
    return this.inputPlaceholder();
  }

  getTypeLabel(type: CloudItemType): string {
    if (type === 'thought') return 'Мысль';
    if (type === 'proposal') return 'Идея';
    return 'Экшен';
  }

  getTypeEmoji(type: CloudItemType): string {
    if (type === 'thought') return '💭';
    if (type === 'proposal') return '💡';
    return '⚡';
  }

  getNoteBorderClass(accent: ArenaAccentColor): string {
    switch (accent) {
      case 'amber':
        return 'border-amber-400 bg-amber-50/20';
      case 'emerald':
        return 'border-emerald-500 bg-emerald-50/20';
      case 'indigo':
        return 'border-indigo-400 bg-indigo-50/20';
      case 'rose':
        return 'border-rose-400 bg-rose-50/20';
      case 'cyan':
        return 'border-cyan-400 bg-cyan-50/20';
      case 'violet':
        return 'border-violet-400 bg-violet-50/20';
      default:
        return 'border-amber-300';
    }
  }

  submitNoteOrIdea(): void {
    const text = this.newIdeaTitle().trim();
    if (!text) return;

    const actor = this.activePitchActor();
    const dateKey = this.selectedDateKey();
    const time = this.newNoteTime() || this.getCurrentTimeString();
    const [h, m] = time.split(':').map(Number);
    const timeMinutes = (h || 12) * 60 + (m || 0);
    const type = this.selectedActionType();

    const newNote: CloudDayNote = {
      id: `note-${Date.now()}`,
      dateKey,
      time,
      timeMinutes,
      type,
      actorId: actor?.id || 'actor-anon',
      actorName: actor?.name || 'Участник',
      actorAvatar: actor?.avatarIcon || 'kot-rebel',
      actorAccent: actor?.accentColor || 'amber',
      actorTitle: actor?.title || '',
      text,
      supporters: actor ? [actor.id] : [],
      votesCount: 1,
      moodEmoji: type === 'thought' ? '💭' : type === 'proposal' ? '💡' : '⚡',
      createdAt: new Date().toISOString(),
    };

    this.notesStore.update((store) => {
      const current = store[dateKey] ? [...store[dateKey]] : [];
      const updated = { ...store, [dateKey]: [...current, newNote] };
      this.persistNotes(updated);
      return updated;
    });

    this.newIdeaTitle.set('');
    this.sound.playWin();

    this.realtime.broadcastEvent({
      type: 'CARD_PLAYED',
      actorName: newNote.actorName,
      actorIcon: newNote.actorAvatar,
      roomTitle: this.activeSpaceTitle(),
      message: `${type === 'thought' ? 'поделился мыслью' : type === 'proposal' ? 'выдвинул предложение' : 'совершил экшен'} «${text}» на ${time}!`,
    });
  }

  submitPitchIdea(): void {
    this.submitNoteOrIdea();
  }

  pitchPreset(preset: IdeaPitchPreset): void {
    this.newIdeaTitle.set(preset.title);
    this.submitNoteOrIdea();
  }

  voteForNote(noteId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    const currentActor = this.activePitchActor();
    const actorId = currentActor ? currentActor.id : 'actor-anon';
    const dateKey = this.selectedDateKey();

    this.notesStore.update((store) => {
      const list = store[dateKey] ?? [];
      const updatedList = list.map((n) => {
        if (n.id === noteId) {
          const sup = n.supporters.includes(actorId) ? n.supporters : [...n.supporters, actorId];
          return { ...n, supporters: sup, votesCount: n.votesCount + 1 };
        }
        return n;
      });
      const updated = { ...store, [dateKey]: updatedList };
      this.persistNotes(updated);
      return updated;
    });

    if (this.inspectedNote()?.id === noteId) {
      this.inspectedNote.update((n) => (n ? { ...n, votesCount: n.votesCount + 1 } : null));
    }

    this.sound.playTick(1.2);

    this.realtime.broadcastEvent({
      type: 'VOTE_CAST',
      actorName: currentActor?.name || 'Участник',
      actorIcon: currentActor?.avatarIcon || 'person',
      roomTitle: this.activeSpaceTitle(),
      message: `поддержал мысль в облаке (+1)!`,
    });
  }

  voteForCard(cardId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const actor = this.activePitchActor();
    const actorId = actor ? actor.id : 'actor-anon';

    this.arena.voteForDesireCard(cardId, actorId);
    this.cardSupporters.update((map) => {
      const cur = map[cardId] || [];
      return cur.includes(actorId) ? map : { ...map, [cardId]: [...cur, actorId] };
    });

    this.sound.playTick(1.2);
    this.realtime.broadcastEvent({
      type: 'VOTE_CAST',
      actorName: actor?.name || 'Участник',
      actorIcon: actor?.avatarIcon || 'person',
      roomTitle: this.activeSpaceTitle(),
      message: `поддержал карточку в пространстве!`,
    });
  }

  deleteNote(noteId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const dateKey = this.selectedDateKey();
    this.notesStore.update((store) => {
      const list = (store[dateKey] ?? []).filter((n) => n.id !== noteId);
      const updated = { ...store, [dateKey]: list };
      this.persistNotes(updated);
      return updated;
    });
    this.sound.playClick();
  }

  inspectNote(note: CloudDayNote): void {
    this.inspectedNote.set(note);
    const found = this.allActors().find((a) => a.id === note.actorId);
    this.inspectedActor.set(found || null);
    this.sound.playClick();
  }

  closeInspectModal(): void {
    this.inspectedNote.set(null);
    this.inspectedActor.set(null);
  }

  selectPitchActorFromInspect(): void {
    const note = this.inspectedNote();
    if (!note) return;
    const actor = this.allActors().find((a) => a.id === note.actorId);
    if (actor) {
      this.selectPitchActor(actor);
    }
    this.closeInspectModal();
  }

  deleteInspectedNote(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.deleteNote(note.id);
    this.deleteNote(note.id);
    this.closeInspectModal();
  }

  adoptInspectedNoteToPrivate(): void {
    const note = this.inspectedNote();
    if (!note) return;
    const adopted = this.arena.adoptNoteToPrivate(note.id);
    this.sound.playWin();
    if (adopted) {
      this.inspectedNote.set(adopted);
    }
  }

  togglePinInspectedToHero(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.togglePinToHero(note.id);
    this.inspectedNote.update((n) => (n ? { ...n, isPinnedToHero: !n.isPinnedToHero } : null));
    this.sound.playClick();
  }

  togglePinInspectedToCloud(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.togglePinToCloud(note.id);
    this.inspectedNote.update((n) => (n ? { ...n, isPinnedToCloud: !n.isPinnedToCloud } : null));
    this.sound.playClick();
  }

  buildTimelineCluster(notes: CloudDayNote[]): TimelineCluster {
    const isCluster = notes.length > 1;
    const first = notes[0];
    const last = notes[notes.length - 1];

    const avgMinutes = Math.round(
      notes.reduce((acc, n) => acc + n.timeMinutes, 0) / notes.length
    );

    const timeLabel = (!isCluster || first.time === last.time)
      ? first.time
      : `${first.time}–${last.time}`;

    const timeSpanLabel = isCluster
      ? (first.time === last.time
          ? `${first.time} (${notes.length} мыслей в стопке)`
          : `${first.time}–${last.time} (${notes.length} мыслей в стопке)`)
      : undefined;

    const id = isCluster
      ? `cluster-${first.id}-${notes.length}-${first.timeMinutes}`
      : first.id;

    return {
      id,
      timeMinutes: avgMinutes,
      time: timeLabel,
      timeSpanLabel,
      notes,
      isCluster,
    };
  }

  getClusterActiveIndex(clusterId: string): number {
    return this.clusterActiveIndices()[clusterId] ?? 0;
  }

  getClusterActiveNote(cluster: TimelineCluster): CloudDayNote {
    const idx = this.getClusterActiveIndex(cluster.id);
    const clamped = Math.max(0, Math.min(cluster.notes.length - 1, idx));
    return cluster.notes[clamped] ?? cluster.notes[0];
  }

  setClusterIndex(clusterId: string, index: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: index }));
    this.sound.playTick();
  }

  prevClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const prev = (current - 1 + total) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: prev }));
    this.sound.playTick();
  }

  nextClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const next = (current + 1) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: next }));
    this.sound.playTick();
  }

  getInspectedNoteCluster(): TimelineCluster | null {
    const note = this.inspectedNote();
    if (!note) return null;
    return this.groupedTimelineNotes().find((c) => c.isCluster && c.notes.some((n) => n.id === note.id)) ?? null;
  }

  getInspectedNoteClusterIndex(cluster: TimelineCluster): number {
    const note = this.inspectedNote();
    if (!note) return 0;
    const idx = cluster.notes.findIndex((n) => n.id === note.id);
    return idx >= 0 ? idx : 0;
  }

  prevInspectedClusterNote(cluster: TimelineCluster): void {
    const current = this.getInspectedNoteClusterIndex(cluster);
    const prev = (current - 1 + cluster.notes.length) % cluster.notes.length;
    this.inspectNote(cluster.notes[prev]);
  }

  nextInspectedClusterNote(cluster: TimelineCluster): void {
    const current = this.getInspectedNoteClusterIndex(cluster);
    const next = (current + 1) % cluster.notes.length;
    this.inspectNote(cluster.notes[next]);
  }

  toggleCharacterPicker(): void {
    this.isCharacterPickerOpen.update((open) => !open);
    this.sound.playClick();
  }

  closeCharacterPickerModal(): void {
    this.isCharacterPickerOpen.set(false);
  }

  selectPitchActor(actor: ArenaActorCard): void {
    this.activePitchActor.set(actor);
    this.hostActorName.set(actor.name);
    this.isCharacterPickerOpen.set(false);
    this.sound.playTick(1.1);
  }

  openCreateSpaceModal(): void {
    const current = this.activePitchActor();
    this.newSpaceTitle.set(current ? `Чилл-Зона «${current.name}»` : 'Friday Chill Core');
    this.newSpaceDescription.set('Открытое облачное пространство для выбора формата вечеринки и совместного досуга.');
    this.newSpaceHostId.set(current?.id || 'actor-kot-rebel');
    this.isCreateSpaceModalOpen.set(true);
  }

  closeCreateSpaceModal(): void {
    this.newSpaceTitle.set('');
    this.newSpaceDescription.set('');
    this.newSpaceHostId.set('');
    this.isCreateSpaceModalOpen.set(false);
  }

  onHostChange(hostId: string): void {
    this.newSpaceHostId.set(hostId);
    let allActors: ArenaActorCard[] = [];
    this.arena.actors$.subscribe((a) => (allActors = a)).unsubscribe();
    const actor = allActors.find((a) => a.id === hostId);
    if (actor) {
      this.newSpaceTitle.set(`Чилл-Зона «${actor.name}»`);
    }
  }

  submitCreateSpace(): void {
    const title = this.newSpaceTitle().trim() || 'Friday Chill Core';
    const hostId = this.newSpaceHostId();

    let allActors: ArenaActorCard[] = [];
    this.arena.actors$.subscribe((a) => (allActors = a)).unsubscribe();
    const host = allActors.find((a) => a.id === hostId) || this.activePitchActor();

    if (host) {
      this.selectPitchActor(host);
      this.hostActorName.set(host.name);
    }

    this.activeSpaceTitle.set(title);
    this.realtime.createRoom({
      title,
      description: this.newSpaceDescription().trim(),
      icon: 'local_pizza',
      themeColor: 'amber',
      scheduledLabel: 'Пятница, 20:00',
      tags: ['чилл', 'облако', 'синергия'],
    });

    this.closeCreateSpaceModal();
    this.sound.playWin();
  }

  scheduleActiveToSlot(slot: CalendarCoordinateSlot): void {
    const actor = this.activePitchActor();
    if (actor && !slot.assignedActors.includes(actor.id)) {
      slot.assignedActors.push(actor.id);
    }

    this.sound.playTick(1.3);
    this.realtime.broadcastEvent({
      type: 'CARD_PLAYED',
      actorName: actor?.name || 'Лидер',
      actorIcon: actor?.avatarIcon || 'person',
      roomTitle: slot.title,
      message: `закрепил активность в слоте «${slot.dayLabel}, ${slot.timeSlot}»!`,
    });
  }

  selectVibe(vibeId: CloudDayVibeId): void {
    this.selectedVibeId.set(vibeId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lemon-party:day-vibe', vibeId);
      } catch {}
    }
    this.isVibePickerOpen.set(false);
    this.sound.playWin();
  }

  toggleVibePicker(): void {
    this.isVibePickerOpen.update((open) => !open);
    this.sound.playClick();
  }

  closeVibePickerModal(): void {
    this.isVibePickerOpen.set(false);
  }

  private loadInitialVibe(): CloudDayVibeId {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('lemon-party:day-vibe') as CloudDayVibeId;
        if (stored && CLOUD_DAY_VIBES.some((v) => v.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return 'CHRONO_DAYFLOW';
  }

  private getCurrentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours() || 13).padStart(2, '0');
    const m = String(now.getMinutes() || 45).padStart(2, '0');
    return `${h}:${m}`;
  }

  private loadInitialNotes(): Record<string, CloudDayNote[]> {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_NOTES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      } catch {
        // Local storage unreadable
      }
    }
    return SEED_NOTES;
  }

  private persistNotes(store: Record<string, CloudDayNote[]>): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(store));
      } catch {
        // Storage quota or restriction
      }
    }
  }
}
