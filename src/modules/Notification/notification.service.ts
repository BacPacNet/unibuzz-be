import mongoose, { PipelineStage } from 'mongoose';
import notificationModel from './notification.modal';
import { notificationRoleAccess, notificationStatus } from './notification.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';

export const createManyNotification = async (
  adminId: mongoose.Types.ObjectId,
  communityGroupId: mongoose.Types.ObjectId,
  receiverArr: Array<any>,
  type: string,
  message: string
) => {
  const receiverIds = receiverArr.map((user) => new mongoose.Types.ObjectId(user?.users_id));
  const jobData = {
    adminId: adminId.toString(),
    communityGroupId: communityGroupId.toString(),
    receiverIds: receiverIds,
    type,
    message,
  };

  await notificationQueue.add(NotificationIdentifier.group_invite_notifications, jobData);
};

export const getUserNotification = async (userID: string, page: number = 1, limit: number = 3) => {
  const skip = (page - 1) * limit;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
        isRead: false,
        $nor: [
          {
            $and: [{ type: notificationRoleAccess.GROUP_INVITE }, { isRead: true }],
          },
        ],
      },
    },
    {
      $sort: { createdAt: -1 }, // Sort by createdAt in descending order
    },
    {
      $group: {
        _id: {
          type: '$type',
          senderId: '$sender_id',
          receiverId: '$receiverId',
        },
        latestNotification: { $first: '$$ROOT' }, // Keep the latest notification in each group
      },
    },
    {
      $replaceRoot: { newRoot: '$latestNotification' }, // Replace the grouped document with the latest notification
    },
    {
      $lookup: {
        from: 'users',
        localField: 'sender_id',
        foreignField: '_id',
        as: 'senderDetails',
      },
    },
    {
      $unwind: {
        path: '$senderDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        'senderDetails.isUserDeactive': { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'sender_id',
        foreignField: 'users_id',
        as: 'userProfile',
      },
    },
    {
      $unwind: {
        path: '$userProfile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        isRead: 1,
        receiverId: 1,
        type: 1,
        message: 1,
        userPostId: 1,
        'sender_id._id': '$senderDetails._id',
        'sender_id.firstName': '$senderDetails.firstName',
        'sender_id.lastName': '$senderDetails.lastName',
        'sender_id.profileDp': '$userProfile.profile_dp.imageUrl',
      },
    },
    {
      $sort: { createdAt: -1 }, // Sort again after grouping
    },
    {
      $skip: skip, // Apply pagination
    },
    {
      $limit: limit,
    },
  ];

  // Execute the aggregation pipeline
  const userNotifications = await notificationModel.aggregate(pipeline);

  // Count total distinct notifications for pagination metadata
  const totalNotificationsPipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
        isRead: false,
      },
    },
    {
      $group: {
        _id: {
          type: '$type',
          senderId: '$sender_id',
          receiverId: '$receiverId',
        },
      },
    },
    {
      $count: 'total',
    },
  ];

  const totalNotificationsResult = await notificationModel.aggregate(totalNotificationsPipeline);
  const totalNotifications = totalNotificationsResult[0]?.total || 0;

  const totalPages = Math.ceil(totalNotifications / limit);

  return {
    notifications: userNotifications,
    currentPage: page,
    totalPages,
    totalNotifications,
  };
};

export const getUserNotificationCount = async (userID: string) => {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
        isRead: false,
      },
    },
    {
      $count: 'unreadCount',
    },
  ];

  const result = await notificationModel.aggregate(pipeline);

  // If no results, return 0
  return result[0]?.unreadCount || 0;
};

export const getUserNotificationMain = async (userID: string, page = 1, limit = 3) => {
  const skip = (page - 1) * limit;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
        // $nor: [
        //   {
        //     $and: [{ type: notificationRoleAccess.GROUP_INVITE }, { isRead: true }],
        //   },
        // ],
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          type: '$type',
          sender_id: '$sender_id',
          receiverId: '$receiverId',
          userPostId: '$userPostId',
          communityPostId: '$communityPostId',
          communityGroupId: '$communityGroupId',
        },
        latestNotification: { $first: '$$ROOT' }, // Get the latest notification (sorted by createdAt)
        createdAt: { $first: '$createdAt' }, // Keep track of the latest createdAt for the group
      },
    },
    {
      $replaceRoot: {
        newRoot: '$latestNotification', // Replace the document with the latest notification in the group
      },
    },
    {
      $sort: { createdAt: -1 }, // Sort again after deduplication
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'users',
        localField: 'sender_id',
        foreignField: '_id',
        as: 'senderDetails',
      },
    },
    {
      $unwind: {
        path: '$senderDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        'senderDetails.isUserDeactive': { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'sender_id',
        foreignField: 'users_id',
        as: 'userProfile',
      },
    },
    {
      $unwind: {
        path: '$userProfile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'communitygroups',
        localField: 'communityGroupId',
        foreignField: '_id',
        as: 'communityGroupDetails',
      },
    },
    {
      $unwind: {
        path: '$communityGroupDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'communities',
        localField: 'communityGroupDetails.communityId',
        foreignField: '_id',
        as: 'communityDetails',
      },
    },

    {
      $lookup: {
        from: 'users',
        localField: 'likedBy.newFiveUsers',
        foreignField: '_id',
        as: 'likedUsersDetails',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'likedBy.newFiveUsers',
        foreignField: 'users_id',
        as: 'likedUsersProfiles',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'commentedBy.newFiveUsers._id',
        foreignField: '_id',
        as: 'commentedUsersDetails',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commentedBy.newFiveUsers._id',
        foreignField: 'users_id',
        as: 'commentedUsersProfiles',
      },
    },

    {
      $unwind: {
        path: '$communityDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        $expr: {
          $not: {
            $and: [
              { $eq: ['$type', 'REACTED_TO_POST'] },
              { $eq: ['$likedBy.totalCount', 0] },
              {
                $or: [
                  { $eq: [{ $size: { $ifNull: ['$likedBy.newFiveUsers', []] } }, 0] },
                  { $not: ['$likedBy.newFiveUsers'] },
                ],
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        isRead: 1,
        receiverId: 1,
        type: 1,
        message: 1,
        userPostId: 1,
        communityPostId: 1,
        communityPostCommentId: 1,
        status: 1,
        'sender_id._id': '$senderDetails._id',
        'sender_id.firstName': '$senderDetails.firstName',
        'sender_id.lastName': '$senderDetails.lastName',
        'sender_id.profileDp': '$userProfile.profile_dp.imageUrl',
        'communityGroupId._id': '$communityGroupDetails._id',
        'communityGroupId.title': '$communityGroupDetails.title',
        'communityGroupId.communityGroupLogoUrl': '$communityGroupDetails.communityGroupLogoUrl.imageUrl',
        'communityGroupId.communityId': '$communityGroupDetails.communityId',
        'communityDetails.name': '$communityDetails.name',

        'likedBy.totalCount': 1,
        'likedBy.newFiveUsers': {
          $map: {
            input: '$likedBy.newFiveUsers',
            as: 'userId',
            in: {
              _id: '$$userId',
              // Get user basic details
              name: {
                $let: {
                  vars: {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$likedUsersDetails',
                            as: 'u',
                            cond: { $eq: ['$$u._id', '$$userId'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: { $concat: ['$$user.firstName', ' ', '$$user.lastName'] },
                },
              },
              // Get profile image
              profileDp: {
                $let: {
                  vars: {
                    profile: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$likedUsersProfiles',
                            as: 'p',
                            cond: { $eq: ['$$p.users_id', '$$userId'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: '$$profile.profile_dp.imageUrl',
                },
              },
            },
          },
        },
        'commentedBy.totalCount': 1,

        'commentedBy.newFiveUsers': {
          $map: {
            input: '$commentedBy.newFiveUsers',
            as: 'userEntry',
            in: {
              _id: '$$userEntry._id',
              communityPostCommentId: '$$userEntry.communityPostCommentId',
              postCommentId: '$$userEntry.postCommentId',
              name: {
                $let: {
                  vars: {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$commentedUsersDetails',
                            as: 'u',
                            cond: { $eq: ['$$u._id', '$$userEntry._id'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: { $concat: ['$$user.firstName', ' ', '$$user.lastName'] },
                },
              },
              profileDp: {
                $let: {
                  vars: {
                    profile: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$commentedUsersProfiles',
                            as: 'p',
                            cond: { $eq: ['$$p.users_id', '$$userEntry._id'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: '$$profile.profile_dp.imageUrl',
                },
              },
            },
          },
        },
      },
    },
  ];

  // Count total distinct notifications for pagination metadata
  const totalNotificationsPipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
      },
    },
    {
      $group: {
        _id: {
          type: '$type',
          senderId: '$sender_id',
          receiverId: '$receiverId',
          userPostId: '$userPostId',
          communityPostId: '$communityPostId',
          communityGroupId: '$communityGroupId',
        },
      },
    },
    {
      $count: 'total',
    },
  ];

  const totalNotificationsResult = await notificationModel.aggregate(totalNotificationsPipeline);
  const totalNotifications = totalNotificationsResult[0]?.total || 0;

  const userNotifications = await notificationModel.aggregate(pipeline);

  const totalPages = Math.ceil(totalNotifications / limit);

  return {
    notifications: userNotifications,
    currentPage: page,
    totalPages,
    totalNotifications,
  };
};

export const updateUserNotification = async (id: string, status: string = 'default') => {
  const userNotification = await notificationModel.findByIdAndUpdate(id, { isRead: true, status: status }, { new: true });

  return userNotification;
};

export const CreateNotification = async (notification: any) => {
  return await notificationModel.create(notification);
};

export const changeNotificationStatus = async (status: notificationStatus, notificationId: string) => {
  const notification = await notificationModel.findById(new mongoose.Types.ObjectId(notificationId));

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'notification not found!');
  }

  notification.status = status;
  notification.isRead = true;

  await notification.save();
};

export const DeleteNotification = async (filter: any) => {
  await notificationModel.findOneAndDelete(filter);
};

export const markNotificationsAsRead = async (userID: string) => {
  try {
    const result = await notificationModel.updateMany(
      { receiverId: new mongoose.Types.ObjectId(userID), isRead: false },
      { $set: { isRead: true } }
    );
    return result;
  } catch (error: any) {
    throw new Error(error.message);
  }
};
