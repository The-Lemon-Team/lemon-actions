/**
 * Задача 04: Deferred Promise (Отложенный промис с внешним управлением)
 * 
 * Создает объект Deferred, позволяющий явно управлять исходом промиса
 * из внешнего кода и отслеживать его состояние синхронно.
 * 
 * @template T
 * @returns {{
 *   promise: Promise<T>,
 *   resolve: (value: T | PromiseLike<T>) => void,
 *   reject: (reason?: any) => void,
 *   readonly status: 'pending' | 'resolved' | 'rejected',
 *   readonly isSettled: boolean,
 *   readonly value: T | undefined,
 *   readonly reason: any
 * }}
 */
function createDeferred() {
  let resolveFn;
  let rejectFn;
  let status = 'pending';
  let settledValue = undefined;
  let rejectionReason = undefined;

  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    promise,

    resolve(val) {
      if (status !== 'pending') return;
      status = 'resolved';
      settledValue = val;
      resolveFn(val);
    },

    reject(err) {
      if (status !== 'pending') return;
      status = 'rejected';
      rejectionReason = err;
      rejectFn(err);
    },

    get status() {
      return status;
    },

    get isSettled() {
      return status !== 'pending';
    },

    get value() {
      return settledValue;
    },

    get reason() {
      return rejectionReason;
    },
  };
}

module.exports = { createDeferred };
