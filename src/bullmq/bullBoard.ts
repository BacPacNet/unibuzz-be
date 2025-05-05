import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { notificationQueue } from './Notification/notificationQueue';
import { messageQueue } from '././Messages/messageQueue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(notificationQueue), new BullMQAdapter(messageQueue)],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
