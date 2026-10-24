import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (e) {
      // Do not crash on boot if DB is temporarily unavailable; queries will fail until it is up.
      this.logger.warn(`Database connection failed: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
