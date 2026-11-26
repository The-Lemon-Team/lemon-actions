import { Body, Controller, Get, HttpCode, HttpStatus, Optional, Post } from '@nestjs/common';
import { ShardRetentionService } from './shard-retention.service';
import { ShardTelemetryService } from './shard-telemetry.service';

@Controller('shard')
export class ShardController {
  constructor(
    private readonly telemetry: ShardTelemetryService,
    @Optional() private readonly retention?: ShardRetentionService,
  ) {}

  @Get('health')
  health() {
    return this.telemetry.getHealthSnapshot();
  }

  @Post('metrics/publish')
  @HttpCode(HttpStatus.OK)
  publishMetrics() {
    return this.telemetry.publishMetricsSnapshot();
  }

  @Get('retention/status')
  retentionStatus() {
    return this.retention?.getRetentionStatus() ?? {
      enabled: false,
      retentionDays: 0,
      intervalMs: 0,
      lastPrunedAt: null,
      lastDeletedEvents: 0,
      lastDeletedBufferItems: 0,
    };
  }

  @Post('retention/prune')
  @HttpCode(HttpStatus.OK)
  pruneRetention(@Body() body?: { retentionDays?: number; projectSlug?: string }) {
    if (!this.retention) {
      return {
        prunedAt: new Date().toISOString(),
        cutoffIso: new Date().toISOString(),
        retentionDays: 0,
        projectSlug: null,
        deletedEvents: 0,
        deletedBufferItems: 0,
      };
    }
    return this.retention.prune(body);
  }
}
