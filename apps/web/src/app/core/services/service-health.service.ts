import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest, interval, map } from 'rxjs';
import {
  AppEnvironment,
  AppHealthStatus,
  AppNetworkMode,
  HealthMeshProjection,
  RegistryChronicleEvent,
  ServiceCheckpointContext,
  ServiceHealthItemState,
  ServicePingRecord,
} from '../models/health-checker.models';
import { ProjectStand, StandAppItem } from '../models/project-stand.models';
import { ProjectStandService } from './project-stand.service';

/**
 * Projects Lemon-Projectarium stands & applications into a flat live service pool view.
 */
@Injectable({ providedIn: 'root' })
export class ServiceHealthService {
  private readonly standService = inject(ProjectStandService);
  private autoRefreshSub: Subscription | null = null;
  private readonly isPingingAll$ = new BehaviorSubject<boolean>(false);
  private readonly isAutoRefreshActive$ = new BehaviorSubject<boolean>(false);

  private readonly appStandMap = new Map<string, { standId: string; app: StandAppItem }>();

  readonly projection$: Observable<HealthMeshProjection> = combineLatest([
    this.standService.allStands$,
    this.isAutoRefreshActive$,
  ]).pipe(map(([stands, isAutoRefreshActive]) => this.buildProjection(stands, isAutoRefreshActive)));

  readonly isPinging$: Observable<boolean> = this.isPingingAll$.asObservable();

  /**
   * Registers a new dynamic agent app into Projectarium ("Agent Dynamic Apps" stand by default).
   */
  registerApp(
    appName: string,
    customPort?: number,
    environment: AppEnvironment = 'dev',
    networkMode: AppNetworkMode = 'local',
    projectName = 'Agent Dynamic Apps',
  ): void {
    const host =
      networkMode === 'tailscale-funnel'
        ? `${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts.net`
        : networkMode === 'tailscale-lan'
          ? '100.64.0.10'
          : networkMode === 'lan'
            ? '192.168.1.100'
            : 'localhost';

    this.standService
      .smartRegister({
        projectName,
        appName,
        host,
        preferredPort: customPort && customPort > 0 ? customPort : undefined,
        environment,
        networkMode,
        author: 'projectarium-pool-ui',
      })
      .subscribe({
        error: () => {
          // Offline fallback: register inside local stand store
          let targetStand: ProjectStand | undefined;
          this.standService.allStands$
            .subscribe((stands) => {
              targetStand = stands.find(
                (s) => s.slug === 'agent-dynamic-apps' || s.name === projectName,
              );
            })
            .unsubscribe();

          if (!targetStand) {
            targetStand = this.standService.registerStand({
              name: projectName,
              slug: 'agent-dynamic-apps',
              description: 'Динамические приложения автономных агентов',
              neuronPath: 'workspace.agent-dynamic-apps',
            });
          }

          this.standService.addAppToStand(targetStand.id, {
            appName,
            role: 'Динамический сервис агента',
            host,
            desiredPort: customPort,
            environment,
            networkMode,
          });
        },
      });
  }

  /**
   * Gracefully releases an allocated app port and instance from its owning Projectarium stand.
   */
  releaseApp(serviceId: string): void {
    const entry = this.appStandMap.get(serviceId);
    if (!entry) return;
    this.standService.removeAppFromStand(entry.standId, entry.app.instanceId || entry.app.id);
  }

  /**
   * Triggers a real healthcheck round across all Projectarium stands.
   */
  pingAll(): void {
    this.isPingingAll$.next(true);
    let stands: ProjectStand[] = [];
    this.standService.allStands$.subscribe((list) => (stands = list)).unsubscribe();
    for (const stand of stands) {
      this.standService.pingStandApps(stand.id);
    }
    setTimeout(() => this.isPingingAll$.next(false), 600);
  }

  /**
   * Triggers a real healthcheck for a single application instance.
   */
  pingSingle(serviceId: string): void {
    const entry = this.appStandMap.get(serviceId);
    if (!entry) return;
    this.standService.pingSingleApp(entry.standId, entry.app.instanceId || entry.app.id);
  }

  toggleAutoRefresh(): void {
    const nextActive = !this.isAutoRefreshActive$.getValue();
    if (nextActive) {
      this.autoRefreshSub = interval(30_000).subscribe(() => this.pingAll());
    } else {
      this.autoRefreshSub?.unsubscribe();
      this.autoRefreshSub = null;
    }
    this.isAutoRefreshActive$.next(nextActive);
  }

  getContextJson(): string {
    const checkpoints = Array.from(this.appStandMap.values()).map(({ app }) =>
      this.mapToCheckpointContext(app),
    );
    return JSON.stringify({ checkpoints }, null, 2);
  }

  private buildProjection(
    stands: ProjectStand[],
    isAutoRefreshActive: boolean,
  ): HealthMeshProjection {
    this.appStandMap.clear();

    const activeServices: ServiceHealthItemState[] = [];
    const evictedServices: ServiceHealthItemState[] = [];
    const chronicle: RegistryChronicleEvent[] = [];

    for (const stand of stands) {
      for (const app of stand.apps) {
        const svcId = app.instanceId || app.id;
        this.appStandMap.set(svcId, { standId: stand.id, app });
        const item = this.mapAppToHealthItem(app);
        if (item.currentStatus === 'EVICTED') {
          evictedServices.push(item);
        } else {
          activeServices.push(item);
        }
      }

      for (const ev of stand.chronicle.slice(0, 10)) {
        const badge = ev.badge || '';
        const type: RegistryChronicleEvent['type'] =
          badge === 'APP_EVICTED' || badge === 'EVICTED'
            ? 'EVICTED'
            : badge === 'APP_DEGRADED' || badge === 'DEGRADED'
              ? 'DEGRADED'
              : badge === 'APP_RELEASED' || badge === 'RELEASED'
                ? 'RELEASED'
                : badge === 'APP_HEARTBEAT' || badge === 'HEALTHCHECK_PING'
                  ? 'HEARTBEAT'
                  : 'ALLOCATED';
        chronicle.push({
          id: ev.id,
          timestamp: ev.timestamp,
          type,
          appName: stand.name,
          port: stand.apps[0]?.port || 4320,
          instanceId: stand.slug,
          environment: 'dev',
          networkMode: 'local',
          message: `[${stand.name}] ${ev.title}${ev.details ? ` — ${ev.details}` : ''}`,
        });
      }
    }

    chronicle.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const healthyCount = activeServices.filter((s) => s.currentStatus === 'HEALTHY').length;
    const latencyValues = activeServices
      .map((s) => s.lastLatencyMs)
      .filter((ms) => ms > 0);
    const averageLatencyMs =
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((sum, ms) => sum + ms, 0) / latencyValues.length)
        : 0;

    return {
      id: 'proj-health-mesh-projectarium',
      neuronPath: 'workspace.projectarium.pool',
      historyNeuronPath: 'workspace.projectarium.chronicle',
      title: 'Projectarium Port Shield & Живой пул сервисов',
      totalServices: activeServices.length,
      healthyCount,
      averageLatencyMs,
      lastRunAt: new Date().toISOString(),
      autoRefreshIntervalSec: 30,
      isAutoRefreshActive,
      services: activeServices,
      evictedServices,
      chronicle: chronicle.slice(0, 50),
    };
  }

  private mapToCheckpointContext(app: StandAppItem): ServiceCheckpointContext {
    return {
      id: app.instanceId || app.id,
      appName: app.appName,
      url: app.url,
      port: app.port,
      instanceId: app.instanceId,
      leaseToken: app.leaseToken,
      environment: app.environment,
      networkMode: app.networkMode,
      method: 'GET',
      expectedStatus: 200,
      timeoutMs: 2500,
      group: 'Agent Dynamic Apps',
      icon: app.icon,
      registeredAt: app.lastCheckedAt,
    };
  }

  private mapAppToHealthItem(app: StandAppItem): ServiceHealthItemState {
    const status: AppHealthStatus =
      app.status === 'OFFLINE' ? 'DEGRADED' : (app.status as AppHealthStatus);
    const pingStatus: ServicePingRecord['status'] =
      status === 'HEALTHY' ? 'UP' : status === 'DEGRADED' ? 'DEGRADED' : 'DOWN';

    return {
      context: this.mapToCheckpointContext(app),
      currentStatus: status,
      consecutiveFailures: app.consecutiveFailures,
      maxFailuresBeforeEviction: 5,
      lastLatencyMs: app.lastLatencyMs,
      lastCheckedAt: app.lastCheckedAt,
      history: [
        {
          id: `ping-${app.id}`,
          timestamp: app.lastCheckedAt,
          status: pingStatus,
          statusCode: status === 'HEALTHY' ? 200 : 503,
          latencyMs: app.lastLatencyMs,
        },
      ],
    };
  }
}
