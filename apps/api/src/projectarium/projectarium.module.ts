import { Module } from '@nestjs/common';
import { ProjectariumController } from './projectarium.controller';
import { ProjectariumService } from './projectarium.service';
import { ShardAnalyticsService } from './shard-analytics.service';
import { TimelinesSyncService } from './timelines-sync.service';

@Module({
  controllers: [ProjectariumController],
  providers: [ProjectariumService, TimelinesSyncService, ShardAnalyticsService],
  exports: [ProjectariumService, TimelinesSyncService, ShardAnalyticsService],
})
export class ProjectariumModule {}
