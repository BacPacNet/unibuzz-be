import { Queue } from 'bullmq';
import config from '../../config/config';
import { QueuesEnum } from '../queueEnums';

export const redisConnection = {
  host: config.bull_mq_queue.REDIS_HOST,
  port: Number(config.bull_mq_queue.REDIS_PORT),
  // Only use TLS in production, not in development
  ...(config.env === 'production' && { tls: {} }),
};

export const notificationQueue = new Queue(QueuesEnum.notification_queue, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 30 * 24 * 60 * 60,
    },
    removeOnFail: false,
  },
});

notificationQueue.client.then((client) => {
  client.on('ready', () => {
    console.log('Notification Queue connected to Redis!');
  });

  client.on('error', (err) => {
    console.error('Notification Queue connection error:', err);
  });
});
