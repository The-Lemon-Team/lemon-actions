const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createDeferred } = require('./solution');

describe('Task 04: Deferred Promise', () => {
  it('должен инициализироваться в состоянии pending', () => {
    const deferred = createDeferred();
    assert.equal(deferred.status, 'pending');
    assert.equal(deferred.isSettled, false);
    assert.equal(deferred.value, undefined);
    assert.equal(deferred.reason, undefined);
  });

  it('должен успешно разрешаться через метод resolve()', async () => {
    const deferred = createDeferred();
    let resolvedValue;

    deferred.promise.then((val) => {
      resolvedValue = val;
    });

    deferred.resolve(42);

    const result = await deferred.promise;
    assert.equal(result, 42);
    assert.equal(resolvedValue, 42);
    assert.equal(deferred.status, 'resolved');
    assert.equal(deferred.isSettled, true);
    assert.equal(deferred.value, 42);
  });

  it('должен отклоняться через метод reject()', async () => {
    const deferred = createDeferred();
    const error = new Error('Deferred error');

    deferred.reject(error);

    await assert.rejects(async () => await deferred.promise, /Deferred error/);
    assert.equal(deferred.status, 'rejected');
    assert.equal(deferred.isSettled, true);
    assert.equal(deferred.reason, error);
  });

  it('должен быть идемпотентным: повторные вызовы resolve/reject игнорируются', async () => {
    const deferred = createDeferred();

    deferred.resolve('first');
    deferred.resolve('second'); // должен игнорироваться
    deferred.reject(new Error('late error')); // должен игнорироваться

    const val = await deferred.promise;
    assert.equal(val, 'first');
    assert.equal(deferred.status, 'resolved');
    assert.equal(deferred.value, 'first');
    assert.equal(deferred.reason, undefined);
  });
});
