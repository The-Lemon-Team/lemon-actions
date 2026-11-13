import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import {
  AgentDecisionRecord,
  AgentSessionRecord,
  DailyDigestSnapshot,
  OptimizationMetrics,
  StreamPulseItem,
} from '../models/agent.models';

@Injectable({ providedIn: 'root' })
export class CodingAgentFacade {
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://localhost:3000';

  // --- REACTIVE STATE (Single Source of Truth) ---
  private readonly activeSessionSubject = new BehaviorSubject<AgentSessionRecord | null>(null);
  private readonly dailyDigestsSubject = new BehaviorSubject<DailyDigestSnapshot[]>([]);
  private readonly todayDigestSubject = new BehaviorSubject<DailyDigestSnapshot | null>(null);
  private readonly decisionsSubject = new BehaviorSubject<AgentDecisionRecord[]>([]);
  private readonly historySubject = new BehaviorSubject<any[]>([]);
  private readonly streamMetricsSubject = new BehaviorSubject<OptimizationMetrics>({
    totalImpulsesReceived: 0,
    totalImpulsesEmitted: 0,
    totalImpulsesSuppressed: 0,
    overallReductionRate: 0,
    activeRegisteredStreams: 0,
    ephemeralPulsesRatio: 0,
    lastOptimizedAt: new Date().toISOString(),
  });
  private readonly livePulsesSubject = new BehaviorSubject<StreamPulseItem[]>([]);
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  private readonly toastSubject = new BehaviorSubject<string | null>(null);

  // --- PUBLIC OBSERVABLES FOR THE UI ---
  readonly activeSession$: Observable<AgentSessionRecord | null> = this.activeSessionSubject.asObservable();
  readonly dailyDigests$: Observable<DailyDigestSnapshot[]> = this.dailyDigestsSubject.asObservable();
  readonly todayDigest$: Observable<DailyDigestSnapshot | null> = this.todayDigestSubject.asObservable();
  readonly decisions$: Observable<AgentDecisionRecord[]> = this.decisionsSubject.asObservable();
  readonly history$: Observable<any[]> = this.historySubject.asObservable();
  readonly streamMetrics$: Observable<OptimizationMetrics> = this.streamMetricsSubject.asObservable();
  readonly livePulses$: Observable<StreamPulseItem[]> = this.livePulsesSubject.asObservable();
  readonly isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  readonly toast$: Observable<string | null> = this.toastSubject.asObservable();

  private eventSource: EventSource | null = null;
  private heartbeatInterval: any = null;

  constructor() {
    this.connectReactiveStream();
    this.startMetricsPolling();
    this.refresh();
  }

  // =========================================================================
  // IMPERATIVE WORKFLOW APIS (Imperative Facade Pattern)
  // =========================================================================

  /**
   * Императивный запуск сессии агента / открытие клиента.
   */
  async startSession(agentRole = 'Antigravity Full-Stack Agent', repoName = 'lemon-actions'): Promise<AgentSessionRecord> {
    this.isLoadingSubject.next(true);
    try {
      const res = await this.http
        .post<AgentSessionRecord>(`${this.apiBase}/code-tasks/agent/session/start`, {
          clientId: `antigravity-client-${Math.random().toString(36).substring(2, 6)}`,
          clientVersion: '2.1.0-alpha',
          agentRole,
          repoName,
          workspaceRoot: 'c:/Users/Ilege/projects/lemon-actions',
          environment: 'production-workstation',
        })
        .toPromise();

      if (res) {
        this.activeSessionSubject.next(res);
        this.showToast(`Сессия агента запущена: ${res.sessionId}`);
        this.setupHeartbeat(res.sessionId);
      }
      return res!;
    } catch (err: any) {
      this.showToast(`Ошибка старта сессии: ${err.message}`);
      throw err;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Отправка легковесного heart-beat пульса (минимизирует нагрузку на потоки через Core Combinator).
   */
  async sendHeartbeat(): Promise<void> {
    const session = this.activeSessionSubject.getValue();
    if (!session) return;

    try {
      await this.http
        .post(`${this.apiBase}/code-tasks/agent/session/heartbeat`, { sessionId: session.sessionId })
        .toPromise();
    } catch {
      // Игнорируем сетевые сбои легковесного пульса
    }
  }

  /**
   * Запись ключевого архитектурного решения в память агента.
   */
  async recordDecision(title: string, rationaleMarkdown: string, tags: string[] = []): Promise<void> {
    const session = this.activeSessionSubject.getValue();
    const sessionId = session?.sessionId || `adhoc-session-${Date.now()}`;

    this.isLoadingSubject.next(true);
    try {
      await this.http
        .post(`${this.apiBase}/code-tasks/agent/decision`, {
          sessionId,
          title,
          rationaleMarkdown,
          tags: [...tags, 'antigravity-decision'],
          repoName: session?.repoName || 'lemon-actions',
        })
        .toPromise();

      this.showToast(`Архитектурное решение записано: "${title}"`);
      await this.refresh();
    } catch (err: any) {
      this.showToast(`Ошибка сохранения решения: ${err.message}`);
      throw err;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Создание коммита в конце дня и отправка выжимки (End-of-Day Commit & Daily Digest).
   * Выполняет агрегацию дня, фиксирует срез в историю и транслирует в Core Combinator.
   */
  async commitEndOfDayDigest(commitMessage?: string): Promise<DailyDigestSnapshot> {
    this.isLoadingSubject.next(true);
    try {
      const res = await this.http
        .post<DailyDigestSnapshot>(`${this.apiBase}/code-tasks/agent/digest/eod-commit`, {
          commitMessage: commitMessage || 'End-of-day digest snapshot & milestone sync',
          date: new Date().toISOString().split('T')[0],
        })
        .toPromise();

      if (res) {
        this.todayDigestSubject.next(res);
        const currentList = this.dailyDigestsSubject.getValue();
        this.dailyDigestsSubject.next([res, ...currentList.filter((d: any) => d.digestId !== res.digestId)]);
        this.showToast(`✅ Коммит за день создан! Выжимка успешно отправлена.`);
      }
      return res!;
    } catch (err: any) {
      this.showToast(`Ошибка коммита за день: ${err.message}`);
      throw err;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Запуск миграции старых данных (очистка шумных трейсов, сжатие логов, сохранение майлстоунов).
   */
  async runDataMigration(): Promise<any> {
    this.isLoadingSubject.next(true);
    try {
      const res = await this.http.post(`${this.apiBase}/code-tasks/agent/migration/run`, {}).toPromise();
      this.showToast('✅ Миграция данных завершена! Избыточные логи сжаты.');
      await this.refresh();
      return res;
    } catch (err: any) {
      this.showToast(`Ошибка миграции: ${err.message}`);
      throw err;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Синхронизация и загрузка всех срезов, истории и выжимок.
   */
  async refresh(): Promise<void> {
    try {
      // 1. Загружаем историю агента
      const historyRes: any = await this.http.get(`${this.apiBase}/code-tasks/agent/history`).toPromise();
      if (historyRes) {
        if (historyRes.activeSessions && historyRes.activeSessions.length > 0) {
          this.activeSessionSubject.next(historyRes.activeSessions[0]);
        }

        const events: any[] = historyRes.events || [];
        this.historySubject.next(events);

        // Извлекаем решения
        const decisions = events
          .filter((e) => e.eventType === 'AGENT_DECISION')
          .map((e) => e.payload as AgentDecisionRecord);
        this.decisionsSubject.next(decisions);

        // Извлекаем выжимки за день
        const digests = events
          .filter((e) => e.eventType === 'DAILY_DIGEST_COMMITTED')
          .map((e) => e.payload as DailyDigestSnapshot);
        this.dailyDigestsSubject.next(digests);
      }

      // 2. Загружаем выжимку за сегодня
      const todayRes: any = await this.http.get(`${this.apiBase}/code-tasks/agent/digest/today`).toPromise();
      if (todayRes) {
        this.todayDigestSubject.next(todayRes);
      }

      // 3. Загружаем метрики оптимизации
      await this.fetchStreamMetrics();
    } catch (err: any) {
      // API might be warming up
    }
  }

  private setupHeartbeat(sessionId: string): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000); // Throttled 15s interval
  }

  private connectReactiveStream(): void {
    if (typeof EventSource === 'undefined') return;

    try {
      this.eventSource = new EventSource(`${this.apiBase}/flows/stream`);

      this.eventSource.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handleIncomingPulse(packet);
        } catch {
          // Non-JSON pulse
        }
      };
    } catch {
      // Fallback
    }
  }

  private handleIncomingPulse(packet: any): void {
    const pulse: StreamPulseItem = {
      id: packet.id || `p-${Date.now()}`,
      type: packet.type,
      flowName: packet.flowName || 'Combinator Stream',
      timestamp: packet.timestamp || new Date().toISOString(),
      payload: packet.payload,
      coalescedCount: packet.metadata?.coalescedCount,
    };

    const currentPulses = this.livePulsesSubject.getValue();
    this.livePulsesSubject.next([pulse, ...currentPulses.slice(0, 19)]);

    if (packet.type === 'DAILY_DIGEST_COMMITTED') {
      this.refresh();
    }
    if (packet.type === 'AGENT_DECISION') {
      const current = this.decisionsSubject.getValue();
      this.decisionsSubject.next([packet.payload, ...current]);
    }
  }

  private startMetricsPolling(): void {
    interval(4000).subscribe(() => {
      this.fetchStreamMetrics();
    });
  }

  private async fetchStreamMetrics(): Promise<void> {
    try {
      const m = await this.http.get<OptimizationMetrics>(`${this.apiBase}/flows/stream/metrics`).toPromise();
      if (m) {
        this.streamMetricsSubject.next(m);
      }
    } catch {
      // Stream metrics call
    }
  }

  private showToast(message: string): void {
    this.toastSubject.next(message);
    setTimeout(() => {
      if (this.toastSubject.getValue() === message) {
        this.toastSubject.next(null);
      }
    }, 4500);
  }
}
