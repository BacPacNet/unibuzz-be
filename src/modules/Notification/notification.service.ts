import mongoose from 'mongoose';
import notificationModel from './notification.modal';
import { io } from '../../index';
import { UserProfile } from '../userProfile';

export const createManyNotification = async (
  adminId: mongoose.Types.ObjectId,
  communityGroupId: mongoose.Types.ObjectId,
  receiverArr: Array<string>,
  type: String,
  message: string
) => {
  const receiverIds = receiverArr.map((id) => new mongoose.Types.ObjectId(id));

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

export const updateUserNotification = async (id: string) => {
  const userNotification = await notificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true });

  return userNotification;
};

export const CreateNotification = async (notification: any) => {
  return await notificationModel.create(notification);
};
