import mongoose from 'mongoose';
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

  const latestMessage = await messageModel.findOne({ chat: chatId }).sort({ createdAt: -1 });

  const canGroup =
    latestMessage &&
    latestMessage.sender.toString() === userId &&
    latestMessage.createdAt &&
    new Date().getTime() - new Date(latestMessage.createdAt).getTime() < 60 * 1000 &&
    (!latestMessage.media || latestMessage.media.length === 0);

  if (canGroup && !media?.flat().length) {
    latestMessage.content += `\n${content}`;
    await latestMessage.save();
    return messageModel.findById(latestMessage._id).populate([
      { path: 'sender', select: 'firstName lastName _id' },
      { path: 'senderProfile', select: 'profile_dp' },
      { path: 'chat', select: 'users' },
    ]);
  }

  messageBody = {
    sender: userId,
    content,
    chat: chatId,
    readByUsers: [userId],
    senderProfile: UserProfileId,
    ...(media?.length && { media: media.flat() }),
  };

  const newMessage = await messageModel.create(messageBody);
  await chatModel.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });

  const message = await messageModel.findById(newMessage._id).populate([
    { path: 'sender', select: 'firstName lastName _id' },
    { path: 'senderProfile', select: 'profile_dp' },
    { path: 'chat', select: 'users' },
  ]);

  return message;
};

export const getMessages = async (chatId: string) => {
  const messages = await messageModel
    .find({ chat: chatId })
    .populate([
      { path: 'sender', select: 'firstName lastName _id' },
      { path: 'senderProfile', select: '  profile_dp' },
    ])
    .sort({ createdAt: 1 });

  return messages;
};

export const updateMessageSeen = async (messageId: string, readByUserId: string) => {
  const message = await messageModel.findByIdAndUpdate(
    messageId,
    { $addToSet: { readByUsers: readByUserId } },
    { new: true }
  );

  return message;
};

export const reactToMessage = async (id: any, userId: string, emoji: string) => {
  const message = await messageModel.findById(id);

  if (!message) {
    throw new Error('Message not found');
  }

  const userReaction = message.reactions.find((x) => x.userId === userId);

  if (!userReaction) {
    await message.updateOne({ $push: { reactions: { userId, emoji } } });
  } else if (userReaction.emoji === emoji) {
    await message.updateOne({ $pull: { reactions: { userId } } });
  } else {
    await messageModel.updateOne({ _id: id, 'reactions.userId': userId }, { $set: { 'reactions.$.emoji': emoji } });
  }

  return messageModel.findById(id).populate([{ path: 'chat', select: ' users' }]);
};

export const unreadMessagesCount = async (chatsID: any[], userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const messages = await messageModel
    .find({
      chat: { $in: chatsID },
    })
    .sort({ createdAt: -1 });

  const messagesByChat = new Map<string, any[]>();
  for (const msg of messages) {
    const chatId = msg.chat.toString();
    if (!messagesByChat.has(chatId)) {
      messagesByChat.set(chatId, []);
    }
    messagesByChat.get(chatId)!.push(msg);
  }

  let totalUnread = 0;

  for (const [_, msgs] of messagesByChat.entries()) {
    for (const msg of msgs) {
      const isRead = msg.readByUsers.some((reader: any) => reader.equals(userObjectId));
      if (isRead) break;
      totalUnread++;
    }
  }

  return totalUnread;
};
