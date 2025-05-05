import { Queue } from 'bullmq';
import config from '../../config/config';
import { QueuesEnum } from '../queueEnums';

const connection = {
  host: config.bull_mq_queue.REDIS_HOST,
  port: Number(config.bull_mq_queue.REDIS_PORT),
};

export const messageQueue = new Queue(QueuesEnum.message_queue, {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 7 * 24 * 60 * 60,
    },
    removeOnFail: false,
  },
});

messageQueue.client.then((client) => {
  client.on('ready', () => {
    console.log('Message Queue connected to Redis!');
  });

  client.on('error', (err) => {
    console.error('Message Queue connection error:', err);
  });
});
