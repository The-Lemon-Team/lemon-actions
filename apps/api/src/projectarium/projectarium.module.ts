import { Module } from '@nestjs/common';
import { ProjectariumController } from './projectarium.controller';
import { ProjectariumService } from './projectarium.service';
import { TimelinesSyncService } from './timelines-sync.service';

@Module({
  controllers: [ProjectariumController],
  providers: [ProjectariumService, TimelinesSyncService],
  exports: [ProjectariumService, TimelinesSyncService],
})
export class ProjectariumModule {}
