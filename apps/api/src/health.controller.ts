import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = 'up';
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('DB healthcheck timeout')), 1200);
        }),
      ]);
    } catch {
      db = 'down';
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    return { status: 'ok', db };
  }
}
