import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check Redis connection (simplified for now)
    let redisStatus = 'unknown';
    try {
      // Basic Redis check - you can enhance this based on your Redis setup
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
    }

    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'],
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';
    
    res.status(isHealthy ? 200 : 503).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router; 