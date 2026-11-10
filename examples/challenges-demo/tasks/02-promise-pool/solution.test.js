const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { promisePool } = require('./solution');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Task 02: Promise Pool & Concurrency Limit', () => {
  it('должен выполнить все задачи и сохранить порядок результатов', async () => {
    // Вторая задача завершается быстрее первой, но порядок должен сохраниться
    const factories = [
      async () => {
        await delay(30);
        return 'first';
      },
      async () => {
        await delay(10);
        return 'second';
      },
      async () => {
        await delay(15);
        return 'third';
      },
    ];

    const results = await promisePool(factories, 2);
    assert.deepEqual(results, ['first', 'second', 'third']);
  });

  it('никогда не должен превышать заданный лимит одновременно работающих задач', async () => {
    let activeTasks = 0;
    let peakActive = 0;
    const concurrencyLimit = 2;

    const factories = Array.from({ length: 6 }, (_, idx) => async () => {
      activeTasks++;
      if (activeTasks > peakActive) {
        peakActive = activeTasks;
      }

      await delay(20);

      activeTasks--;
      return idx * 10;
    });

    const results = await promisePool(factories, concurrencyLimit);

    assert.equal(results.length, 6);
    assert.equal(peakActive, concurrencyLimit, `Пик параллелизма (${peakActive}) не должен превышать ${concurrencyLimit}`);
  });

  it('должен прерываться и выбрасывать ошибку при падении одной из задач', async () => {
    const factories = [
      async () => {
        await delay(10);
        return 'ok-1';
      },
      async () => {
        await delay(15);
        throw new Error('Сбой в пуле воркеров');
      },
      async () => {
        await delay(50);
        return 'ok-3';
      },
    ];

    await assert.rejects(
      async () => await promisePool(factories, 2),
      /Сбой в пуле воркеров/
    );
  });

  it('должен работать при concurrency превышающей количество задач', async () => {
    const factories = [
      async () => 'a',
      async () => 'b',
    ];

    const results = await promisePool(factories, 10);
    assert.deepEqual(results, ['a', 'b']);
  });

  it('должен возвращать пустой массив при отсутствии задач', async () => {
    const results = await promisePool([], 3);
    assert.deepEqual(results, []);
  });
});
