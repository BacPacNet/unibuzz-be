import { logger } from '../../modules/logger';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleCommunityAdminPostNotification = async (job: any) => {
  try {
    const { sender_id, receiverId, communityId, uuid, communityPostId } = job;
    logger.info(`🔄 Processing community admin post notification`, { sender_id, receiverId });

    if (!sender_id || !receiverId) {
      throw new Error('Missing required fields: sender_id or receiverId');
    }

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    const newNotification = {
      notificationQueueId: uuid,
      communityId,
      communityPostId,
      sender_id: senderObjectId,
      receiverId: receiverObjectId,
      type: notificationRoleAccess.COMMUNITY_ADMIN_POST,
      message: 'Community admin post',
    };

    // await notificationService.CreateNotification(newNotification);
    const notification = await notificationService.CreateNotification(newNotification);

    const res: any = await notification.populate('communityId');

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.COMMUNITY_ADMIN_POST });

    sendPushNotification(
      receiverId,
      'Unibuzz',
      ` ${res?.communityId?.name} admin has posted a new update. Be sure to check it out.`,
      {
        sender_id: sender_id.toString(),
        receiverId: receiverId.toString(),
        type: notificationRoleAccess.COMMUNITY_ADMIN_POST,
        communityPostId,
      }
    );

    // logger.info('✅ Follow notification processed successfully', { notificationId: res._id });
    return res;
  } catch (error) {
    logger.error('Error in CreateFollowNotification:', error);
    throw error;
  }
};
