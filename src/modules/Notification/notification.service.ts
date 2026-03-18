import mongoose, { PipelineStage } from 'mongoose';
import notificationModel from './notification.modal';
import { CreateNotificationPayload, notificationInterface, notificationRoleAccess, notificationStatus } from './notification.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import {
  buildReceiverMatchStage,
  buildUserNotificationTotalPipeline,
  buildUserNotificationCountPipeline,
  buildUserNotificationMainTotalPipeline,
  buildSenderAndProfileLookupStages,
  buildUserNotificationMainDetailLookupStages,
  buildUserNotificationMainProjectStage,
  buildReactedToPostWithLikesFilterStage,
  buildUserNotificationSummaryProjectStage,
  buildDedupePaginatePipeline,
} from './notification.pipelines';
import { convertToObjectId, getPaginationSkip, computeTotalPages, throwApiError } from '../../utils/common';
import { SelectedUserItem } from '../communityGroup/communityGroup.interface';






const runPaginatedAggregation = async (
  listPipeline: PipelineStage[],
  countPipeline: PipelineStage[],
  page: number,
  limit: number
) => {
  const [notifications, totalNotificationsResult] = await Promise.all([
    notificationModel.aggregate(listPipeline),
    notificationModel.aggregate(countPipeline),
  ]);

  const totalNotifications = totalNotificationsResult[0]?.total || 0;
  const totalPages = computeTotalPages(totalNotifications, limit);

  return {
    notifications,
    currentPage: page,
    totalPages,
    totalNotifications,
  };
};

export const createManyNotification = async (
  adminId: mongoose.Types.ObjectId,
  communityGroupId: mongoose.Types.ObjectId,
  receiverArr: SelectedUserItem[],
  type: string,
  message: string
) => {
  const receiverIds = receiverArr.map((user) => convertToObjectId(user.users_id.toString()));

  const jobData = {
    adminId: adminId.toString(),
    communityGroupId: communityGroupId.toString(),
    receiverIds: receiverIds,
    type,
    message,
  };


  try {
    await queueSQSNotification(jobData);
  } catch (err: unknown) {
    console.error('❌ Failed to enqueue notification', {
      error: err,
    });
  }
};

export const getUserNotification = async (userID: string, page: number = 1, limit: number = 3) => {
  const skip = getPaginationSkip(page, limit);

  const pipeline: PipelineStage[] = buildDedupePaginatePipeline({
    matchStage: buildReceiverMatchStage(userID, {
      isRead: false,
      $nor: [
        {
          $and: [{ type: notificationRoleAccess.GROUP_INVITE }, { isRead: true }],
        },
      ],
    }),
    groupId: {
      type: '$type',
      senderId: '$sender_id',
      receiverId: '$receiverId',
    },
    skip,
    limit,
    afterDedupeBeforePaginationStages: [...buildSenderAndProfileLookupStages(), buildUserNotificationSummaryProjectStage()],
  });

  // Execute the aggregation pipeline
  // Count total distinct notifications for pagination metadata
  const totalNotificationsPipeline = buildUserNotificationTotalPipeline(userID);

  return runPaginatedAggregation(pipeline, totalNotificationsPipeline, page, limit);
};

export const getUserNotificationCount = async (userID: string) => {
  const pipeline = buildUserNotificationCountPipeline(userID);

  const result = await notificationModel.aggregate(pipeline);

  return result[0]?.unreadCount || 0;
};

export const getUserNotificationMain = async (userID: string, page = 1, limit = 3) => {
  const skip = getPaginationSkip(page, limit);

  const pipeline: PipelineStage[] = buildDedupePaginatePipeline({
    matchStage: buildReceiverMatchStage(userID),
    groupId: {
      type: '$type',
      sender_id: '$sender_id',
      receiverId: '$receiverId',
      userPostId: '$userPostId',
      parentCommentId: '$parentCommentId',
      parentCommunityCommentId: '$parentCommunityCommentId',
      communityPostId: '$communityPostId',
      communityGroupId: '$communityGroupId',
    },
    groupAccumulators: {
      createdAt: { $first: '$createdAt' },
    },
    skip,
    limit,
    afterPaginationStages: [
      ...buildSenderAndProfileLookupStages(),
      ...buildUserNotificationMainDetailLookupStages(),
      buildReactedToPostWithLikesFilterStage(),
      buildUserNotificationMainProjectStage(),
    ],
  });

  // Count total distinct notifications for pagination metadata
  const totalNotificationsPipeline = buildUserNotificationMainTotalPipeline(userID);

  return runPaginatedAggregation(pipeline, totalNotificationsPipeline, page, limit);
};

export const updateUserNotification = async (id: string, status: notificationStatus = notificationStatus.default) => {
  const userNotification = await notificationModel.findByIdAndUpdate(id, { isRead: true, status: status }, { new: true });

  return userNotification;
};

export const createNotification = async (notification: CreateNotificationPayload) => {
  try {
    return await notificationModel.create(notification);
  } catch (error: unknown) {
    throwApiError(error, { messagePrefix: 'Failed to create notification' });
  }
};

export const changeNotificationStatus = async (status: notificationStatus, notificationId: string) => {
  const notification = await notificationModel.findById(convertToObjectId(notificationId));

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'notification not found!');
  }

  notification.status = status;
  notification.isRead = true;

  await notification.save();
};

export const changeNotificationStatusForCommunityAdmin = async (
  status: string,
  notificationId: string,
  adminIds: string[]
) => {
  const targetNotification = await notificationModel.findById(notificationId);
  if (!targetNotification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }

  await notificationModel.updateMany(
    {
      communityGroupId: targetNotification.communityGroupId,
      type: targetNotification.type,
      receiverId: { $in: adminIds },
    },
    {
      $set: {
        status,
        isRead: true,
      },
    }
  );

  return true;
};

export const deleteNotification = async (filter: mongoose.FilterQuery<notificationInterface>) => {
  return await notificationModel.findOneAndDelete(filter);
};

export const markNotificationsAsRead = async (userID: string) => {
  try {
    const result = await notificationModel.updateMany(
      { receiverId: convertToObjectId(userID), isRead: false },
      { $set: { isRead: true } }
    );
    return result;
  } catch (error: unknown) {
    throwApiError(error, { messagePrefix: 'Failed to mark notifications as read' });
  }
};

export const findNotificationByCommunityGroupId = async (
  communityGroupId: string,
  receiverId: string,
  sender_id: string
) => {
  return await notificationModel
    .findOne({
      communityGroupId,
      receiverId,
      sender_id,
    })
    .sort({ createdAt: -1 });
};
