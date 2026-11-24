// ==============================================================================
// VERIMARK – Production Sliding-Window Rate Limiter
// ==============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp in ms
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks and increments rate limit for a given key.
 * @param key Unique identifier (e.g. `login:ip:email`)
 * @param maxAttempts Max allowed attempts within the window (default: 10)
 * @param windowSeconds Window length in seconds (default: 900s = 15 minutes)
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowSeconds = 900
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // New or expired window
    memoryStore.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetInSeconds: windowSeconds,
    };
  }

  // Active window
  entry.count += 1;
  const remaining = Math.max(0, maxAttempts - entry.count);
  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

  if (entry.count > maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  return {
    allowed: true,
    remaining,
    resetInSeconds,
  };
}

/**
 * Resets the rate limit counter for a key upon successful action (e.g. successful login).
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}

/**
 * Resets all rate limit tracking for unit test environments.
 */
export function resetRateLimiterForTesting(): void {
  memoryStore.clear();
}
