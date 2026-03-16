/**
 * Rate limiter middleware
 * Limits requests per user per minute to prevent abuse
 */

const LIMIT_PER_MINUTE = 100; // 100 requests per minute per user
const WINDOW_MS = 60000; // 1 minute in milliseconds

class RateLimiter {
  constructor() {
    this.userLimits = new Map();
  }

  /**
   * Middleware function
   */
  middleware() {
    return (req, res, next) => {
      const userId = req.user && req.user.id ? req.user.id : 'anonymous';

      // Get or create user limit entry
      let userEntry = this.userLimits.get(userId);

      // Reset if window expired
      if (!userEntry || Date.now() > userEntry.resetAt) {
        userEntry = {
          count: 0,
          resetAt: Date.now() + WINDOW_MS,
        };
      }

      userEntry.count++;
      this.userLimits.set(userId, userEntry);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', LIMIT_PER_MINUTE);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT_PER_MINUTE - userEntry.count));
      res.setHeader('X-RateLimit-Reset', new Date(userEntry.resetAt).toISOString());

      // Check if limit exceeded
      if (userEntry.count > LIMIT_PER_MINUTE) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Maximum ${LIMIT_PER_MINUTE} requests per minute allowed.`,
          retryAfter: Math.ceil((userEntry.resetAt - Date.now()) / 1000),
        });
      }

      next();
    };
  }

  /**
   * Get stats for a user
   */
  getStats(userId) {
    const entry = this.userLimits.get(userId);
    if (!entry) return null;

    return {
      userId,
      count: entry.count,
      limit: LIMIT_PER_MINUTE,
      remaining: Math.max(0, LIMIT_PER_MINUTE - entry.count),
      resetAt: new Date(entry.resetAt).toISOString(),
    };
  }

  /**
   * Reset limiter
   */
  reset() {
    this.userLimits.clear();
  }
}

module.exports = new RateLimiter();
