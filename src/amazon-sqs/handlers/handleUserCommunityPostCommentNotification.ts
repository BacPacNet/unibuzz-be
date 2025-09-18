import { logger } from '../../modules/logger';
import { getUserById } from '../../modules/user/user.service';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { notificationRoleAccess } from '../../modules/Notification/notification.interface';
import { notificationService } from '../../modules/Notification';
import { io } from '../../index';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';

export const handleUserCommunityPostCommentNotification = async (job: any) => {
  try {
    const { sender_id, receiverId, communityPostId, communityPostCommentId, message } = job;
    logger.info(`Processing comment notification for Community post: ${communityPostId}`);
    const senderObjectId = new mongoose.Types.ObjectId(sender_id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const postObjectId = new mongoose.Types.ObjectId(communityPostId);
    const commentObjectId = new mongoose.Types.ObjectId(communityPostCommentId);
    const userData = await getUserById(senderObjectId);

    let existingNotification = await notificationModel.findOne({
      receiverId: receiverObjectId,
      communityPostId: postObjectId,
      type: notificationRoleAccess.COMMUNITY_COMMENT,
    });

    const newUserEntry = {
      _id: senderObjectId,
      communityPostCommentId: commentObjectId,
    };

    if (existingNotification) {
      let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];
      const now = new Date();
      const index = updatedUsers.findIndex((user: any) => user._id.toString() === senderObjectId.toString());

      if (index !== -1) {
        updatedUsers.splice(index, 1);
      } else if (updatedUsers.length >= 5) {
        updatedUsers.pop();
        if (existingNotification.commentedBy) {
          existingNotification.commentedBy.totalCount += 1;
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

      existingNotification.createdAt = now;

      await existingNotification.save();
    } else {
      const newNotification = {
        receiverId: receiverObjectId,
        communityPostId: postObjectId,
        type: notificationRoleAccess.COMMUNITY_COMMENT,
        communityPostCommentId: commentObjectId,
        message: message,
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
      sender_id: sender_id.toString(),
      receiverId: receiverId.toString(),
      type: notificationRoleAccess.COMMUNITY_COMMENT,
      commentId: communityPostCommentId.toString(),
      postId: communityPostId.toString(),
    });
    return existingNotification || { _id: 'new' };
  } catch (error) {
    logger.error('Error in handleCommunityPostCommentNotification:', error);
    throw error;
  }
};
