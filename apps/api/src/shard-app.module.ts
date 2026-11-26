import { Module } from '@nestjs/common';
import { StackBusModule } from './bus/stack-bus.module';
import { EventsModule } from './events/events.module';
import { FlowsModule } from './flows/flows.module';
import { FoldersModule } from './folders/folders.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TagsModule } from './tags/tags.module';

/**
 * Lean NestJS module for Tier C Dedicated Project Shards.
 * Excludes Main Control Plane modules (Projectarium, CodeTasks, Media, Ai, Seasons).
 */
@Module({
  imports: [
    PrismaModule,
    StackBusModule,
    ProfilesModule,
    FoldersModule,
    TagsModule,
    FlowsModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class CoreShardAppModule {}
