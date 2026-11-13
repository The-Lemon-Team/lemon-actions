import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  AppEnvironment,
  AppNetworkMode,
  LiveRegistrarEngine,
  LiveRegistryPoolSnapshot,
  RegistryChronicleEvent,
  ServiceCheckpointContext,
  ServiceHealthItemState,
} from '@lemon/app-registrar';
import { HeartbeatDto, RegisterAppDto, ReleaseAppDto } from './registry.dto';

@Injectable()
export class RegistryService {
  private readonly engine: LiveRegistrarEngine;

  constructor() {
    this.engine = new LiveRegistrarEngine({
      title: 'Lemon Central Application Registrar & Port Shield',
      neuronPath: 'workspace.core.health',
      historyNeuronPath: 'workspace.core.registry.history',
    });

    // Seed initial core infrastructure
    this.engine.registerApp({
      appName: 'Backend API Gateway',
      customPort: 3000,
      environment: 'dev',
      networkMode: 'local',
      group: 'Core Infrastructure',
    });

    this.engine.registerApp({
      appName: 'Angular Web Frontend',
      customPort: 4201,
      environment: 'dev',
      networkMode: 'local',
      group: 'Core Infrastructure',
    });

    this.engine.registerApp({
      appName: 'PostgreSQL Database Port',
      customPort: 5433,
      environment: 'dev',
      networkMode: 'local',
      group: 'Core Infrastructure',
    });

    this.engine.registerApp({
      appName: 'Production AI Funnel Relay',
      customPort: 443,
      environment: 'production',
      networkMode: 'tailscale-funnel',
      group: 'External APIs',
    });
  }

  register(dto: RegisterAppDto): ServiceCheckpointContext {
    return this.engine.registerApp({
      appName: dto.appName,
      customPort: dto.desiredPort,
      environment: dto.environment,
      networkMode: dto.networkMode,
      group: dto.group,
      projectId: dto.projectId,
      projectName: dto.projectName,
    });
  }

  heartbeat(dto: HeartbeatDto): { status: 'HEARTBEAT_ACK'; instanceId: string; renewedAt: string } {
    const snap = this.engine.currentSnapshot;
    const target = snap.services.find((s) => s.context.instanceId === dto.instanceId);

    if (!target) {
      throw new NotFoundException(`Application instance ${dto.instanceId} not found in active pool`);
    }

    if (target.context.leaseToken !== dto.leaseToken) {
      throw new UnauthorizedException(`Invalid lease token for instance ${dto.instanceId}`);
    }

    this.engine.pingSingle(target.context.id);

    return {
      status: 'HEARTBEAT_ACK',
      instanceId: dto.instanceId,
      renewedAt: new Date().toISOString(),
    };
  }

  release(dto: ReleaseAppDto): { status: 'RELEASED'; instanceId: string; releasedAt: string } {
    const snap = this.engine.currentSnapshot;
    const target = snap.services.find((s) => s.context.instanceId === dto.instanceId);

    if (!target) {
      throw new NotFoundException(`Application instance ${dto.instanceId} not found in active pool`);
    }

    if (target.context.leaseToken !== dto.leaseToken) {
      throw new UnauthorizedException(`Invalid lease token for instance ${dto.instanceId}`);
    }

    this.engine.releaseApp(target.context.id);

    return {
      status: 'RELEASED',
      instanceId: dto.instanceId,
      releasedAt: new Date().toISOString(),
    };
  }

  getPool(environment?: AppEnvironment, networkMode?: AppNetworkMode): ServiceHealthItemState[] {
    const snap = this.engine.currentSnapshot;
    return snap.services.filter((s) => {
      const matchEnv = !environment || s.context.environment === environment;
      const matchNet = !networkMode || s.context.networkMode === networkMode;
      return matchEnv && matchNet;
    });
  }

  getSnapshot(): LiveRegistryPoolSnapshot {
    return this.engine.currentSnapshot;
  }

  getChronicle(limit = 50): RegistryChronicleEvent[] {
    const snap = this.engine.currentSnapshot;
    return snap.chronicle.slice(0, limit);
  }

  simulateFailure(serviceId: string): void {
    this.engine.simulateFailure(serviceId);
  }
}
