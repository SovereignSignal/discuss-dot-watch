/**
 * Fetch with exponential backoff retry and rate limiting
 */

import { apiRateLimiter } from './rateLimiter';

interface FetchWithRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  signal?: AbortSignal;
  useRateLimiter?: boolean;
}

interface RetryResult<T> {
  data: T;
  retryCount: number;
}

export async function fetchWithRetry<T>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<RetryResult<T>> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, signal, useRateLimiter = true } = options;

  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check if aborted before attempting
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Wait for rate limiter if enabled
      if (useRateLimiter) {
        await apiRateLimiter.waitForToken();
      }

      // Check again after waiting
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const response = await fetch(url, { signal });
      const data = await response.json();

      // Check for error response from API
      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return { data, retryCount };
    } catch (err) {
      // Don't retry abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      lastError = err instanceof Error ? err : new Error('Unknown error');

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry certain errors that won't succeed on retry
      const errorMsg = lastError.message.toLowerCase();
      if (
        errorMsg.includes('shut down') ||
        errorMsg.includes('redirects') ||
        errorMsg.includes('not json') ||
        errorMsg.includes('404') ||
        errorMsg.includes('403') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('429')
      ) {
        break;
      }

      retryCount++;

      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);

      // Wait before retrying
      await new Promise((resolve) => {
        const timeoutId = setTimeout(resolve, delay);
        // Cancel timeout if aborted
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            resolve(undefined);
          }, { once: true });
        }
      });

      // Check if aborted during wait
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}
