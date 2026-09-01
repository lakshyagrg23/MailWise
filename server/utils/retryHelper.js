/**
 * Generic Exponential Backoff & Retry Utility.
 * Provides resilient execution for API calls (Gemini, Gmail, PostgreSQL)
 * with exponential backoff, jitter, and selective error classification.
 */

/**
 * Determines whether an error is transient and safe to retry.
 *
 * @param {Error|any} error
 * @returns {boolean}
 */
export function isTransientError(error) {
    if (!error) return false;

    const status = error.status || error.statusCode || error.response?.status;
    const msg = (error.message || '').toLowerCase();
    const code = (error.code || '').toLowerCase();

    // 1. HTTP 429 (Rate Limit / Quota) and 5xx (Server Errors)
    if (status === 429 || (status >= 500 && status <= 599)) {
        return true;
    }

    // 2. Common transient error keywords & Gemini status strings
    if (
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('service unavailable') ||
        msg.includes('bad gateway') ||
        msg.includes('gateway timeout') ||
        msg.includes('overloaded') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('econnrefused') ||
        msg.includes('socket hang up') ||
        msg.includes('network') ||
        code === 'econnreset' ||
        code === 'etimedout' ||
        code === 'econnrefused'
    ) {
        return true;
    }

    // 3. Non-retryable errors (Client bad request, auth failures, prompt safety blocks)
    return false;
}

/**
 * Executes an async function with exponential backoff and jitter for retryable errors.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn - Async function to execute
 * @param {Object} [options]
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelayMs=1000] - Base delay in milliseconds
 * @param {number} [options.factor=2] - Exponential growth factor
 * @param {number} [options.maxDelayMs=8000] - Cap on maximum delay
 * @param {(err: any) => boolean} [options.isRetryable=isTransientError] - Custom retry filter
 * @param {string} [options.context="Operation"] - Logging context label
 * @returns {Promise<T>}
 */
export async function executeWithRetry(fn, {
    maxRetries = 3,
    baseDelayMs = 1000,
    factor = 2,
    maxDelayMs = 8000,
    isRetryable = isTransientError,
    context = "Operation"
} = {}) {
    let attempt = 0;

    while (true) {
        try {
            return await fn(attempt);
        } catch (error) {
            attempt++;

            const canRetry = attempt <= maxRetries && isRetryable(error);

            if (!canRetry) {
                if (attempt > maxRetries) {
                    console.error(`[RetryHelper] [${context}] Exhausted all ${maxRetries} retry attempts. Final error:`, error.message);
                } else {
                    console.warn(`[RetryHelper] [${context}] Non-retryable error encountered:`, error.message);
                }
                throw error;
            }

            // Calculate delay: baseDelay * (factor ^ (attempt - 1)) with ±20% jitter
            const rawDelay = baseDelayMs * Math.pow(factor, attempt - 1);
            const cappedDelay = Math.min(rawDelay, maxDelayMs);
            const jitter = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x jitter
            const finalDelayMs = Math.round(cappedDelay * jitter);

            console.warn(`[RetryHelper] [${context}] Attempt ${attempt} failed (${error.message}). Retrying in ${finalDelayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, finalDelayMs));
        }
    }
}
