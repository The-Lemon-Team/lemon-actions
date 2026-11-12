import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersRepository } from './folders.repository';
import { FoldersService } from './folders.service';
import { NeuronMetricsService } from './neuron-metrics.service';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService, FoldersRepository, NeuronMetricsService],
  exports: [FoldersService, FoldersRepository, NeuronMetricsService],
})
export class FoldersModule {}
