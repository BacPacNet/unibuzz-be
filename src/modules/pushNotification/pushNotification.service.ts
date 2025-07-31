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
export const deletePushNotification = async (userId: string) => {
  return await pushNotificationModal.findOneAndDelete({ user_Id: userId });
};

export const sendPushNotification = async (userId: string, title: string, body: string, data: any = {}) => {
  const pushNotification = await pushNotificationModal.findOne({ user_Id: userId });

  if (!pushNotification) return;

  const message = {
    notification: {
      title: title || 'Notification',
      body: body || 'You have a new message',
    },
    data,
    token: pushNotification.token,
  };

  const response = await admin.messaging().send(message);
  return response;
};

export const sendMessagePushNotification = async (userId: string, title: string, body: string, data: any = {}) => {
  const pushNotification = await pushNotificationModal.findOne({ user_Id: userId });
  if (!pushNotification) return;

  const message = {
    notification: {
      title: title || 'Notification',
      body: body || 'You have a new message',
    },
    data: {
      ...data,
    },
    token: pushNotification.token,
  };

  const response = await admin.messaging().send(message);
  return response;
};

export const sendTestPushNotifications = async (userId: string) => {
  const pushNotification = await pushNotificationModal.findOne({ user_Id: userId });

  if (!pushNotification) throw new ApiError(httpStatus.NOT_FOUND, 'notification not found!');

  const token = pushNotification.token;

  const messages = [
    {
      notification: {
        title: 'Default Notification',
        body: 'This is a simple notification',
      },
      data: { type: 'DEFAULT' },
      token,
    },
    {
      notification: {
        title: 'With Custom Data',
        body: 'Tap to see post',
      },
      data: {
        type: 'POST',
        postId: '123456',
        customInfo: 'extra data',
      },
      token,
    },
    {
      data: {
        type: 'SILENT',
        info: 'No notification field, app handles this silently',
      },
      token,
      android: {
        priority: 'high',
      },
    },
    {
      notification: {
        title: 'Click Action Test',
        body: 'Tap me to open app screen',
      },
      data: {
        type: 'NAVIGATION',
        screen: 'SinglePost',
        postId: 'post789',
      },
      token,
    },
    {
      notification: {
        title: 'Big Picture Notification',
        body: 'This has an image!',
        imageUrl:
          'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse4.mm.bing.net%2Fth%2Fid%2FOIP.39u8AR1NJ-P7gkXAnsN9bwHaEF%3Fpid%3DApi&f=1&ipt=cf2e5b4f1a90f8c43aea4b90814cd7df26fd631d60dc3c819218574bb5bfa197&ipo=images',
      },
      data: {
        type: 'IMAGE',
      },
      token,
    },
    {
      notification: {
        title: 'Grouped Notification',
        body: 'This is part of a group',
      },
      data: {
        type: 'GROUP',
        group: 'group_123',
      },
      android: {
        notification: {
          tag: 'group_tag',
        },
      },
      token,
    },
    {
      notification: {
        title: 'Message Notification',
        body: 'You got a new message',
      },
      data: {
        type: 'MESSAGE',
        sender_id: 'user123',
      },
      token,
    },
  ];

  const responses = await Promise.all(messages.map((msg) => admin.messaging().send(msg as any)));

  return responses;
};
