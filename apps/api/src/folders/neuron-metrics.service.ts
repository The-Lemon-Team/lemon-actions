import { Injectable, NotFoundException } from '@nestjs/common';
import { FlowStatus, FlowType } from '@prisma/client';
import { FoldersRepository } from './folders.repository';

export interface NeuronMetricsDto {
  folderId: string;
  folderName: string;
  folderPath: string;
  telemetry: {
    totalPulses: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    lastPulseAt: string | null;
  };
  activeState: {
    isExclusiveLocked: boolean;
    activeSessionsCount: number;
    activeFlows: string[];
    flowsByType: Record<string, number>;
  };
  recentErrors: Array<{
    id: string;
    flowId: string;
    eventType: string;
    timestamp: string;
    message: string;
  }>;
}

@Injectable()
export class NeuronMetricsService {
  constructor(private readonly repo: FoldersRepository) {}

  async calculateMetrics(folderId: string): Promise<NeuronMetricsDto> {
    const folder = await this.repo.findById(folderId);
    if (!folder) throw new NotFoundException(`Folder (Neuron) ${folderId} not found`);

    const { flows, activeSessions, recentEvents } = await this.repo.findFolderContextData(folderId);

    const latencies: number[] = [];
    let errorCount = 0;
    const recentErrors: NeuronMetricsDto['recentErrors'] = [];
    const flowsByType: Record<string, number> = {};
    const activeFlows: string[] = [];
    let isExclusiveLocked = false;

    for (const f of flows) {
      flowsByType[f.type] = (flowsByType[f.type] ?? 0) + 1;
      const isRunning = f.status === FlowStatus.ACTIVE || f.status === FlowStatus.PROCESSING;
      if (isRunning) {
        activeFlows.push(f.name);
        if (f.isExclusive) isExclusiveLocked = true;
      }
    }

    for (const ev of recentEvents) {
      const payload = (ev.payload ?? {}) as Record<string, any>;
      const lat = payload.latencyMs ?? payload.durationMs;
      if (typeof lat === 'number' && lat >= 0) {
        latencies.push(lat);
      }

      const isError =
        ev.eventType.includes('FAIL') ||
        ev.eventType.includes('ERROR') ||
        payload.error !== undefined ||
        (payload.statusCode && payload.statusCode >= 400);

      if (isError) {
        errorCount++;
        if (recentErrors.length < 10) {
          recentErrors.push({
            id: ev.id,
            flowId: ev.flowId,
            eventType: ev.eventType,
            timestamp: ev.createdAt.toISOString(),
            message: String(payload.error || payload.message || ev.eventType),
          });
        }
      }
    }

    const totalPulses = recentEvents.length;
    const successRate = totalPulses > 0 ? Math.round(((totalPulses - errorCount) / totalPulses) * 100) : 100;

    latencies.sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const p95Index = latencies.length > 0 ? Math.floor(latencies.length * 0.95) : 0;
    const p95LatencyMs = latencies.length > 0 ? latencies[Math.min(p95Index, latencies.length - 1)] : 0;

    const lastPulseAt = recentEvents.length > 0 ? recentEvents[0].createdAt.toISOString() : null;

    return {
      folderId: folder.id,
      folderName: folder.name,
      folderPath: folder.path,
      telemetry: {
        totalPulses,
        successRate,
        avgLatencyMs,
        p95LatencyMs,
        lastPulseAt,
      },
      activeState: {
        isExclusiveLocked,
        activeSessionsCount: activeSessions.length,
        activeFlows,
        flowsByType,
      },
      recentErrors,
    };
  }
}
