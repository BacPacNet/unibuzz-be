import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import config from './config';

// Create a Redis client with authentication
const redis = new Redis({
  host: config.bull_mq_queue.REDIS_HOST,
  port: config.bull_mq_queue.REDIS_PORT,
  maxRetriesPerRequest: null,
  // Only use TLS in production, not in development
  ...(config.env === 'production' && { tls: {} }),
});

// Logging Redis connection status
redis.on('connect', () => {
  console.log('✅ Redis client connecting...');
});

redis.on('ready', () => {
  console.log('✅ Redis client connected and ready!');
});

redis.on('error', (err) => {
  console.error('❌ Redis client connection error:', err);
});

redis.on('close', () => {
  console.warn('⚠️ Redis connection closed.');
});

redis.on('end', () => {
  console.log('🛑 Redis client connection ended.');
});

// Express middleware for caching
const cacheMiddleware = (durationInSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = `cache:${req.originalUrl}`;
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Serving from cache: ${cacheKey}`);
        return res.send(JSON.parse(cachedData));
      }

      // Patch both res.send and res.json
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.send = (body: any): Response => {
        if (typeof body === 'object') {
          redis.setex(cacheKey, durationInSeconds, JSON.stringify(body));
        }
        return originalSend(body);
      };

      res.json = (body: any): Response => {
        if (typeof body === 'object') {
          redis.setex(cacheKey, durationInSeconds, JSON.stringify(body));
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('❌ Redis cache error:', error);
      next(error);
    }
  };
};

export { redis, cacheMiddleware };
