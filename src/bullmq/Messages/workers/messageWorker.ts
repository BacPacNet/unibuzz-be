import { Worker, Job } from 'bullmq';
import { Server } from 'socket.io';
import config from '../../../config/config';
import { QueuesEnum } from '../../queueEnums';
import { MessageIdentifier } from '../messageEnums';
import { SocketMessageEnums } from '../../../sockets/socketEnum';

const connection = {
  host: config.bull_mq_queue.REDIS_HOST,
  port: Number(config.bull_mq_queue.REDIS_PORT),
};

//func
export const handleProcessNewMessage = async (job: Job, io: Server) => {
  const { newMessageReceived } = job.data;
  const chat = newMessageReceived.chat;

  if (!chat.users) {
    console.log('chat.users not defined');
    return;
  }

  chat.users.forEach((user: any) => {
    if (user.userId.toString() === newMessageReceived.sender.id) {
      return;
    }

    const room = io.sockets.adapter.rooms.get(user.userId.toString());

    if (room) {
      io.to(user.userId.toString()).emit(SocketMessageEnums.SEND_MESSAGE, newMessageReceived);
      io.emit(`message_notification_${user.userId}`);
    } else {
      console.log(`User ${user.userId} is not in the room, cannot send message`);
    }
  });
};

//   worker
export const createMessageWorker = (io: Server) => {
  const messageWorker = new Worker(
    QueuesEnum.message_queue,
    async (job: Job) => {
      switch (job.name) {
        case MessageIdentifier.process_new_message:
          await handleProcessNewMessage(job, io);
          break;

        default:
          console.warn(`Unknown job name: ${job.name}`);
      }
    },
    { connection }
  );

  messageWorker.on('completed', (job) => {
    console.log(`Processed job ${job.id}`);
  });

  messageWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed`, err);
  });

  return messageWorker;
};
