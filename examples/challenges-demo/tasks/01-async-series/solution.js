/**
 * Задача 01: Async Series (Последовательный пайплайн промисов)
 * 
 * Выполняет массив асинхронных функций последовательно,
 * передавая результат предыдущей функции на вход следующей.
 * 
 * @param {Array<(prevResult: any) => Promise<any> | any>} tasks - Массив асинхронных функций
 * @param {any} [initialValue] - Начальное значение для первой функции
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Сигнал отмены исполнения
 * @returns {Promise<any>} Итоговый результат последней функции
 */
async function asyncSeries(tasks, initialValue, options = {}) {
  const { signal } = options;
  let currentResult = initialValue;

  for (let i = 0; i < tasks.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('AsyncSeries aborted by signal', 'AbortError');
    }

    const task = tasks[i];
    if (typeof task !== 'function') {
      throw new TypeError(`Task at index ${i} is not a function`);
    }

    // Дожидаемся выполнения текущей задачи перед запуском следующей
    currentResult = await task(currentResult);
  }

  return currentResult;
}

module.exports = { asyncSeries };
