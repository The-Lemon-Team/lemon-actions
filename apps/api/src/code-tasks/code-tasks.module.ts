import { Module } from '@nestjs/common';
import { FlowsModule } from '../flows/flows.module';
import { FoldersModule } from '../folders/folders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeTasksController } from './code-tasks.controller';
import { CodeTasksService } from './code-tasks.service';

@Module({
  imports: [PrismaModule, FoldersModule, FlowsModule],
  controllers: [CodeTasksController],
  providers: [CodeTasksService],
  exports: [CodeTasksService],
})
export class CodeTasksModule {}
