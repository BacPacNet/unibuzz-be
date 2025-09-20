import { logger } from '../../modules/logger';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleUserFollowNotification = async (job: any) => {
  try {
    const { sender_id, receiverId } = job;
    logger.info(`🔄 Processing follow notification`, { sender_id, receiverId });

    if (!sender_id || !receiverId) {
      throw new Error('Missing required fields: sender_id or receiverId');
    }

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    const newNotification = {
      sender_id: senderObjectId,

      receiverId: receiverObjectId,
      type: notificationRoleAccess.FOLLOW,
      message: 'Started following you',
    };

    const notification = await notificationService.CreateNotification(newNotification);

    const res: any = await notification.populate('sender_id');

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.follow_user });

    sendPushNotification(receiverId, 'Unibuzz', ` ${res?.sender_id?.firstName} started following you`, {
      sender_id: sender_id.toString(),
      receiverId: receiverId.toString(),
      type: notificationRoleAccess.FOLLOW,
    });

    logger.info('✅ Follow notification processed successfully', { notificationId: res._id });
    return res;
  } catch (error) {
    logger.error('Error in CreateFollowNotification:', error);
    throw error;
  }
};
