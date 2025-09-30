import { logger } from '../../modules/logger';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleRejectPrivateJoinRequestNotification = async (job: any) => {
  try {
    const { sender_id, receiverId, communityGroupId } = job;
    logger.info(`Processing Reject private join request notification for communityGroup: ${communityGroupId}`);

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

    const notifications = {
      sender_id: senderObjectId,
      receiverId: receiverObjectId,
      communityGroupId: groupObjectId,
      type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
      message: 'Your Request has been Rejected',
    };
    const notification = await notificationService.CreateNotification(notifications);
    const res: any = await notification.populate('communityGroupId');

    io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST });

    sendPushNotification(
      receiverId,
      'Unibuzz',
      'Your Request to join ' + res?.communityGroupId?.title + ' has been Rejected',
      {
        sender_id: sender_id.toString(),
        receiverId: receiverId.toString(),
        communityGroupId: communityGroupId,
        communityId: res?.communityGroupId?.communityId._id.toString(),
        type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
      }
    );
    return res;
  } catch (error) {
    logger.error('Error in CreateRejectPrivateJoinRequestNotification:', error);
    throw error;
  }
};
