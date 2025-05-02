import { Queue } from 'bullmq';
import config from '../../config/config';
import { QueuesEnum } from '../queueEnums';

const connection = {
  host: config.bull_mq_queue.REDIS_HOST,
  port: Number(config.bull_mq_queue.REDIS_PORT),
};

export const notificationQueue = new Queue(QueuesEnum.notification_queue, {
  connection,
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
