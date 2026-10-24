import { Module } from '@nestjs/common';
import { EventsModule } from './events/events.module';
import { FlowsModule } from './flows/flows.module';
import { FoldersModule } from './folders/folders.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [PrismaModule, FoldersModule, TagsModule, FlowsModule, EventsModule],
  controllers: [HealthController],
})
export class AppModule {}
