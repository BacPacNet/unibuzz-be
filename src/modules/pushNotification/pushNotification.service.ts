import httpStatus from 'http-status';
import { ApiError } from '../errors';
import pushNotificationModal from './pushNotification.modal';
import admin from './firebaseInitialize';

export const createPushNotification = async (userId: string, token: string) => {
  let pushNotification = await pushNotificationModal.findOne({ user_Id: userId });

  if (!pushNotification) {
    pushNotification = await pushNotificationModal.create({
      user_Id: userId,
      token,
    });
  } else {
    pushNotification.token = token;
    await pushNotification.save();
  }

  return pushNotification;
};

export const sendPushNotification = async (userId: string, title: string, body: string) => {
  const pushNotification = await pushNotificationModal.findOne({ user_Id: userId });

  if (!pushNotification) throw new ApiError(httpStatus.NOT_FOUND, 'notification not found!');



  const message = {
    notification: {
      title: title || 'Notification',
      body: body || 'You have a new message',
    },
    token: pushNotification.token,
  };

  const response = await admin.messaging().send(message);
  return response;
};
