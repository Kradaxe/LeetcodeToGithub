/**
 * Retries an async function with exponential backoff + jitter.
 * @param {Function} fn - async function to call, no args
 * @param {Object} opts
 * @param {number} opts.retries - max retry attempts (not counting first try)
 * @param {number} opts.baseDelayMs - base delay before first retry
 * @param {Function} opts.shouldRetry - (err) => boolean, decide if error is retryable
 */
async function withRetry(fn, { retries = 4, baseDelayMs = 1000, shouldRetry = () => true } = {}) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries || !shouldRetry(err)) {
        throw err; // out of retries, or error deemed non-retryable
      }

      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = exponential + jitter;

      console.warn(
        `Attempt ${attempt} failed (${err.message}). Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { withRetry };
