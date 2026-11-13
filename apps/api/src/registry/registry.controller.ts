import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AppEnvironment, AppNetworkMode } from '@lemon/app-registrar';
import { HeartbeatDto, RegisterAppDto, ReleaseAppDto } from './registry.dto';
import { RegistryService } from './registry.service';

@Controller('registry')
export class RegistryController {
  constructor(private readonly service: RegistryService) {}

  /**
   * Registers a new agent application, allocates an isolated port and issues a lease token.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterAppDto) {
    return this.service.register(dto);
  }

  /**
   * Heartbeat endpoint for active instances to renew their lease.
   */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.service.heartbeat(dto);
  }

  /**
   * Graceful decommission / release of an application port and token.
   */
  @Post('release')
  @HttpCode(HttpStatus.OK)
  release(@Body() dto: ReleaseAppDto) {
    return this.service.release(dto);
  }

  /**
   * Returns active services in the live registry pool with optional environment/network filter.
   */
  @Get('pool')
  getPool(
    @Query('environment') environment?: AppEnvironment,
    @Query('networkMode') networkMode?: AppNetworkMode,
  ) {
    return this.service.getPool(environment, networkMode);
  }

  /**
   * Returns complete live snapshot of the pool including metrics and status.
   */
  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  /**
   * Returns audit chronicle events from the History Neuron.
   */
  @Get('chronicle')
  getChronicle(@Query('limit') limit?: number) {
    return this.service.getChronicle(limit ? Number(limit) : 50);
  }

  /**
   * Endpoint to simulate a failure for testing circuit breaker & eviction.
   */
  @Post('simulate-failure/:id')
  simulateFailure(@Param('id') serviceId: string) {
    this.service.simulateFailure(serviceId);
    return { status: 'FAILURE_RECORDED', serviceId };
  }
}
