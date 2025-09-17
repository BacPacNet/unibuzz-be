import { logger } from '../../modules/logger';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { io } from '../../index';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';
import { setTimeout as wait } from 'timers/promises';

export const handleSendDeleteCommunityGroupNotification = async (job: any) => {
  const { adminId, communityGroupId, receiverIds, type, message } = job;
  logger.info(`Processing Deletecommunity group notification for user: ${receiverIds}`);
  // 1️⃣ Create notification documents
  const notifications = receiverIds.map((receiverId: string) => ({
    sender_id: new mongoose.Types.ObjectId(adminId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
    type,
    message,
  }));

  await notificationModel.insertMany(notifications);

  // 2️⃣ Send real-time notifications in batches (avoid blocking the event loop)
  const chunkSize = 100;
  for (let i = 0; i < receiverIds.length; i += chunkSize) {
    const chunk = receiverIds.slice(i, i + chunkSize);
    chunk.forEach((userId: string) => {
      io.emit(`notification_${userId}`, { type });

      sendPushNotification(userId, 'Unibuzz', message, {
        sender_id: adminId.toString(),
        receiverId: userId.toString(),
        type: type,
      });
    });
    await wait(10);
  }
  return { _id: 'deleted', success: true };
};
