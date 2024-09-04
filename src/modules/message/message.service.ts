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
      media: media,
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
  const messages = await messageModel.find({ chat: chatId }).populate([
    { path: 'sender', select: 'firstName lastName _id' },
    { path: 'senderProfile', select: '  profile_dp' },
  ]);

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
  // const message = await messageModel.findById(id);
  // if (!message) {
  //   throw new Error('Message not found');
  // }

  // const userReaction = message.reactions.find((x) => x.userId === userId);

  // let update;

  // if (!userReaction) {
  //   // Add a new reaction if the user hasn't reacted yet
  //   update = { $push: { reactions: { userId, emoji } } };
  // } else if (userReaction.emoji === emoji) {
  //   // Remove the reaction if the user reacted with the same emoji
  //   update = { $pull: { reactions: { userId, emoji } } };
  // } else {
  //   // Update the reaction if the user reacted with a different emoji
  //   update = { $set: { "reactions.$.emoji": emoji } };
  // }

  // // Update and return the modified document
  // const updatedMessage = await messageModel.findByIdAndUpdate(id, update, { new: true });

  // return updatedMessage;

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
