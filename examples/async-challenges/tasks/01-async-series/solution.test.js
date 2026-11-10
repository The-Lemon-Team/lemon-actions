const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { asyncSeries } = require('./solution');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Task 01: Async Series', () => {
  it('должен последовательно выполнить функции и передать результат по цепочке', async () => {
    const tasks = [
      async (val) => val + 10,
      async (val) => {
        await delay(20);
        return val * 2;
      },
      (val) => val - 5, // синхронная функция тоже должна работать
    ];

    const result = await asyncSeries(tasks, 5);
    // (5 + 10) * 2 - 5 = 15 * 2 - 5 = 25
    assert.equal(result, 25);
  });

  it('должен соблюдать строгую временную последовательность выполнения', async () => {
    const executionLog = [];

    const tasks = [
      async () => {
        executionLog.push('start-1');
        await delay(30);
        executionLog.push('end-1');
        return 1;
      },
      async () => {
        executionLog.push('start-2');
        await delay(15);
        executionLog.push('end-2');
        return 2;
      },
    ];

    await asyncSeries(tasks);
    assert.deepEqual(executionLog, ['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('должен сразу завершаться с ошибкой и не выполнять последующие шаги', async () => {
    let secondTaskCalled = false;

    const tasks = [
      async () => {
        throw new Error('Первая функция упала с ошибкой');
      },
      async () => {
        secondTaskCalled = true;
        return 'success';
      },
    ];

    await assert.rejects(
      async () => await asyncSeries(tasks),
      /Первая функция упала с ошибкой/
    );

    assert.equal(secondTaskCalled, false, 'Вторая функция не должна была вызываться');
  });

  it('должен поддерживать отмену через AbortSignal', async () => {
    const controller = new AbortController();
    let stepCount = 0;

    const tasks = [
      async () => {
        stepCount++;
        controller.abort();
        return 'done-1';
      },
      async () => {
        stepCount++;
        return 'done-2';
      },
    ];

    await assert.rejects(
      async () => await asyncSeries(tasks, undefined, { signal: controller.signal }),
      { name: 'AbortError' }
    );

    assert.equal(stepCount, 1);
  });

  it('должен возвращать initialValue при пустом массиве задач', async () => {
    const result = await asyncSeries([], 'default');
    assert.equal(result, 'default');
  });
});
