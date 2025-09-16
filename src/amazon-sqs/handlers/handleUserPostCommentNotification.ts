import { logger } from '../../modules/logger';
import { getUserById } from '../../modules/user/user.service';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleUserPostCommentNotification = async (job: any) => {
  try {
    const { sender_id, receiverId, userPostId, postCommentId } = job;
    logger.info(`Processing comment notification for post: ${userPostId}`);

    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const postObjectId = new mongoose.Types.ObjectId(userPostId);
    const commentObjectId = new mongoose.Types.ObjectId(postCommentId);
    const userData = await getUserById(senderObjectId);

    let existingNotification = await notificationModel.findOne({
      receiverId: receiverObjectId,
      userPostId: postObjectId,
      type: notificationRoleAccess.COMMENT,
    });

    const newUserEntry = {
      _id: senderObjectId,
      postCommentId: commentObjectId,
    };

    if (existingNotification) {
      let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];

      const index = updatedUsers.findIndex((user: any) => user._id.toString() === senderObjectId.toString());

      if (index !== -1) {
        updatedUsers.splice(index, 1);
      } else {
        if (updatedUsers.length >= 5) {
          updatedUsers.pop();
        }
      }
      updatedUsers.unshift(newUserEntry);

      if (existingNotification) {
        if (!existingNotification.commentedBy) {
          existingNotification.commentedBy = {
            totalCount: 0,
            newFiveUsers: [],
          };
        }
      }

      await existingNotification.save();
    } else {
      const newNotification = {
        receiverId: receiverObjectId,
        userPostId: postObjectId,
        type: notificationRoleAccess.COMMENT,
        message: 'Commented on your post.',
        commentedBy: {
          totalCount: 1,
          newFiveUsers: [newUserEntry],
        },
      };

      await notificationService.CreateNotification(newNotification);
    }

    io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

    const pushMessage =
      Number(existingNotification?.commentedBy?.totalCount) > 1
        ? `${userData?.firstName} and ${
            Number(existingNotification?.commentedBy?.totalCount) - 1
          } others commented on your post`
        : `${userData?.firstName} commented on your post`;

    sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
      type: notificationRoleAccess.COMMENT,
      sender_id: sender_id.toString(),
      receiverId: receiverId.toString(),
      commentId: postCommentId.toString(),
      postId: userPostId.toString(),
    });
    //   }
  } catch (error) {
    logger.error('Error in handleCommentNotification:', error);
    throw error;
  }
};
