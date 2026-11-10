# Задача 03: Retry with Exponential Backoff

Реализовать функцию `retryWithBackoff(fn, options)`, которая оборачивает асинхронную операцию в цикл повторных попыток с экспоненциальной задержкой.

### Требования:
1. Выполняет `fn()`. При успехе немедленно возвращает результат.
2. При сбое ожидает задержку, рассчитываемую по формуле:
   $$\text{delay} = \min(\text{baseDelay} \cdot \text{backoffFactor}^{\text{attempt}}, \text{maxDelay})$$
3. Делает не более `maxRetries` повторных попыток (суммарно максимум `maxRetries + 1` вызовов `fn`).
4. Поддерживает предикат `shouldRetry(error, attempt)` для фильтрации невосстановимых ошибок (например, 401 Unauthorized / ValidationError).
5. Вызывает хук `onRetry(error, attempt, delayMs)` перед задержкой для логирования или телеметрии.
