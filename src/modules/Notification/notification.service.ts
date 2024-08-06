import mongoose from 'mongoose';
import notificationModel from './notification.modal';
import { io } from '../../index';

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

export const getUserNotification = async (userID: string) => {
  const userNotification = await notificationModel
    .find({ receiverId: new mongoose.Types.ObjectId(userID), isRead: false })
    .populate([
      { path: 'sender_id', select: 'firstName lastName _id' },
      { path: 'communityGroupId', select: 'title  _id' },
      { path: 'communityPostId', select: ' _id' },
    ])
    .sort({ createdAt: -1 });

  return userNotification;
};

export const updateUserNotification = async (id: string) => {
  const userNotification = await notificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true });

  return userNotification;
};

export const CreateNotification = async (notification: any) => {
  return await notificationModel.create(notification);
};
