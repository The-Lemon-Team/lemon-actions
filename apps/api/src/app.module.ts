import { Module } from '@nestjs/common';
import { CodeTasksModule } from './code-tasks/code-tasks.module';
import { EventsModule } from './events/events.module';
import { FlowsModule } from './flows/flows.module';
import { FoldersModule } from './folders/folders.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RegistryModule } from './registry/registry.module';
import { ProjectariumModule } from './projectarium/projectarium.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [
    PrismaModule,
    ProfilesModule,
    FoldersModule,
    TagsModule,
    FlowsModule,
    EventsModule,
    CodeTasksModule,
    RegistryModule,
    ProjectariumModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

