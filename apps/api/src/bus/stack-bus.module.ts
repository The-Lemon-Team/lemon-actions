import { Global, Module } from '@nestjs/common';
import { StackBusController } from './stack-bus.controller';
import { StackBusService } from './stack-bus.service';

@Global()
@Module({
  controllers: [StackBusController],
  providers: [StackBusService],
  exports: [StackBusService],
})
export class StackBusModule {}
