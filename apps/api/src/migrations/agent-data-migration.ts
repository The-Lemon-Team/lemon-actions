import { PrismaClient } from '@prisma/client';

export interface MigrationSummary {
  scannedEvents: number;
  prunedLogsCount: number;
  dedupedTicksCount: number;
  preservedMilestonesCount: number;
  migratedAt: string;
}

export async function runAgentDataMigration(prisma: PrismaClient): Promise<MigrationSummary> {
  const allEvents = await prisma.flowEvent.findMany({
    orderBy: { createdAt: 'asc' },
  });

  let prunedLogsCount = 0;
  let dedupedTicksCount = 0;
  let preservedMilestonesCount = 0;

  for (const event of allEvents) {
    const payload = (event.payload as any) || {};

    // 1. Полезное, что МЫ ОСТАВЛЯЕМ (Milestones: Completed tasks, Decisions, Digests, Session bounds)
    if (
      event.eventType === 'TASK_COMPLETED' ||
      event.eventType === 'TESTS_PASSED' ||
      event.eventType === 'AGENT_DECISION' ||
      event.eventType === 'DAILY_DIGEST_COMMITTED' ||
      event.eventType === 'AGENT_SESSION_INIT' ||
      event.eventType === 'TASK_DISCOVERED'
    ) {
      preservedMilestonesCount++;

      // Помечаем чистым тегом миграции
      if (!payload._migrated) {
        await prisma.flowEvent.update({
          where: { id: event.id },
          data: {
            payload: {
              ...payload,
              _migrated: 'v2',
              _tier: 'DURABLE',
            },
          },
        });
      }
      continue;
    }

    // 2. Чем МЫ ПРЕНЕБРЕГАЕМ и ЧТО СЖИМАЕМ:
    // Старые раздутые логи тестов с полными стэктрейсами
    if (event.eventType === 'TESTS_FAILED' && payload.logs && Array.isArray(payload.logs)) {
      prunedLogsCount++;
      const compactedLogs = payload.logs.slice(0, 3).map((l: any) => ({
        test: l.test || 'unknown',
        error: typeof l.error === 'string' ? l.error.slice(0, 160) : undefined,
      }));

      await prisma.flowEvent.update({
        where: { id: event.id },
        data: {
          payload: {
            action: payload.action || 'tests_failing',
            tests: payload.tests,
            failedCount: payload.failedCount,
            logs: compactedLogs,
            _migrated: 'v2',
            _compressedFromRaw: true,
          },
        },
      });
      continue;
    }

    // Удаляем избыточные повторяющиеся импульсы таймеров или сырых пингов
    if (event.eventType === 'TIMER_TICK' || event.eventType === 'FLOW_TRIGGER') {
      dedupedTicksCount++;
      // Удаляем или сжимаем сырой тик
      await prisma.flowEvent.delete({
        where: { id: event.id },
      });
    }
  }

  return {
    scannedEvents: allEvents.length,
    prunedLogsCount,
    dedupedTicksCount,
    preservedMilestonesCount,
    migratedAt: new Date().toISOString(),
  };
}

// Standalone runner if executed via CLI
if (require.main === module) {
  const prisma = new PrismaClient();
  console.log('🚀 Running Lemon Actions Agent Data Migration...');
  runAgentDataMigration(prisma)
    .then((summary) => {
      console.log('✅ Migration completed successfully:', summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
