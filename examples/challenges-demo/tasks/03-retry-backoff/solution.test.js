const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { retryWithBackoff } = require('./solution');

describe('Task 03: Retry with Exponential Backoff', () => {
  it('должен сразу вернуть результат без повторов при первом успехе', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return 'instant-success';
    };

    const res = await retryWithBackoff(fn, { maxRetries: 3 });
    assert.equal(res, 'instant-success');
    assert.equal(calls, 1);
  });

  it('должен повторить вызов и успешно вернуть результат на 3-й попытке', async () => {
    let attempts = 0;
    const recordedDelays = [];

    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Сбой попытки ${attempts}`);
      }
      return 'recovered';
    };

    const res = await retryWithBackoff(fn, {
      maxRetries: 4,
      baseDelay: 10,
      backoffFactor: 2,
      onRetry: (_err, _att, delay) => recordedDelays.push(delay),
    });

    assert.equal(res, 'recovered');
    assert.equal(attempts, 3);
    // 1-й retry: 10 * 2^0 = 10ms
    // 2-й retry: 10 * 2^1 = 20ms
    assert.deepEqual(recordedDelays, [10, 20]);
  });

  it('должен выбросить последнюю ошибку после исчерпания всех попыток', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error(`Постоянный сбой ${attempts}`);
    };

    await assert.rejects(
      async () => await retryWithBackoff(fn, { maxRetries: 2, baseDelay: 5 }),
      /Постоянный сбой 3/
    );

    // 1 исходный вызов + 2 повтора = 3 вызова
    assert.equal(attempts, 3);
  });

  it('должен остановить повторы, если предикат shouldRetry вернул false', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      const err = new Error('Фатальная ошибка авторизации');
      err.code = 'UNAUTHORIZED';
      throw err;
    };

    await assert.rejects(
      async () =>
        await retryWithBackoff(fn, {
          maxRetries: 5,
          baseDelay: 10,
          shouldRetry: (err) => err.code !== 'UNAUTHORIZED',
        }),
      /Фатальная ошибка авторизации/
    );

    assert.equal(attempts, 1, 'Не должен повторять при фатальной ошибке');
  });

  it('должен ограничивать максимальную задержку параметром maxDelay', async () => {
    const recordedDelays = [];
    let attempts = 0;

    const fn = async () => {
      attempts++;
      if (attempts <= 3) throw new Error('fail');
      return 'ok';
    };

    await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelay: 50,
      backoffFactor: 10,
      maxDelay: 80, // ограничение
      onRetry: (_e, _a, delay) => recordedDelays.push(delay),
    });

    // 50 * 10^0 = 50ms, 50 * 10^1 = 500ms -> clamp to 80ms, 50 * 10^2 -> clamp to 80ms
    assert.deepEqual(recordedDelays, [50, 80, 80]);
  });
});
