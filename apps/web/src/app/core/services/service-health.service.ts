import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, interval } from 'rxjs';
import {
  AppEnvironment,
  AppNetworkMode,
  HealthMeshProjection,
  RegistryChronicleEvent,
  ServiceCheckpointContext,
  ServiceHealthItemState,
  ServicePingRecord,
} from '../models/health-checker.models';

const INITIAL_CONTEXT_CHECKPOINTS: ServiceCheckpointContext[] = [
  {
    id: 'svc-api',
    appName: 'Backend API Gateway',
    url: 'http://localhost:3000/api',
    port: 3000,
    instanceId: 'inst-core-01',
    leaseToken: 'tok-lemon-core-01',
    environment: 'dev',
    networkMode: 'local',
    method: 'GET',
    expectedStatus: 200,
    timeoutMs: 3000,
    group: 'Core Infrastructure',
    icon: 'dns',
    registeredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'svc-web',
    appName: 'Angular Web Frontend',
    url: 'http://localhost:4201',
    port: 4201,
    instanceId: 'inst-core-02',
    leaseToken: 'tok-lemon-core-02',
    environment: 'dev',
    networkMode: 'local',
    method: 'GET',
    expectedStatus: 200,
    timeoutMs: 2000,
    group: 'Core Infrastructure',
    icon: 'web',
    registeredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'svc-db',
    appName: 'PostgreSQL Database Port',
    url: 'http://localhost:5433',
    port: 5433,
    instanceId: 'inst-core-03',
    leaseToken: 'tok-lemon-core-03',
    environment: 'dev',
    networkMode: 'local',
    method: 'HEAD',
    expectedStatus: 200,
    timeoutMs: 2000,
    group: 'Core Infrastructure',
    icon: 'database',
    registeredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'svc-ai-relay',
    appName: 'Production AI Funnel Relay',
    url: 'https://lemon-ai.tailnet.ts.net/health',
    port: 443,
    instanceId: 'inst-prod-04',
    leaseToken: 'tok-lemon-prod-04',
    environment: 'production',
    networkMode: 'tailscale-funnel',
    method: 'GET',
    expectedStatus: 200,
    timeoutMs: 5000,
    group: 'External APIs',
    icon: 'cloud_done',
    registeredAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'svc-staging-mesh',
    appName: 'Staging Mesh Node',
    url: 'http://100.64.0.22:8080/health',
    port: 8080,
    instanceId: 'inst-stg-05',
    leaseToken: 'tok-lemon-stg-05',
    environment: 'staging',
    networkMode: 'tailscale-lan',
    method: 'GET',
    expectedStatus: 200,
    timeoutMs: 4000,
    group: 'Core Infrastructure',
    icon: 'hub',
    registeredAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
];

const INITIAL_CHRONICLE: RegistryChronicleEvent[] = [
  {
    id: 'ev-1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    type: 'ALLOCATED',
    appName: 'Backend API Gateway',
    port: 3000,
    instanceId: 'inst-core-01',
    environment: 'dev',
    networkMode: 'local',
    message: '[DEV | Localhost] Зарегистрирован с токеном tok-lemon-core-01 на :3000',
  },
  {
    id: 'ev-2',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    type: 'ALLOCATED',
    appName: 'Production AI Funnel Relay',
    port: 443,
    instanceId: 'inst-prod-04',
    environment: 'production',
    networkMode: 'tailscale-funnel',
    message: '[PROD | Tailscale Funnel] Общедоступный туннель https://lemon-ai.tailnet.ts.net подключён',
  },
  {
    id: 'ev-3',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    type: 'ALLOCATED',
    appName: 'Staging Mesh Node',
    port: 8080,
    instanceId: 'inst-stg-05',
    environment: 'staging',
    networkMode: 'tailscale-lan',
    message: '[STAGING | Tailscale LAN] Защищённый узел сети 100.64.0.22:8080 взят на мониторинг',
  },
];

function generateInitialHistory(baseLatency: number): ServicePingRecord[] {
  const history: ServicePingRecord[] = [];
  const now = Date.now();
  for (let i = 4; i >= 0; i--) {
    const variance = Math.floor(Math.random() * 14) - 7;
    const latency = Math.max(8, baseLatency + variance);
    history.push({
      id: 'ping-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date(now - i * 30000).toISOString(),
      status: 'UP',
      statusCode: 200,
      latencyMs: latency,
    });
  }
  return history;
}

@Injectable({ providedIn: 'root' })
export class ServiceHealthService {
  private autoRefreshSub: Subscription | null = null;
  private readonly isPingingAll$ = new BehaviorSubject<boolean>(false);
  private nextDynamicPort = 4301;

  private readonly projectionSubject = new BehaviorSubject<HealthMeshProjection>({
    id: 'proj-health-mesh-1',
    neuronPath: 'workspace.core.health',
    historyNeuronPath: 'workspace.core.registry.history',
    title: 'Регистратор приложений и Живой пул сервисов',
    totalServices: INITIAL_CONTEXT_CHECKPOINTS.length,
    healthyCount: INITIAL_CONTEXT_CHECKPOINTS.length,
    averageLatencyMs: 34,
    lastRunAt: new Date().toISOString(),
    autoRefreshIntervalSec: 30,
    isAutoRefreshActive: false,
    services: INITIAL_CONTEXT_CHECKPOINTS.map((ctx, idx) => {
      const baseLatency = idx === 0 ? 14 : idx === 1 ? 18 : idx === 2 ? 10 : idx === 3 ? 56 : 32;
      const history = generateInitialHistory(baseLatency);
      const last = history[history.length - 1];
      return {
        context: ctx,
        currentStatus: 'HEALTHY',
        consecutiveFailures: 0,
        maxFailuresBeforeEviction: 5,
        lastLatencyMs: last.latencyMs,
        lastCheckedAt: last.timestamp,
        history,
      };
    }),
    evictedServices: [],
    chronicle: INITIAL_CHRONICLE,
  });

  readonly projection$: Observable<HealthMeshProjection> = this.projectionSubject.asObservable();
  readonly isPinging$: Observable<boolean> = this.isPingingAll$.asObservable();
  readonly healthEvent$ = new Subject<{ type: 'REGISTERED' | 'PING_ALL' | 'EVICTED' | 'RELEASED'; data: any }>();

  /**
   * Registers a new dynamic agent app, allocates port, assigns environment & networkMode, and generates lease token.
   */
  registerApp(
    appName: string,
    customPort?: number,
    environment: AppEnvironment = 'dev',
    networkMode: AppNetworkMode = 'local',
    group: 'Agent Dynamic Apps' | 'External APIs' = 'Agent Dynamic Apps',
  ): ServiceCheckpointContext {
    const current = this.projectionSubject.getValue();
    const port = customPort && customPort > 0 ? customPort : this.nextDynamicPort++;
    const instanceId = 'inst-' + Math.random().toString(36).substring(2, 8);
    const leaseToken =
      'tok-' +
      appName.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    let url = `http://localhost:${port}/health`;
    if (networkMode === 'tailscale-funnel') {
      url = `https://${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts.net/health`;
    } else if (networkMode === 'tailscale-lan') {
      url = `http://100.64.0.${(port % 100) + 10}:${port}/health`;
    }

    const newContext: ServiceCheckpointContext = {
      id: 'svc-' + Math.random().toString(36).substring(2, 8),
      appName,
      url,
      port,
      instanceId,
      leaseToken,
      environment,
      networkMode,
      method: 'GET',
      expectedStatus: 200,
      timeoutMs: 3000,
      group,
      icon: networkMode === 'tailscale-funnel' ? 'public' : networkMode === 'tailscale-lan' ? 'lock' : 'terminal',
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
    const netLabel = networkMode === 'tailscale-funnel' ? 'Funnel' : networkMode === 'tailscale-lan' ? 'TS-LAN' : 'Local';

    const chronicleEvent: RegistryChronicleEvent = {
      id: 'ev-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      type: 'ALLOCATED',
      appName,
      port,
      instanceId,
      environment,
      networkMode,
      message: `[${envLabel} | ${netLabel}] ${appName} зарегистрирован с токеном ${leaseToken} на ${url}`,
    };

    const updatedServices = [newService, ...current.services];

    this.projectionSubject.next({
      ...current,
      totalServices: updatedServices.length,
      healthyCount: updatedServices.filter((s) => s.currentStatus === 'HEALTHY').length,
      services: updatedServices,
      chronicle: [chronicleEvent, ...current.chronicle],
    });

    this.healthEvent$.next({ type: 'REGISTERED', data: newContext });

    return newContext;
  }

  /**
   * Simulates a failure on an app (to test the 5 consecutive failure counter and eviction).
   */
  simulateFailure(serviceId: string): void {
    const current = this.projectionSubject.getValue();
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

      this.projectionSubject.next({
        ...current,
        totalServices: remainingServices.length,
        healthyCount: remainingServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        services: remainingServices,
        evictedServices: [evictedService, ...current.evictedServices],
        chronicle: [chronicleEvent, ...current.chronicle],
      });
      this.healthEvent$.next({ type: 'EVICTED', data: evictedService });
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

      this.projectionSubject.next({
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
    const current = this.projectionSubject.getValue();
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
      message: `🟢 RELEASED: Агент штатно завершил работу для [${svc.context.environment}] ${svc.context.appName}.`,
    };

    const remainingServices = current.services.filter((s) => s.context.id !== serviceId);

    this.projectionSubject.next({
      ...current,
      totalServices: remainingServices.length,
      healthyCount: remainingServices.filter((s) => s.currentStatus === 'HEALTHY').length,
      services: remainingServices,
      chronicle: [chronicleEvent, ...current.chronicle],
    });

    this.healthEvent$.next({ type: 'RELEASED', data: svc.context });
  }

  pingAll(): void {
    this.isPingingAll$.next(true);

    const current = this.projectionSubject.getValue();
    const updatedServices = current.services.map((s) => ({
      ...s,
      currentStatus: 'CHECKING' as const,
    }));
    this.projectionSubject.next({ ...current, services: updatedServices });

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
        finishedServices.reduce((acc, s) => acc + s.lastLatencyMs, 0) / finishedServices.length,
      );

      this.projectionSubject.next({
        ...current,
        totalServices: finishedServices.length,
        healthyCount: finishedServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        averageLatencyMs: avgLat,
        lastRunAt: new Date().toISOString(),
        services: finishedServices,
      });

      this.isPingingAll$.next(false);
      this.healthEvent$.next({ type: 'PING_ALL', data: finishedServices });
    }, 400);
  }

  pingSingle(serviceId: string): void {
    const current = this.projectionSubject.getValue();
    const target = current.services.find((s) => s.context.id === serviceId);
    if (!target) return;

    const updatedServices = current.services.map((s) =>
      s.context.id === serviceId ? { ...s, currentStatus: 'CHECKING' as const } : s,
    );
    this.projectionSubject.next({ ...current, services: updatedServices });

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
        finalServices.reduce((acc, s) => acc + s.lastLatencyMs, 0) / finalServices.length,
      );

      this.projectionSubject.next({
        ...current,
        averageLatencyMs: avgLat,
        healthyCount: finalServices.filter((s) => s.currentStatus === 'HEALTHY').length,
        services: finalServices,
      });
    }, 250);
  }

  toggleAutoRefresh(): void {
    const current = this.projectionSubject.getValue();
    const nextActive = !current.isAutoRefreshActive;

    if (nextActive) {
      this.autoRefreshSub = interval(current.autoRefreshIntervalSec * 1000).subscribe(() => {
        this.pingAll();
      });
    } else {
      this.autoRefreshSub?.unsubscribe();
      this.autoRefreshSub = null;
    }

    this.projectionSubject.next({
      ...current,
      isAutoRefreshActive: nextActive,
    });
  }

  getContextJson(): string {
    const services = this.projectionSubject.getValue().services.map((s) => s.context);
    return JSON.stringify({ checkpoints: services }, null, 2);
  }
}
