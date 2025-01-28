import mongoose, { PipelineStage } from 'mongoose';
import notificationModel from './notification.modal';
import { io } from '../../index';
import { UserProfile } from '../userProfile';
import { notificationRoleAccess } from './notification.interface';

export const createManyNotification = async (
  adminId: mongoose.Types.ObjectId,
  communityGroupId: mongoose.Types.ObjectId,
  receiverArr: Array<any>,
  type: String,
  message: string
) => {
  const receiverIds = receiverArr.map((user) => new mongoose.Types.ObjectId(user?.id));
  const notifications = receiverIds.map((receiverId) => ({
    sender_id: adminId,
    receiverId: receiverId,
    communityGroupId: communityGroupId,
    type,
    message,
  }));

  try {
    await notificationModel.create(notifications);
    receiverIds.forEach((userId) => {
      io.emit(`notification_${userId}`, { type: type });
    });
  } catch (error) {
    throw error;
  }
};

export const getUserNotification = async (userID: string, page: number = 1, limit: number = 3) => {
  const skip = (page - 1) * limit;

  const userNotification = await notificationModel
    .find({ receiverId: new mongoose.Types.ObjectId(userID), isRead: false })
    .populate([
      { path: 'sender_id', select: 'firstName lastName _id' },
      { path: 'communityGroupId', select: 'title _id' },
      { path: 'communityPostId', select: '_id' },
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const userIDs = userNotification.map((item) => item.sender_id._id.toString());
  const uniqueUserIDs = [...new Set(userIDs)];
  const userProfiles = await UserProfile.find({ users_id: { $in: uniqueUserIDs } })
    .select('profile_dp users_id')
    .lean();

  const userNotificationWithDp = userNotification.map((item) => {
    const userProfile = userProfiles.find((profile) => profile.users_id.toString() === item.sender_id._id.toString());

    const profileDp = userProfile?.profile_dp?.imageUrl ?? '';

    return {
      ...item,
      sender_id: {
        ...item.sender_id,
        profileDp,
      },
    };
  });

  const totalNotifications = await notificationModel.countDocuments({
    receiverId: new mongoose.Types.ObjectId(userID),
    isRead: false,
  });

  const totalPages = Math.ceil(totalNotifications / limit);

  return {
    notifications: userNotificationWithDp,
    currentPage: page,
    totalPages,
    totalNotifications,
  };
};

export const getUserNotificationMain = async (userID: string, page = 1, limit = 3) => {
  const skip = (page - 1) * limit;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        receiverId: new mongoose.Types.ObjectId(userID),
        $nor: [
          {
            $and: [{ type: notificationRoleAccess.GROUP_INVITE }, { isRead: true }],
          },
        ],
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
      $unwind: {
        path: '$communityDetails',
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
        communityPostId: 1,
        'sender_id._id': '$senderDetails._id',
        'sender_id.firstName': '$senderDetails.firstName',
        'sender_id.lastName': '$senderDetails.lastName',
        'sender_id.profileDp': '$userProfile.profile_dp.imageUrl',
        'communityGroupId._id': '$communityGroupDetails._id',
        'communityGroupId.title': '$communityGroupDetails.title',
        'communityGroupId.communityGroupLogoUrl': '$communityGroupDetails.communityGroupLogoUrl.imageUrl',
        'communityGroupId.communityId': '$communityGroupDetails.communityId',
        'communityDetails.name': '$communityDetails.name',
      },
    },
  ];

  const userNotifications = await notificationModel.aggregate(pipeline);

  const totalNotifications = await notificationModel.countDocuments({
    receiverId: new mongoose.Types.ObjectId(userID),
    isRead: false,
    $nor: [
      {
        $and: [{ type: notificationRoleAccess.GROUP_INVITE }, { isRead: true }],
      },
    ],
  });

  const totalPages = Math.ceil(totalNotifications / limit);

  return {
    notifications: userNotifications,
    currentPage: page,
    totalPages,
    totalNotifications,
  };
};

export const updateUserNotification = async (id: string) => {
  const userNotification = await notificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true });

  return userNotification;
};

export const CreateNotification = async (notification: any) => {
  return await notificationModel.create(notification);
};
