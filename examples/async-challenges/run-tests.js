/**
 * Lemon Actions Test Runner & Analyzer Hook
 * 
 * Автоматически запускает тестовые сьюты задач, анализирует результаты
 * и формирует структурированный отчет в .lemon/results.json для шины Core Combinator.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = __dirname;
const LEMON_DIR = path.join(ROOT_DIR, '.lemon');
const TASKS_FILE = path.join(LEMON_DIR, 'tasks.json');
const RESULTS_FILE = path.join(LEMON_DIR, 'results.json');

function runAllTests() {
  console.log('🍋 [Lemon Code Lab] Запуск анализатора тестов...\n');

  if (!fs.existsSync(TASKS_FILE)) {
    console.error(`❌ Файл конфигурации задач не найден: ${TASKS_FILE}`);
    process.exit(1);
  }

  const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  const tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];

  const results = [];
  let totalPassedSuites = 0;
  let totalFailedSuites = 0;

  for (const task of tasks) {
    const testSuiteRelPath = task.testSuite;
    if (!testSuiteRelPath) {
      results.push({
        taskId: task.id,
        status: 'STUB',
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
        logs: [],
      });
      continue;
    }

    const testSuiteFullPath = path.resolve(ROOT_DIR, testSuiteRelPath);

    if (!fs.existsSync(testSuiteFullPath)) {
      console.log(`⚠️  [${task.id}] Файл тестов еще не создан: ${testSuiteRelPath} -> STUB`);
      results.push({
        taskId: task.id,
        status: 'STUB',
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
        logs: [{ test: 'suite_discovery', error: `Файл не найден: ${testSuiteRelPath}` }],
      });
      continue;
    }

    console.log(`▶ Запуск: "${task.title}" (${testSuiteRelPath})...`);
    const startTime = Date.now();

    // Запускаем нативный node:test с TAP-репортером
    const runResult = spawnSync(
      process.execPath,
      ['--test', '--test-reporter=tap', testSuiteFullPath],
      {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' },
      }
    );

    const durationMs = Date.now() - startTime;
    const stdout = runResult.stdout || '';
    const stderr = runResult.stderr || '';

    // Парсим результаты из вывода TAP (включая вложенные тесты)
    const passMatches = stdout.match(/^[ \t]*ok\s+\d+\s+-\s+(.+)$/gm) || [];
    const failMatches = stdout.match(/^[ \t]*not ok\s+\d+\s+-\s+(.+)$/gm) || [];

    const passedCount = passMatches.length;
    const failedCount = failMatches.length;
    const totalCount = passedCount + failedCount;

    const isExitSuccess = runResult.status === 0;
    const isPassed = isExitSuccess && failedCount === 0 && totalCount > 0;

    const logs = [];
    if (!isPassed) {
      if (stderr.trim()) {
        logs.push({
          test: 'Process Error (stderr)',
          error: stderr.trim(),
        });
      }
      for (const failLine of failMatches) {
        logs.push({
          test: failLine.replace(/^not ok\s+\d+\s+-\s+/, '').trim(),
          error: 'Assertion or runtime error in test',
        });
      }
    }

    const taskResult = {
      taskId: task.id,
      status: isPassed ? 'PASSED' : 'FAILED',
      tests: {
        total: totalCount,
        passed: passedCount,
        failed: failedCount,
        skipped: 0,
      },
      durationMs,
      logs,
    };

    results.push(taskResult);

    if (isPassed) {
      totalPassedSuites++;
      console.log(`   ✅ PASSED: ${passedCount}/${totalCount} тестов за ${durationMs}ms\n`);
    } else {
      totalFailedSuites++;
      console.log(`   ❌ FAILED: ${failedCount} ошибок из ${totalCount} тестов за ${durationMs}ms\n`);
    }
  }

  // Записываем финальный структурированный отчет в .lemon/results.json
  const finalPayload = {
    $schema: 'https://lemon.actions/schemas/test-results.v1.json',
    version: '1.0',
    timestamp: new Date().toISOString(),
    summary: {
      totalTasks: tasks.length,
      passedTasks: totalPassedSuites,
      failedTasks: totalFailedSuites,
    },
    results,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log(`💾 Отчет успешно сохранен в: ${RESULTS_FILE}`);
  console.log(`📊 Итог: ${totalPassedSuites} решено, ${totalFailedSuites} требует внимания.`);
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
