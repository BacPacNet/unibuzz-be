import { logger } from '../../modules/logger';
import { getUserById } from '../../modules/user/user.service';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleUserPostLikeNotification = async (job: any) => {
  try {
    const { sender_id, receiverId, userPostId } = job;
    logger.info(`Processing like notification for post: ${userPostId}`);

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const postObjectId = new mongoose.Types.ObjectId(userPostId);
    const userData = await getUserById(senderObjectId);

    let existingNotification = await notificationModel.findOne({
      receiverId: receiverObjectId,
      userPostId: postObjectId,
      type: notificationRoleAccess.REACTED_TO_POST,
    });

    if (existingNotification) {
      let updatedUsers = existingNotification.likedBy?.newFiveUsers || [];

      const index = updatedUsers.findIndex(
        (userId: mongoose.Types.ObjectId) => userId.toString() === senderObjectId.toString()
      );

      if (index !== -1) {
        updatedUsers.splice(index, 1);
      } else {
        if (updatedUsers.length >= 5) {
          updatedUsers.pop();
        }

        updatedUsers.unshift(senderObjectId);
      }

      existingNotification.likedBy.newFiveUsers = updatedUsers;

      existingNotification.likedBy.totalCount = updatedUsers.length;

      await existingNotification.save();
    } else {
      const newNotification = {
        receiverId: receiverObjectId,
        userPostId: postObjectId,
        type: notificationRoleAccess.REACTED_TO_POST,
        message: 'Reacted to your post.',
        likedBy: {
          totalCount: 1,
          newFiveUsers: [senderObjectId],
        },
      };

      await notificationService.CreateNotification(newNotification);
    }

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

    const pushMessage =
      Number(existingNotification?.likedBy?.totalCount) > 1
        ? `${userData?.firstName} and ${Number(existingNotification?.likedBy?.totalCount) - 1} others liked your post`
        : `${userData?.firstName} liked your post`;
    sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
      sender_id: sender_id.toString(),
      receiverId: receiverId.toString(),
      type: notificationRoleAccess.REACTED_TO_POST,
      postId: userPostId.toString(),
    });

    logger.info('Like notification processed successfully');
  } catch (error) {
    logger.error('Error in handleLikeNotification:', error);
    throw error;
  }
};
