import mongoose, { type PopulateOptions } from 'mongoose';
import { chatModel } from '../chat';
import messageModel from './message.model';
import { UserProfile } from '../userProfile';
import { toIdString, toUserIdString } from '../../utils/common';
import type { BlockedUserEntry, MessageMedia, ObjectIdLike } from './message.interface';
import { getUnreadMessagesCountPipeline } from './message.pipeline';


const GROUP_WINDOW_MS = 60 * 1000;

function toBlockedUserIdSet(blockedUsers: BlockedUserEntry[] | undefined | null): Set<string> {
  const ids = (blockedUsers || [])
    .map((b) => toIdString(b?.userId))
    .filter((v: string | null): v is string => Boolean(v));

  return new Set(ids);
}

function isDeletedSender(sender: unknown): sender is { _id?: unknown; isDeleted: true } {
  return (
    sender !== null &&
    typeof sender === 'object' &&
    'isDeleted' in sender &&
    (sender as { isDeleted?: unknown }).isDeleted === true
  );
}

const MESSAGE_POPULATE_SENDER_BASE: PopulateOptions[] = [
  { path: 'senderProfile', select: 'profile_dp' },
  { path: 'sender', select: 'firstName lastName _id' },
];

const MESSAGE_POPULATE_SENDER_WITH_DELETED_FLAG: PopulateOptions[] = [
  { path: 'senderProfile', select: 'profile_dp' },
  { path: 'sender', select: 'firstName lastName _id isDeleted' },
];

const MESSAGE_POPULATE_WITH_CHAT: PopulateOptions[] = [
  ...MESSAGE_POPULATE_SENDER_BASE,
  { path: 'chat', select: 'users' },
];

export const createmessage = async (
  userId: string,
  content: string,
  UserProfileId: string,
  chatId: string,
  media: MessageMedia[]
) => {
  const latestMessage = await messageModel.findOne({ chat: chatId }).sort({ createdAt: -1 });

  const canGroup =
    latestMessage &&
    latestMessage.sender.toString() === userId &&
    latestMessage.createdAt &&
    new Date().getTime() - new Date(latestMessage.createdAt).getTime() < GROUP_WINDOW_MS &&
    (!latestMessage.media || latestMessage.media.length === 0);

  const flatMedia = media?.flat() ?? [];
  if (canGroup && flatMedia.length === 0) {
    latestMessage.content += `\n${content}`;
    await latestMessage.save();
    return messageModel.findById(latestMessage._id).populate(MESSAGE_POPULATE_WITH_CHAT);
  }

  const messageBody = {
    sender: userId,
    content,
    chat: chatId,
    readByUsers: [userId],
    senderProfile: UserProfileId,
    ...(flatMedia.length > 0 && { media: flatMedia }),
  };

  const newMessage = await messageModel.create(messageBody);
  await chatModel.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });

  const message = await messageModel.findById(newMessage._id).populate(MESSAGE_POPULATE_WITH_CHAT);

  return message;
};

export const getMessages = async (chatId: string, currentUserId: string) => {
  const myProfile = await UserProfile.findOne({ users_id: currentUserId }, { blockedUsers: 1 }).lean();

  const myBlockedUserIds = toBlockedUserIdSet(myProfile?.blockedUsers as BlockedUserEntry[] | undefined);

  const messages = await messageModel
    .find({ chat: chatId })
    .populate(MESSAGE_POPULATE_SENDER_WITH_DELETED_FLAG)
    .sort({ createdAt: 1 })
    .lean();

  const senderIds = messages
    .map((m) => (typeof m.sender === 'object' ? m.sender?._id?.toString() : null))
    .filter(Boolean) as string[];

  const uniqueSenderIds = [...new Set(senderIds)];

  const blockProfiles = await UserProfile.find(
    { users_id: { $in: uniqueSenderIds } },
    { users_id: 1, blockedUsers: 1 }
  ).lean();

  const blockedMap = new Map(
    blockProfiles.map((p) => [
      toIdString(p.users_id) ?? String(p.users_id),
      toBlockedUserIdSet(p.blockedUsers as BlockedUserEntry[] | undefined),
    ])
  );

  function isUserBlocked(sender: unknown): boolean {
    if (!sender || typeof sender !== 'object') return false;

    const senderId = (sender as { _id?: ObjectIdLike })._id?.toString();
    if (!senderId) return false;

    const iBlockedSender = myBlockedUserIds.has(senderId);
    const senderBlockedMe = blockedMap.get(senderId)?.has(toUserIdString(currentUserId)) ?? false;

    return iBlockedSender || senderBlockedMe;
  }

  return messages.map((message) => {
    const sender = message.sender;
    const isDeleted = isDeletedSender(sender);
    const isBlocked = isUserBlocked(sender);

    if (isDeleted || isBlocked) {
      return {
        ...message,
        sender: {
          _id: sender?._id,
          firstName: 'Deleted',
          lastName: 'User',
          isDeleted: isDeleted,
          isBlocked: isBlocked,
        },
        senderProfile: {
          profile_dp: null,
        },
      };
    }

    return message;
  });
};

export const updateMessageSeen = async (messageId: string, readByUserId: string) => {
  const message = await messageModel
    .findByIdAndUpdate(messageId, { $addToSet: { readByUsers: readByUserId } }, { new: true })
    .lean();

  return message;
};

export const reactToMessage = async (id: ObjectIdLike, userId: string, emoji: string) => {
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

  return messageModel.findById(id).populate([{ path: 'chat', select: 'users' }]);
};

export const unreadMessagesCount = async (chatsID: ObjectIdLike[], userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chatIds = chatsID.map((id) =>
    typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
  );

  const result = await messageModel.aggregate<{ totalUnread: number }>(
    getUnreadMessagesCountPipeline(chatIds, userObjectId)
  );

  return result[0]?.totalUnread ?? 0;
};
