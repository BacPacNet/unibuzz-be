import mongoose from 'mongoose';
import notificationModel from './notification.modal';

export const createManyNotification = async (
  adminId: mongoose.Types.ObjectId,
  communityGroupId: mongoose.Types.ObjectId,
  receiverArr: Array<string>
) => {
  const receiverIds = receiverArr.map((id) => new mongoose.Types.ObjectId(id));

  const notifications = receiverIds.map((receiverId) => ({
    adminId: adminId,
    receiverId: receiverId,
    communityGroupId: communityGroupId,
  }));

  try {
    await notificationModel.create(notifications);
  } catch (error) {
    throw error;
  }
};

export const getUserNotification = async (userID: string) => {
  // console.log(userID);

  const userNotification = await notificationModel
    .find({ receiverId: new mongoose.Types.ObjectId(userID), isSeen: false })
    .populate([
      { path: 'adminId', select: 'firstName lastName _id' },
      { path: 'communityGroupId', select: 'title  _id' },
    ]);
  // console.log(userNotification);

  return userNotification;
};

export const updateUserNotification = async (id: string) => {
  // console.log(id);

  const userNotification = await notificationModel.findByIdAndUpdate(id, { isSeen: true }, { new: true });
  // console.log(userNotification);

  return userNotification;
};
