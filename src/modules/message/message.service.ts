import { chatModel } from '../chat';
import messageModel from './message.model';

export const createmessage = async (
  userId: string,
  content: string,
  UserProfileId: string,
  chatId: string,
  media: { imageUrl: string; publicId: string }[]
) => {
  let messageBody;
  if (media) {
    messageBody = {
      sender: userId,
      content: content,
      chat: chatId,
      readByUsers: [userId],
      media: [media],
      senderProfile: UserProfileId,
    };
  } else {
    messageBody = {
      sender: userId,
      content: content,
      chat: chatId,
      readByUsers: [userId],
      senderProfile: UserProfileId,
    };
  }
  const newMessage = await messageModel.create(messageBody);
  await chatModel.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });
  return newMessage;
};

export const getMessages = async (chatId: string) => {
  const messages = await messageModel.find({ chat: chatId }).populate([
    { path: 'sender', select: 'firstName lastName _id' },
    { path: 'senderProfile', select: '  profile_dp' },
  ]);

  return messages;
};
