import { cacheGet, cacheSet, isReady } from '../services/redis.service.js';

/**
 * Express middleware: serves cached response if available, otherwise
 * intercepts res.json() to populate the cache for subsequent requests.
 *
 * @param {string} prefix   Cache key prefix, e.g. 'gyms' or 'marketplace'
 * @param {number} ttl      Time-to-live in seconds (default 300)
 */
export const cacheMiddleware = (prefix, ttl = 300) => {
  return async (req, res, next) => {
    if (!isReady()) return next();

    // Build a deterministic cache key from the prefix + URL (includes query params)
    const key = `cache:${prefix}:${req.originalUrl}`;

    try {
      const cached = await cacheGet(key);

      if (cached !== null) {
        // Attach header so the benchmark script / professor can see it's from cache
        res.setHeader('X-Cache', 'HIT');
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.status(200).json(data);
      }
    } catch (_err) {
      // If cache read fails, just continue to the handler
    }

    // Cache MISS — intercept res.json to store the result
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(key, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    return next();
  };
};

export default cacheMiddleware;
