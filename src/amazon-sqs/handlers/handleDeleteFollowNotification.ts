import { logger } from '../../modules/logger';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';

export const handleDeleteFollowNotification = async (job: any) => {
  try {
    const { sender_id, receiverId } = job;
    logger.info(`Processing Deletefollow notification for user: ${receiverId}`);
    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    const deletedNotification = await notificationService.DeleteNotification({
      sender_id: senderObjectId,
      receiverId: receiverObjectId,
      type: notificationRoleAccess.FOLLOW,
    });

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.un_follow_user });
    console.log('deletedNotification', deletedNotification);

    return deletedNotification || { _id: 'deleted', success: true };
  } catch (error) {
    logger.error('Error in DeleteFollowNotification:', error);
    throw error;
  }
};
