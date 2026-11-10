/**
 * Задача 03: Retry with Exponential Backoff
 * 
 * Повторяет выполнение асинхронной функции при ошибках с экспоненциально
 * растущей задержкой между попытками.
 * 
 * @param {() => Promise<any>} fn - Асинхронная операция для выполнения
 * @param {object} [options]
 * @param {number} [options.maxRetries=3] - Максимальное количество повторных попыток
 * @param {number} [options.baseDelay=30] - Базовая задержка в миллисекундах
 * @param {number} [options.backoffFactor=2] - Множитель экспоненты
 * @param {number} [options.maxDelay=1000] - Верхний предел задержки
 * @param {(err: any, attempt: number) => boolean} [options.shouldRetry] - Предикат повтора
 * @param {(err: any, attempt: number, delayMs: number) => void} [options.onRetry] - Колбэк перед задержкой
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 30,
    backoffFactor = 2,
    maxDelay = 1000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Если это была последняя попытка или предикат запретил повтор — выходим
      if (attempt >= maxRetries || !shouldRetry(err, attempt)) {
        throw lastError;
      }

      // Вычисляем задержку: delay = min(baseDelay * (factor ^ attempt), maxDelay)
      const delayMs = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);

      if (typeof onRetry === 'function') {
        onRetry(err, attempt + 1, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

module.exports = { retryWithBackoff };
