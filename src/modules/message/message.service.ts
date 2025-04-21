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

  if (media?.flat()?.length > 0) {
    messageBody = {
      sender: userId,
      content: content,
      chat: chatId,
      readByUsers: [userId],
      media: media.flat(),
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
  const message = await messageModel.findById(newMessage._id).populate([
    { path: 'sender', select: 'firstName lastName _id' },
    { path: 'senderProfile', select: '  profile_dp' },
    { path: 'chat', select: ' users' },
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

// export const unreadMessagesCount = async (chatsID: any[], userId: string) => {
//   const userObjectId = new mongoose.Types.ObjectId(userId);

//   const unreadMessages = await messageModel.find({
//     chat: { $in: chatsID },
//     readByUsers: { $ne: userObjectId }, // or $nin: [userObjectId] if preferred
//   });

//   console.log('mess', unreadMessages);

//   console.log('Unread messages:', unreadMessages.length);
//   return unreadMessages.length;
// };

// export const unreadMessagesCount = async (chatsID: any[], userId: string) => {
//   const userObjectId = new mongoose.Types.ObjectId(userId);

//   const latestMessages = await messageModel.aggregate([
//     {
//       $match: {
//         chat: { $in: chatsID },
//       },
//     },
//     {
//       $sort: { createdAt: -1 },
//     },
//     {
//       $group: {
//         _id: '$chat',
//         latestMessage: { $first: '$$ROOT' },
//       },
//     },
//   ]);

//   const unreadChats = latestMessages.filter(
//     (chat) => !chat.latestMessage.readByUsers.some((readerId: any) => readerId.equals(userObjectId))
//   );

//   console.log('Unread chats (based on latest message):', unreadChats.length);
//   return unreadChats.length;
// };

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

  console.log('Total unread messages after last read per chat:', totalUnread);
  return totalUnread;
};
