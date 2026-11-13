import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';
import {
  AppEnvironment,
  AppNetworkMode,
  LiveRegistryPoolSnapshot,
  RegisterAppPayload,
  RegistryChronicleEvent,
  ServiceCheckpointContext,
  ServiceHealthItemState,
  ServicePingRecord,
} from '../types/registrar.types';

export class LiveRegistrarEngine {
  private autoRefreshSub: Subscription | null = null;
  private readonly isPingingAll$ = new BehaviorSubject<boolean>(false);
  private nextDynamicPort = 4301;

  private readonly poolSubject: BehaviorSubject<LiveRegistryPoolSnapshot>;

  constructor(initialSnapshot?: Partial<LiveRegistryPoolSnapshot>) {
    const defaultSnapshot: LiveRegistryPoolSnapshot = {
      id: 'pool-live-main',
      neuronPath: 'workspace.core.health',
      historyNeuronPath: 'workspace.core.registry.history',
      title: 'Регистратор приложений и Живой пул сервисов',
      totalServices: 0,
      healthyCount: 0,
      averageLatencyMs: 0,
      lastRunAt: new Date().toISOString(),
      autoRefreshIntervalSec: 30,
      isAutoRefreshActive: false,
      services: [],
      evictedServices: [],
      chronicle: [],
      ...initialSnapshot,
    };

    this.poolSubject = new BehaviorSubject<LiveRegistryPoolSnapshot>(defaultSnapshot);
  }

  get pool$(): Observable<LiveRegistryPoolSnapshot> {
    return this.poolSubject.asObservable();
  }

  get isPinging$(): Observable<boolean> {
    return this.isPingingAll$.asObservable();
  }

  get currentSnapshot(): LiveRegistryPoolSnapshot {
    return this.poolSubject.getValue();
  }

  /**
   * Registers a new dynamic agent app, allocates port, assigns environment & networkMode, and generates lease token.
   */
  registerApp(payload: RegisterAppPayload): ServiceCheckpointContext {
    const current = this.poolSubject.getValue();
    const environment: AppEnvironment = payload.environment || 'dev';
    const networkMode: AppNetworkMode = payload.networkMode || 'local';
    const port = payload.customPort && payload.customPort > 0 ? payload.customPort : this.nextDynamicPort++;
    const instanceId = 'inst-' + Math.random().toString(36).substring(2, 8);
    const leaseToken =
      'tok-' +
      payload.appName.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    let url = `http://localhost:${port}/health`;
    if (networkMode === 'tailscale-funnel') {
      url = `https://${payload.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts.net/health`;
    } else if (networkMode === 'tailscale-lan') {
      url = `http://100.64.0.${(port % 100) + 10}:${port}/health`;
    }

    const newContext: ServiceCheckpointContext = {
      id: 'svc-' + Math.random().toString(36).substring(2, 8),
      appName: payload.appName,
      url,
      port,
      instanceId,
      leaseToken,
      environment,
      networkMode,
      method: 'GET',
      expectedStatus: payload.expectedStatus || 200,
      timeoutMs: payload.timeoutMs || 3000,
      group: payload.group || 'Agent Dynamic Apps',
      icon: networkMode === 'tailscale-funnel' ? 'public' : networkMode === 'tailscale-lan' ? 'lock' : 'terminal',
      projectId: payload.projectId,
      projectName: payload.projectName,
      registeredAt: new Date().toISOString(),
    };

    const newRecord: ServicePingRecord = {
      id: 'ping-init',
      timestamp: new Date().toISOString(),
      status: 'UP',
      statusCode: 200,
      latencyMs: networkMode === 'tailscale-funnel' ? 45 : 14,
    };

    const newService: ServiceHealthItemState = {
      context: newContext,
      currentStatus: 'HEALTHY',
      consecutiveFailures: 0,
      maxFailuresBeforeEviction: 5,
      lastLatencyMs: newRecord.latencyMs,
      lastCheckedAt: new Date().toISOString(),
      history: [newRecord],
    };

    const envLabel = environment.toUpperCase();
    const netLabel =
      networkMode === 'tailscale-funnel' ? 'Funnel' : networkMode === 'tailscale-lan' ? 'TS-LAN' : 'Local';

    const chronicleEvent: RegistryChronicleEvent = {
      id: 'ev-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      type: 'ALLOCATED',
      appName: payload.appName,
      port,
      instanceId,
      environment,
      networkMode,
      message: `[${envLabel} | ${netLabel}] ${payload.appName} зарегистрирован с токеном ${leaseToken} на ${url}`,
    };

    const updatedServices = [newService, ...current.services];

    this.poolSubject.next({
      ...current,
      totalServices: updatedServices.length,
      healthyCount: updatedServices.filter((s) => s.currentStatus === 'HEALTHY').length,
      services: updatedServices,
      chronicle: [chronicleEvent, ...current.chronicle],
    });

    return newContext;
  }

  /**
   * Simulates a failure on an app (to test the 5 consecutive failure counter and eviction).
   */
  simulateFailure(serviceId: string): void {
    const current = this.poolSubject.getValue();
    const svc = current.services.find((s) => s.context.id === serviceId);
    if (!svc) return;

    const nextFailures = svc.consecutiveFailures + 1;
    const now = new Date().toISOString();

    if (nextFailures >= svc.maxFailuresBeforeEviction) {
      // EVICTION TRIGGERED: Circuit breaker trips, service is removed from active pool!
      const evictedService: ServiceHealthItemState = {
        ...svc,
        currentStatus: 'EVICTED',
        consecutiveFailures: nextFailures,
        lastCheckedAt: now,
      };

      const chronicleEvent: RegistryChronicleEvent = {
        id: 'ev-' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        type: 'EVICTED',
        appName: svc.context.appName,
        port: svc.context.port,
        instanceId: svc.context.instanceId,
        environment: svc.context.environment,
        networkMode: svc.context.networkMode,
        message: `🔴 EVICTED [${svc.context.environment.toUpperCase()}]: Сервис не ответил ${nextFailures} раз(а) подряд. Порт :${svc.context.port} освобождён.`,
      };

      const remainingServices = current.services.filter((s) => s.context.id !== serviceId);

      this.poolSubject.next({
        ...current,
        totalServices: remainingServices.length,
        healthyCount: remainingServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        services: remainingServices,
        evictedServices: [evictedService, ...current.evictedServices],
        chronicle: [chronicleEvent, ...current.chronicle],
      });
    } else {
      // DEGRADED: Increment failure count (1/5 ... 4/5)
      const degradedService: ServiceHealthItemState = {
        ...svc,
        currentStatus: 'DEGRADED',
        consecutiveFailures: nextFailures,
        lastCheckedAt: now,
        history: [
          ...svc.history.slice(-4),
          {
            id: 'ping-' + Math.random().toString(36).substring(2, 7),
            timestamp: now,
            status: 'DOWN',
            statusCode: 504,
            latencyMs: 3000,
            error: 'Connection timeout',
          },
        ],
      };

      const chronicleEvent: RegistryChronicleEvent = {
        id: 'ev-' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        type: 'DEGRADED',
        appName: svc.context.appName,
        port: svc.context.port,
        instanceId: svc.context.instanceId,
        environment: svc.context.environment,
        networkMode: svc.context.networkMode,
        message: `🟡 DEGRADED: Сбой ${nextFailures}/${svc.maxFailuresBeforeEviction} для [${svc.context.environment}] ${svc.context.appName}`,
      };

      const updated = current.services.map((s) => (s.context.id === serviceId ? degradedService : s));

      this.poolSubject.next({
        ...current,
        healthyCount: updated.filter((s) => s.currentStatus === 'HEALTHY').length,
        services: updated,
        chronicle: [chronicleEvent, ...current.chronicle],
      });
    }
  }

  /**
   * Graceful release by agent.
   */
  releaseApp(serviceId: string): void {
    const current = this.poolSubject.getValue();
    const svc = current.services.find((s) => s.context.id === serviceId);
    if (!svc) return;

    const chronicleEvent: RegistryChronicleEvent = {
      id: 'ev-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      type: 'RELEASED',
      appName: svc.context.appName,
      port: svc.context.port,
      instanceId: svc.context.instanceId,
      environment: svc.context.environment,
      networkMode: svc.context.networkMode,
      message: `🟢 RELEASED: Агент штатно завершил работу для [${svc.context.environment}] ${svc.context.appName}. Порт :${svc.context.port} освобождён.`,
    };

    const remainingServices = current.services.filter((s) => s.context.id !== serviceId);

    this.poolSubject.next({
      ...current,
      totalServices: remainingServices.length,
      healthyCount: remainingServices.filter((s) => s.currentStatus === 'HEALTHY').length,
      services: remainingServices,
      chronicle: [chronicleEvent, ...current.chronicle],
    });
  }

  pingAll(): void {
    this.isPingingAll$.next(true);

    const current = this.poolSubject.getValue();
    const updatedServices = current.services.map((s) => ({
      ...s,
      currentStatus: 'CHECKING' as const,
    }));
    this.poolSubject.next({ ...current, services: updatedServices });

    setTimeout(() => {
      const finishedServices: ServiceHealthItemState[] = current.services.map((svc) => {
        let simulatedLatency = Math.floor(Math.random() * 15) + 10;
        if (svc.context.networkMode === 'tailscale-funnel') {
          simulatedLatency = Math.floor(Math.random() * 30) + 40;
        } else if (svc.context.networkMode === 'tailscale-lan') {
          simulatedLatency = Math.floor(Math.random() * 20) + 20;
        }

        const newRecord: ServicePingRecord = {
          id: 'ping-' + Math.random().toString(36).substring(2, 7),
          timestamp: new Date().toISOString(),
          status: 'UP',
          statusCode: 200,
          latencyMs: simulatedLatency,
        };

        const newHistory = [...svc.history.slice(-4), newRecord];
        return {
          ...svc,
          currentStatus: 'HEALTHY' as const,
          consecutiveFailures: 0,
          lastLatencyMs: simulatedLatency,
          lastCheckedAt: newRecord.timestamp,
          history: newHistory,
        };
      });

      const avgLat = Math.round(
        finishedServices.reduce((acc, s) => acc + s.lastLatencyMs, 0) / (finishedServices.length || 1),
      );

      this.poolSubject.next({
        ...current,
        totalServices: finishedServices.length,
        healthyCount: finishedServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        averageLatencyMs: avgLat,
        lastRunAt: new Date().toISOString(),
        services: finishedServices,
      });

      this.isPingingAll$.next(false);
    }, 400);
  }

  pingSingle(serviceId: string): void {
    const current = this.poolSubject.getValue();
    const target = current.services.find((s) => s.context.id === serviceId);
    if (!target) return;

    const updatedServices = current.services.map((s) =>
      s.context.id === serviceId ? { ...s, currentStatus: 'CHECKING' as const } : s,
    );
    this.poolSubject.next({ ...current, services: updatedServices });

    setTimeout(() => {
      let simulatedLatency = Math.floor(Math.random() * 12) + 8;
      if (target.context.networkMode === 'tailscale-funnel') {
        simulatedLatency = Math.floor(Math.random() * 25) + 38;
      } else if (target.context.networkMode === 'tailscale-lan') {
        simulatedLatency = Math.floor(Math.random() * 15) + 22;
      }

      const newRecord: ServicePingRecord = {
        id: 'ping-' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        status: 'UP',
        statusCode: 200,
        latencyMs: simulatedLatency,
      };

      const finalServices = current.services.map((s) => {
        if (s.context.id !== serviceId) return s;
        return {
          ...s,
          currentStatus: 'HEALTHY' as const,
          consecutiveFailures: 0,
          lastLatencyMs: simulatedLatency,
          lastCheckedAt: newRecord.timestamp,
          history: [...s.history.slice(-4), newRecord],
        };
      });

      const avgLat = Math.round(
        finalServices.reduce((acc, s) => acc + s.lastLatencyMs, 0) / (finalServices.length || 1),
      );

      this.poolSubject.next({
        ...current,
        averageLatencyMs: avgLat,
        healthyCount: finalServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        services: finalServices,
      });
    }, 250);
  }

  toggleAutoRefresh(): void {
    const current = this.poolSubject.getValue();
    const nextActive = !current.isAutoRefreshActive;

    if (nextActive) {
      this.autoRefreshSub = interval(current.autoRefreshIntervalSec * 1000).subscribe(() => {
        this.pingAll();
      });
    } else {
      this.autoRefreshSub?.unsubscribe();
      this.autoRefreshSub = null;
    }

    this.poolSubject.next({
      ...current,
      isAutoRefreshActive: nextActive,
    });
  }

  getContextJson(): string {
    const services = this.poolSubject.getValue().services.map((s) => s.context);
    return JSON.stringify({ checkpoints: services }, null, 2);
  }
}
