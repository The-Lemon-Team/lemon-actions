/**
 * Задача 02: Promise Pool (Лимитированный параллелизм промисов)
 * 
 * Выполняет массив асинхронных задач-фабрик с ограничением
 * на максимальное количество одновременно работающих промисов.
 * 
 * @param {Array<() => Promise<any>>} factories - Массив фабрик задач
 * @param {number} concurrency - Максимальное количество одновременных задач
 * @returns {Promise<Array<any>>} Массив результатов в исходном порядке
 */
async function promisePool(factories, concurrency = 2) {
  if (!Array.isArray(factories)) {
    throw new TypeError('Factories must be an array');
  }

  if (concurrency < 1) {
    throw new RangeError('Concurrency must be at least 1');
  }

  if (factories.length === 0) {
    return [];
  }

  const results = new Array(factories.length);
  let nextIndex = 0;
  let hasError = false;
  let firstError = null;

  // Функция-воркер: берет следующую задачу из очереди
  async function worker() {
    while (nextIndex < factories.length && !hasError) {
      const currentIndex = nextIndex++;
      const factory = factories[currentIndex];

      try {
        const result = await factory();
        results[currentIndex] = result;
      } catch (err) {
        hasError = true;
        firstError = err;
        throw err;
      }
    }
  }

  // Запускаем не более N воркеров одновременно
  const workerCount = Math.min(concurrency, factories.length);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);

  if (hasError) {
    throw firstError;
  }

  return results;
}

module.exports = { promisePool };
