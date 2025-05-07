import { Worker } from 'bullmq';
import config from '../../../config/config';
import { setTimeout as wait } from 'timers/promises';
import { io } from '../../../index';
import mongoose from 'mongoose';
import { notificationModel, notificationService } from '../../../modules/Notification';
import { NotificationIdentifier } from '../NotificationEnums';
import { notificationRoleAccess } from '../../../modules/Notification/notification.interface';
import { QueuesEnum } from '../../queueEnums';
const connection = {
  host: config.bull_mq_queue.REDIS_HOST || 'localhost',
  port: Number(config.bull_mq_queue.REDIS_PORT) || 6379,
};

const handleSendNotification = async (job: any) => {
  const { adminId, communityGroupId, receiverIds, type, message } = job.data;

  const notifications = receiverIds.map((receiverId: string) => ({
    sender_id: new mongoose.Types.ObjectId(adminId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
    type,
    message,
  }));

  await notificationModel.create(notifications);

  const chunkSize = 100;
  for (let i = 0; i < receiverIds.length; i += chunkSize) {
    const chunk = receiverIds.slice(i, i + chunkSize);
    chunk.forEach((userId: string) => {
      io.emit(`notification_${userId}`, { type });
    });

    await wait(10);
  }
};

const handleLikeNotification = async (job: any) => {
  const { sender_id, receiverId, userPostId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const postObjectId = new mongoose.Types.ObjectId(userPostId);

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
};
const handleCommunityPostLikeNotification = async (job: any) => {
  const { sender_id, receiverId, communityPostId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const postObjectId = new mongoose.Types.ObjectId(communityPostId);

  let existingNotification = await notificationModel.findOne({
    receiverId: receiverObjectId,
    communityPostId: postObjectId,
    type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
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
      communityPostId: postObjectId,
      type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
      message: 'Reacted to your post.',
      likedBy: {
        totalCount: 1,
        newFiveUsers: [senderObjectId],
      },
    };

    await notificationService.CreateNotification(newNotification);
  }

  io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });
};
const handleCommentNotification = async (job: any) => {
  const { sender_id, receiverId, userPostId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const postObjectId = new mongoose.Types.ObjectId(userPostId);

  let existingNotification = await notificationModel.findOne({
    receiverId: receiverObjectId,
    userPostId: postObjectId,
    type: notificationRoleAccess.COMMENT,
  });

  if (existingNotification) {
    let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];

    const index = updatedUsers.findIndex(
      (userId: mongoose.Types.ObjectId) => userId.toString() === senderObjectId.toString()
    );

    if (index !== -1) {
      updatedUsers.splice(index, 1);
    } else {
      if (updatedUsers.length >= 5) {
        updatedUsers.pop();
      }
    }
    updatedUsers.unshift(senderObjectId);

    existingNotification.commentedBy.newFiveUsers = updatedUsers;

    existingNotification.commentedBy.totalCount += 1;

    await existingNotification.save();
  } else {
    const newNotification = {
      receiverId: receiverObjectId,
      userPostId: postObjectId,
      type: notificationRoleAccess.COMMENT,
      message: 'Commented on your post.',
      commentedBy: {
        totalCount: 1,
        newFiveUsers: [senderObjectId],
      },
    };

    await notificationService.CreateNotification(newNotification);
  }

  io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });
};
const handleCommunityPostCommentNotification = async (job: any) => {
  const { sender_id, receiverId, communityPostId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const postObjectId = new mongoose.Types.ObjectId(communityPostId);

  let existingNotification = await notificationModel.findOne({
    receiverId: receiverObjectId,
    communityPostId: postObjectId,
    type: notificationRoleAccess.COMMENT,
  });

  if (existingNotification) {
    let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];

    const index = updatedUsers.findIndex(
      (userId: mongoose.Types.ObjectId) => userId.toString() === senderObjectId.toString()
    );

    if (index !== -1) {
      updatedUsers.splice(index, 1);
    } else {
      if (updatedUsers.length >= 5) {
        updatedUsers.pop();
      }
    }
    updatedUsers.unshift(senderObjectId);

    existingNotification.commentedBy.newFiveUsers = updatedUsers;

    existingNotification.commentedBy.totalCount += 1;

    await existingNotification.save();
  } else {
    const newNotification = {
      receiverId: receiverObjectId,
      communityPostId: postObjectId,
      type: notificationRoleAccess.COMMUNITY_COMMENT,
      message: 'commented on your community post',
      commentedBy: {
        totalCount: 1,
        newFiveUsers: [senderObjectId],
      },
    };

    await notificationService.CreateNotification(newNotification);
  }

  io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });
};

const CreateFollowNotification = async (job: any) => {
  const { sender_id, receiverId } = job.data;
  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

  const newNotification = {
    sender_id: senderObjectId,

    receiverId: receiverObjectId,
    type: notificationRoleAccess.FOLLOW,
    message: 'Started following you',
  };
  await notificationService.CreateNotification(newNotification);
  io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });
};

const DeleteFollowNotification = async (job: any) => {
  const { sender_id, receiverId } = job.data;
  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

  await notificationService.DeleteNotification({
    sender_id: senderObjectId,
    receiverId: receiverObjectId,
    type: notificationRoleAccess.FOLLOW,
  });

  io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.un_follow_user });
};

const CreateOfficialGroupRequestNotification = async (job: any) => {
  const { sender_id, receiverId, communityGroupId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

  const notifications = {
    sender_id: senderObjectId,
    receiverId: receiverObjectId,
    communityGroupId: groupObjectId,
    type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST,
    message: 'User has requested an official group status',
  };

  await notificationService.CreateNotification(notifications);

  io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST });
};
const CreateRejectPrivateJoinRequestNotification = async (job: any) => {
  const { sender_id, receiverId, communityGroupId } = job.data;

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
  await notificationService.CreateNotification(notifications);

  io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST });
};
const CreateAcceptedPrivateJoinRequestNotification = async (job: any) => {
  const { sender_id, receiverId, communityGroupId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

  const notifications = {
    sender_id: senderObjectId,
    receiverId: receiverObjectId,
    communityGroupId: groupObjectId,
    type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST,
    message: 'Your Request has been Accepted',
  };
  await notificationService.CreateNotification(notifications);

  io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST });
};
const CreateAcceptedOfficialGroupRequestNotification = async (job: any) => {
  const { sender_id, receiverId, communityGroupId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

  const notifications = {
    sender_id: senderObjectId,
    receiverId: receiverObjectId,
    communityGroupId: groupObjectId,
    type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST,
    message: 'Your Request has been Accepted',
  };
  await notificationService.CreateNotification(notifications);

  io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST });
};
const CreateRejectedOfficialGroupRequestNotification = async (job: any) => {
  const { sender_id, receiverId, communityGroupId } = job.data;

  const senderObjectId = new mongoose.Types.ObjectId(sender_id);
  const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
  const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

  const notifications = {
    sender_id: senderObjectId,
    receiverId: receiverObjectId,
    communityGroupId: groupObjectId,
    type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST,
    message: 'Your Request has been Rejected',
  };
  await notificationService.CreateNotification(notifications);

  io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST });
};

export const notificationWorker = new Worker(
  QueuesEnum.notification_queue,
  async (job) => {
    switch (job.name) {
      case NotificationIdentifier.send_notification:
        await handleSendNotification(job);
        break;

      case NotificationIdentifier.like_notification:
        await handleLikeNotification(job);
        break;
      case NotificationIdentifier.community_post_like_notification:
        await handleCommunityPostLikeNotification(job);
        break;
      case NotificationIdentifier.comment_notification:
        await handleCommentNotification(job);
        break;
      case NotificationIdentifier.community_post_comment_notification:
        await handleCommunityPostCommentNotification(job);
        break;
      case NotificationIdentifier.follow_user:
        await CreateFollowNotification(job);
        break;
      case NotificationIdentifier.un_follow_user:
        await DeleteFollowNotification(job);
        break;
      case NotificationIdentifier.official_group_request:
        await CreateOfficialGroupRequestNotification(job);
        break;
      case NotificationIdentifier.reject_private_join_group_request:
        await CreateRejectPrivateJoinRequestNotification(job);
        break;
      case NotificationIdentifier.accept_private_join_group_request:
        await CreateAcceptedPrivateJoinRequestNotification(job);
        break;
      case NotificationIdentifier.reject_official_group_request:
        await CreateRejectedOfficialGroupRequestNotification(job);
        break;
      case NotificationIdentifier.accept_official_group_request:
        await CreateAcceptedOfficialGroupRequestNotification(job);
        break;
      case NotificationIdentifier.group_invite_notifications:
        await handleSendNotification(job);
        break;

      default:
        console.warn(`Unknown job name: ${job.name}`);
    }
  },
  { connection }
);

notificationWorker.on('ready', () => {
  console.log('Notification Worker ready!');
});

notificationWorker.on('failed', (_, err) => {
  console.error('Notification job failed:', err);
});
