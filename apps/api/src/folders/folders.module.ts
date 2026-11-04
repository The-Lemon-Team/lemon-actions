import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersRepository } from './folders.repository';
import { FoldersService } from './folders.service';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService, FoldersRepository],
  exports: [FoldersService, FoldersRepository],
})
export class FoldersModule {}
