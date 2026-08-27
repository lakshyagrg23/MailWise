/**
 * Asynchronously processes an array of items with a strict concurrency limit
 * using a sliding-window pool (Node.js event loop friendly, zero dependencies).
 *
 * As soon as any in-flight task finishes, the next item begins immediately.
 * All promises are wrapped so that a single failure never aborts other running tasks.
 *
 * @template T, R
 * @param {number} concurrencyLimit - Maximum simultaneous active promises (e.g. 10 for Gmail, 2 for Gemini).
 * @param {T[]} items - Array of items to process.
 * @param {(item: T, index: number) => Promise<R>} asyncFn - Async function returning a promise for each item.
 * @returns {Promise<PromiseSettledResult<R>[]>} Array of PromiseSettledResult objects ({ status: 'fulfilled'|'rejected', value/reason }).
 */
export async function asyncPool(concurrencyLimit, items, asyncFn) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const limit = Math.max(1, concurrencyLimit || 1);
    const results = [];
    const executing = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // Wrap execution in a promise to capture both sync and async results
        const promise = Promise.resolve().then(() => asyncFn(item, i));
        results.push(promise);

        // Tracker promise for sliding-window concurrency.
        // Catches errors so Promise.race(executing) never rejects prematurely.
        let tracker;
        tracker = promise
            .catch(() => {})
            .then(() => executing.delete(tracker));

        executing.add(tracker);

        // If the pool is full, wait for the fastest active promise to finish
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.allSettled(results);
}

/**
 * Convenience wrapper around asyncPool that returns only successfully fulfilled values
 * while optionally calling an onError callback for any failed items.
 *
 * @template T, R
 * @param {number} concurrencyLimit
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} asyncFn
 * @param {(error: any, item: T, index: number) => void} [onError]
 * @returns {Promise<R[]>} Array of successfully fulfilled values
 */
export async function asyncPoolValues(concurrencyLimit, items, asyncFn, onError) {
    const settled = await asyncPool(concurrencyLimit, items, asyncFn);
    const fulfilledValues = [];

    settled.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value !== null && result.value !== undefined) {
            fulfilledValues.push(result.value);
        } else if (result.status === 'rejected') {
            if (onError) {
                onError(result.reason, items[idx], idx);
            } else {
                console.error(`[asyncPool] Task at index ${idx} failed:`, result.reason?.message || result.reason);
            }
        }
    });

    return fulfilledValues;
}

export default asyncPool;
