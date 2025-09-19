import { logger } from '../../modules/logger';
import { getUserById } from '../../modules/user/user.service';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleUserPostReplyCommentNotification = async (job: any): Promise<any> => {
  logger.info(`Processing reply comment notification for post: `);
  try {
    const { sender_id, receiverId, userPostId, postCommentId, parentCommentId } = job;
    logger.info(`Processing reply comment notification for post: ${userPostId}`);

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const postObjectId = new mongoose.Types.ObjectId(userPostId);
    const commentObjectId = new mongoose.Types.ObjectId(postCommentId);
    const parentCommentObjectId = new mongoose.Types.ObjectId(parentCommentId);
    const userData = await getUserById(senderObjectId);

    let existingNotification = await notificationModel.findOne({
      receiverId: receiverObjectId,
      userPostId: postObjectId,
      parentCommentId: parentCommentObjectId,
      type: notificationRoleAccess.REPLIED_TO_COMMENT,
    });

    const newUserEntry = {
      _id: senderObjectId,
      parentCommentId: commentObjectId,
    };

    if (existingNotification) {
      let updatedUsers = existingNotification.repliedBy?.newFiveUsers || [];
      const now = new Date();
      const index = updatedUsers.findIndex((user: any) => user._id.toString() === senderObjectId.toString());

      if (index !== -1) {
        updatedUsers.splice(index, 1);
      } else {
        if (updatedUsers.length >= 5) {
          updatedUsers.pop();
        }
        if (existingNotification.repliedBy) {
          existingNotification.repliedBy.totalCount += 1;
        }
      }
      updatedUsers.unshift(newUserEntry);

      if (existingNotification) {
        if (!existingNotification.repliedBy) {
          existingNotification.repliedBy = {
            totalCount: 0,
            newFiveUsers: [],
          };
        }
      }

      existingNotification.createdAt = now;

      await existingNotification.save();
    } else {
      const newNotification = {
        receiverId: receiverObjectId,
        userPostId: postObjectId,
        type: notificationRoleAccess.REPLIED_TO_COMMENT,
        parentCommentId: parentCommentObjectId,
        message: 'Replied to your comment.',
        repliedBy: {
          newFiveUsers: [newUserEntry],
        },
      };

      await notificationService.CreateNotification(newNotification);
    }

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.REPLIED_TO_COMMENT });

    const pushMessage =
      Number(existingNotification?.repliedBy?.totalCount) > 1
        ? `${userData?.firstName} and ${
            Number(existingNotification?.repliedBy?.totalCount) - 1
          } others replied to your comment`
        : `${userData?.firstName} replied to your comment`;

    sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
      type: notificationRoleAccess.REPLIED_TO_COMMENT,
      sender_id: sender_id.toString(),
      receiverId: receiverId.toString(),
      commentId: postCommentId.toString(),
      postId: userPostId.toString(),
    });

    return existingNotification || { _id: 'new' };
  } catch (error) {
    logger.error('Error in handleReplyCommentNotification:', error);
    throw error;
  }
};
