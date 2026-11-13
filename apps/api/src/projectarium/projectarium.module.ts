import { Module } from '@nestjs/common';
import { ProjectariumController } from './projectarium.controller';
import { ProjectariumService } from './projectarium.service';

@Module({
  controllers: [ProjectariumController],
  providers: [ProjectariumService],
  exports: [ProjectariumService],
})
export class ProjectariumModule {}
