const defaultSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

/**
 * Call `fn` until it resolves, retrying on failure.
 * Delay before retry n (1-based) is min(maxDelay, minDelay * factor^(n-1)), jittered by +/- `jitter`.
 * @template T
 * @param {(attempt: number) => Promise<T> | T} fn
 * @param {object} [options]
 * @param {number} [options.retries=3] retries after the first attempt
 * @param {number} [options.minDelay=100]
 * @param {number} [options.maxDelay=30000]
 * @param {number} [options.factor=2]
 * @param {number} [options.jitter=0.1]
 * @param {(error: unknown, attempt: number) => boolean} [options.shouldRetry]
 * @param {(error: unknown, attempt: number, delay: number) => void} [options.onRetry]
 * @param {AbortSignal} [options.signal]
 * @param {(ms: number, signal?: AbortSignal) => Promise<void>} [options.sleep]
 * @returns {Promise<T>}
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    minDelay = 100,
    maxDelay = 30_000,
    factor = 2,
    jitter = 0.1,
    shouldRetry = () => true,
    onRetry = () => {},
    signal,
    sleep = defaultSleep,
  } = options;

  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt > retries || !shouldRetry(error, attempt)) throw error;
      const base = Math.min(maxDelay, minDelay * factor ** (attempt - 1));
      const delay = Math.round(base * (1 + (Math.random() * 2 - 1) * jitter));
      onRetry(error, attempt, delay);
      await sleep(delay, signal);
    }
  }
}
