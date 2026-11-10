import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';

export interface PartyRoom {
  id: string;
  title: string;
  description: string;
  icon: string;
  themeColor: 'purple' | 'amber' | 'emerald' | 'cyan' | 'rose';
  scheduledDate: string;
  scheduledLabel: string;
  participantsCount: number;
  activeThreadTitle?: string;
  status: 'LIVE' | 'VOTING' | 'SCHEDULED' | 'WRAPPED_UP';
  tags: string[];
}

export interface PartyRealtimeEvent {
  id: string;
  timestamp: string;
  type: 'USER_JOINED' | 'VOICE_SUBMITTED' | 'VOTE_CAST' | 'CARD_PLAYED' | 'PINNED_COMBINE' | 'ROOM_SWITCHED';
  actorName: string;
  actorIcon: string;
  roomTitle: string;
  message: string;
}

export type RealtimeConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE';

@Injectable({ providedIn: 'root' })
export class PartyRealtimeService {
  private readonly defaultRooms: PartyRoom[] = [
    {
      id: 'room-friday-chill',
      title: '🍕 Пятничный Чилл & Пицца',
      description: 'Главная комната вечера: выбираем формат ужина и совмещаем отдых с разговорами',
      icon: 'local_pizza',
      themeColor: 'amber',
      scheduledDate: '2026-11-05T20:00:00Z',
      scheduledLabel: 'Сегодня, 20:00',
      participantsCount: 6,
      activeThreadTitle: 'Пицца «Четыре Сыра» & Настолки',
      status: 'LIVE',
      tags: ['еда', 'вечер', 'пицца', 'настолки'],
    },
    {
      id: 'room-cozy-evening',
      title: '🍿 Уютный Вечер & Киномарафон',
      description: 'Выбор культового фильма и расслабляющий чилл под чай с печеньем',
      icon: 'movie',
      themeColor: 'purple',
      scheduledDate: '2026-11-06T19:30:00Z',
      scheduledLabel: 'Завтра, 19:30',
      participantsCount: 4,
      activeThreadTitle: 'Интерстеллар в 4K',
      status: 'SCHEDULED',
      tags: ['кино', 'уют', 'плед'],
    },
    {
      id: 'room-team-brainstorm',
      title: '💡 Брейншторм & Тимбилдинг',
      description: 'Спор форматов квартального планирования: спринт-сессия или хакатон на выезде',
      icon: 'psychology',
      themeColor: 'cyan',
      scheduledDate: '2026-11-07T14:00:00Z',
      scheduledLabel: 'Суббота, 14:00',
      participantsCount: 8,
      activeThreadTitle: 'Хакатон AI & Автоматизация',
      status: 'VOTING',
      tags: ['тимбилдинг', 'стратегия', 'ai'],
    },
    {
      id: 'room-cyber-arena',
      title: '🎮 Ночной Кибер-Турнир',
      description: 'Битва альтернатив: файтинг в Mortal Kombat vs кооперативный рейд',
      icon: 'sports_esports',
      themeColor: 'rose',
      scheduledDate: '2026-11-07T22:00:00Z',
      scheduledLabel: 'Суббота, 22:00',
      participantsCount: 5,
      activeThreadTitle: 'Турнир Mortal Kombat 1',
      status: 'SCHEDULED',
      tags: ['игры', 'турнир', 'драйв'],
    },
    {
      id: 'room-weekend-dacha',
      title: '🏕️ Выходные на Даче & Шашлык',
      description: 'Свежий воздух, мангал, баня и гитара у костра',
      icon: 'outdoor_garden',
      themeColor: 'emerald',
      scheduledDate: '2026-11-08T12:00:00Z',
      scheduledLabel: 'Воскресенье, 12:00',
      participantsCount: 7,
      activeThreadTitle: 'Гриль-пати и прогулка к озеру',
      status: 'SCHEDULED',
      tags: ['дача', 'природа', 'шашлык'],
    },
  ];

  private readonly roomsSubject = new BehaviorSubject<PartyRoom[]>(this.defaultRooms);
  readonly rooms$: Observable<PartyRoom[]> = this.roomsSubject.asObservable();

  private readonly activeRoomIdSubject = new BehaviorSubject<string>('room-friday-chill');
  readonly activeRoomId$: Observable<string> = this.activeRoomIdSubject.asObservable();

  readonly connectionStatus = signal<RealtimeConnectionStatus>('CONNECTED');
  readonly latencyMs = signal<number>(18);
  readonly liveParticipantsOnline = signal<number>(14);

  private readonly eventsSubject = new BehaviorSubject<PartyRealtimeEvent[]>([
    {
      id: 'ev-init-1',
      timestamp: new Date(Date.now() - 45000).toISOString(),
      type: 'VOTE_CAST',
      actorName: 'Кот-Бунтарь',
      actorIcon: 'cruelty_free',
      roomTitle: '🍕 Пятничный Чилл & Пицца',
      message: 'отдал голос за «Пицца и крафтовые лимонады»!',
    },
    {
      id: 'ev-init-2',
      timestamp: new Date(Date.now() - 15000).toISOString(),
      type: 'VOICE_SUBMITTED',
      actorName: 'Кибер-Ниндзя',
      actorIcon: 'smart_toy',
      roomTitle: '🍕 Пятничный Чилл & Пицца',
      message: 'оставил войс: «Пицца победит любой хаос!»',
    },
  ]);
  readonly events$: Observable<PartyRealtimeEvent[]> = this.eventsSubject.asObservable();

  constructor() {
    this.initSimulatedRealTimeFeed();
  }

  getActiveRoom(): PartyRoom {
    const rooms = this.roomsSubject.value;
    const activeId = this.activeRoomIdSubject.value;
    return rooms.find((r) => r.id === activeId) ?? rooms[0];
  }

  switchRoom(roomId: string): void {
    const rooms = this.roomsSubject.value;
    const target = rooms.find((r) => r.id === roomId);
    if (!target) return;

    this.activeRoomIdSubject.next(roomId);
    this.broadcastEvent({
      type: 'ROOM_SWITCHED',
      actorName: 'Вы',
      actorIcon: 'person',
      roomTitle: target.title,
      message: `переключились в комнату «${target.title}»`,
    });
  }

  createRoom(input: {
    title: string;
    description: string;
    icon: string;
    themeColor: 'purple' | 'amber' | 'emerald' | 'cyan' | 'rose';
    scheduledLabel: string;
    tags: string[];
  }): PartyRoom {
    const newRoom: PartyRoom = {
      id: `room-${Date.now()}`,
      title: input.title,
      description: input.description,
      icon: input.icon || 'celebration',
      themeColor: input.themeColor,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      scheduledLabel: input.scheduledLabel || 'Скоро',
      participantsCount: 1,
      status: 'LIVE',
      tags: input.tags,
    };

    const next = [newRoom, ...this.roomsSubject.value];
    this.roomsSubject.next(next);
    this.switchRoom(newRoom.id);
    return newRoom;
  }

  broadcastEvent(eventData: Omit<PartyRealtimeEvent, 'id' | 'timestamp'>): void {
    const fullEvent: PartyRealtimeEvent = {
      ...eventData,
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    const current = this.eventsSubject.value;
    this.eventsSubject.next([fullEvent, ...current.slice(0, 19)]);
  }

  private initSimulatedRealTimeFeed(): void {
    if (typeof window === 'undefined') return;

    // Simulate realistic background peer actions every 15-25 seconds to keep the real-time stream vibrant
    const simulatedPeers = [
      { name: 'Шеф-Повар Рататуй', icon: 'skillet', msg: 'предложил добавить горячий чесночный хлеб!' },
      { name: 'Профессор Разум', icon: 'psychology', msg: 'проанализировал винрейты карточек в комнате.' },
      { name: 'Майор Сокол', icon: 'military_tech', msg: 'подтвердил слот времени: 20:00 без задержек!' },
      { name: 'Диджей Неон', icon: 'graphic_eq', msg: 'включил фоновый плейлист для вечеринки.' },
      { name: 'Фея Уюта', icon: 'wb_sunny', msg: 'закрепила карточку «Какао с маршмеллоу» в слоте.' },
    ];

    let peerIndex = 0;
    interval(18000).subscribe(() => {
      if (this.connectionStatus() === 'CONNECTED') {
        const peer = simulatedPeers[peerIndex % simulatedPeers.length];
        peerIndex++;
        const activeRoom = this.getActiveRoom();

        this.broadcastEvent({
          type: 'VOICE_SUBMITTED',
          actorName: peer.name,
          actorIcon: peer.icon,
          roomTitle: activeRoom.title,
          message: peer.msg,
        });

        // Small realistic jitter on latency
        this.latencyMs.set(15 + Math.floor(Math.random() * 12));
      }
    });
  }
}
