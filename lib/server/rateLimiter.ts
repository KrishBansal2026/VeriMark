/**
 * VeriMark In-Memory Rate Limiter for Authentication & Security-Critical Operations
 * Provides sliding-window request throttling with retry-after calculation.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Checks whether an action identified by key exceeds the maximum attempts within windowMs.
 * @param key Unique identifier (e.g. `login:ip:email` or `admin_reset:adminId:targetId`)
 * @param maxAttempts Maximum permitted attempts within the window (default: 5)
 * @param windowMs Window duration in milliseconds (default: 60,000 ms / 1 minute)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Resets the in-memory rate limiter store. Used exclusively for automated test suites.
 */
export function resetRateLimiterForTesting(): void {
  rateLimitStore.clear();
}
