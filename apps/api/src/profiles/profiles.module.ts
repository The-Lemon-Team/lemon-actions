import { Module } from '@nestjs/common';
import { FlowsModule } from '../flows/flows.module';
import { FoldersModule } from '../folders/folders.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [FoldersModule, FlowsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
