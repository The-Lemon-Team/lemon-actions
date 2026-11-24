import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { StackBusModule } from './bus/stack-bus.module';
import { CodeTasksModule } from './code-tasks/code-tasks.module';
import { EventsModule } from './events/events.module';
import { FlowsModule } from './flows/flows.module';
import { FoldersModule } from './folders/folders.module';
import { HealthController } from './health.controller';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ProjectariumModule } from './projectarium/projectarium.module';
import { SeasonsModule } from './seasons/seasons.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [
    PrismaModule,
    StackBusModule,
    ProfilesModule,
    FoldersModule,
    TagsModule,
    FlowsModule,
    EventsModule,
    CodeTasksModule,
    ProjectariumModule,
    SeasonsModule,
    MediaModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

