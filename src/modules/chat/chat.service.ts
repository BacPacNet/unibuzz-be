import mongoose from 'mongoose';
import { UserProfile } from '../userProfile';
import {
  chatInterface,
  media,
  PopulatedUserId,
  ProfileForEnrichment,
  BlockedUser,
  BlockProfile,
  ChatUser,
  MessageWithChat,
  GroupMetadataUpdates,
  CommunityRef,
  UserChatListItem,
} from './chat.interface';
import chatModel from './chat.model';
import { getGroupChatMembersPipeline } from './chat.pipeline';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { messageModel, messageService } from '../message';
import { sameId, toUserIdString } from '../../utils/common';

/** UserProfile fields used when enriching chat users with profile data. */
const USER_PROFILE_ENRICHMENT_SELECT =
  'profile_dp users_id university_name study_year degree major affiliation occupation role';

/** Max number of recent messages to load per chat for unread count in getUserChats. */
const RECENT_MESSAGES_LIMIT = 50;

/** Default page for message notification pagination. */
const DEFAULT_NOTIFICATION_PAGE = 1;

/** Default limit for message notification pagination. */
const DEFAULT_NOTIFICATION_LIMIT = 10;

/**
 * Fetches user profiles for the given user IDs. Used by getChat, createChat, getUserChats.
 */
async function fetchProfilesForUserIds(
  userIds: (string | mongoose.Types.ObjectId)[]
): Promise<ProfileForEnrichment[]> {
  if (userIds.length === 0) return [];
  const result = await UserProfile.find({ users_id: { $in: userIds } })
    .select(USER_PROFILE_ENRICHMENT_SELECT)
    .lean();
  return result as unknown as ProfileForEnrichment[];
}

type EnrichChatUsersOptions = {
  includeExtended?: boolean;
  getPerUserOptions?: (
    user: { userId: PopulatedUserId },
    profile: ProfileForEnrichment | null
  ) => { hideProfile?: boolean; isDeleted?: boolean; isBlocked?: boolean };
};

/**
 * Enriches chat users with profile data. Matches each user to a profile by userId.
 * Used by getChat, createChat, getUserChats.
 */
function enrichChatUsersWithProfiles<T extends { userId: PopulatedUserId }>(
  users: T[],
  profiles: ProfileForEnrichment[],
  options: EnrichChatUsersOptions = {}
): (T & { userId: PopulatedUserId })[] {
  const { includeExtended = false, getPerUserOptions } = options;
  return users.map((user) => {
    const profile =
      profiles.find((p) => (p.users_id?.toString() ?? '') === (user.userId?._id?.toString() ?? '')) ?? null;
    const perUser = getPerUserOptions?.(user, profile) ?? {};
    return mapChatUserWithProfile(user, profile, {
      includeExtended,
      ...perUser,
    });
  });
}

/**
 * Maps a chat user with optional profile data onto userId. Used by getChat, createChat, getUserChats.
 */
function mapChatUserWithProfile<T extends { userId: PopulatedUserId }>(
  user: T,
  profile: ProfileForEnrichment | null | undefined,
  options?: {
    includeExtended?: boolean;
    hideProfile?: boolean;
    isDeleted?: boolean;
    isBlocked?: boolean;
  }
): T & { userId: PopulatedUserId } {
  const hideProfile = options?.hideProfile ?? false;
  const isDeleted = options?.isDeleted ?? false;
  const isBlocked = options?.isBlocked ?? false;
  const includeExtended = options?.includeExtended ?? false;

  const baseFields = {
    profileDp: profile?.profile_dp?.imageUrl ?? null,
    universityName: profile?.university_name ?? null,
    studyYear: profile?.study_year ?? null,
    degree: profile?.degree ?? null,
  };
  const extendedFields = includeExtended
    ? {
        major: profile?.major ?? null,
        role: profile?.role ?? null,
        affiliation: profile?.affiliation ?? null,
        occupation: profile?.occupation ?? null,
      }
    : {};

  if (hideProfile) {
    return {
      ...user,
      userId: {
        _id: user.userId._id,
        firstName: 'Deleted',
        lastName: 'user',
        profileDp: null,
        universityName: null,
        studyYear: null,
        degree: null,
        major: null,
        role: null,
        affiliation: null,
        occupation: null,
        isDeleted,
        isBlocked,
      },
    };
  }

  return {
    ...user,
    userId: {
      ...user.userId,
      ...baseFields,
      ...extendedFields,
      isDeleted,
      isBlocked,
    },
  };
}

export const getChat = async (yourId: string, userId: string) => {
  const isChat: chatInterface[] = await chatModel
    .find({
      isGroupChat: false,
      $and: [{ users: { $elemMatch: { userId: yourId } } }, { users: { $elemMatch: { userId: userId } } }],
    })
    .populate([{ path: 'users.userId', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const profiles = await fetchProfilesForUserIds([userId]);

  const ChatWithDp = isChat.map((chat) => ({
    ...chat,
    users: enrichChatUsersWithProfiles(chat.users, profiles, {}),
  }));
  return ChatWithDp;
};

export const getChatById = async (chatId: string) => {
  return await chatModel.findById(chatId);
};

/**
 * Fetches a chat by ID or throws ApiError NOT_FOUND if it does not exist.
 * Use this when the presence of the chat is required for the operation.
 */
export const getChatByIdOrThrow = async (chatId: string) => {
  const chat = await chatModel.findById(chatId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  }
  return chat;
};

export const createChat = async (yourId: string, userId: string, isRequestAcceptedBoolean: boolean) => {
  const chatToCreate = {
    chatName: 'OneToOne',
    isGroupChat: false,
    users: [{ userId: yourId }, { userId: userId }],
    groupAdmin: yourId,
    isRequestAccepted: isRequestAcceptedBoolean,
  };

  const chat = await chatModel.create(chatToCreate);

  const createdChat: chatInterface | null = await chatModel
    .findById(chat._id)
    .populate([{ path: 'users.userId', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const profiles = await fetchProfilesForUserIds([yourId, userId]);

  const ChatWithDp = {
    ...createdChat,
    users: createdChat?.users
      ? enrichChatUsersWithProfiles(createdChat.users, profiles, { includeExtended: true })
      : [],
  };

  return ChatWithDp;
};

export const getUserChats = async (userId: string) => {
  const myProfile = await UserProfile.findOne({ users_id: userId }, { blockedUsers: 1 }).lean();

  const myBlockedUserIds = new Set(
    ((myProfile?.blockedUsers || []) as unknown as BlockedUser[]).map((b) => toUserIdString(b.userId))
  );

  const chats: (chatInterface & { _id: mongoose.Types.ObjectId })[] = await chatModel
    .find({ users: { $elemMatch: { userId } } })
    .populate({
      path: 'users.userId',
      select: 'firstName lastName isDeleted',
    })
    .populate('latestMessage')
    .lean();

  const userIds = chats.flatMap((chat) => chat.users.map((u) => u.userId?._id?.toString()).filter(Boolean)) as string[];

  const uniqueUserIds = [...new Set(userIds)];

  const blockProfiles = (await UserProfile.find(
    { users_id: { $in: uniqueUserIds } },
    { users_id: 1, blockedUsers: 1 }
  ).lean()) as BlockProfile[];

  const blockedMap = new Map<string, Set<string>>(
    blockProfiles.map((p) => [
      toUserIdString(p.users_id),
      new Set((p.blockedUsers || []).map((b) => toUserIdString(b.userId))),
    ])
  );

  function iBlocked(userIdToCheck: mongoose.Types.ObjectId | string): boolean {
    return myBlockedUserIds.has(toUserIdString(userIdToCheck));
  }

  function theyBlockedMe(userIdToCheck: mongoose.Types.ObjectId | string): boolean {
    return blockedMap.get(toUserIdString(userIdToCheck))?.has(toUserIdString(userId)) ?? false;
  }

  function isUserBlocked(targetUser: ChatUser | undefined | null): boolean {
    if (!targetUser?._id) return false;
    const targetId = toUserIdString(targetUser._id);
    return iBlocked(targetId) || theyBlockedMe(targetId);
  }
  const filteredChats = chats.filter((chat) => {
    if (!chat?.users) return false;

    if (!chat.isGroupChat) return true;

    const adminUser = chat.users.find(
      (u) => u.userId && u.userId._id && toUserIdString(u.userId._id) === toUserIdString(chat.groupAdmin)
    );

    if (!adminUser?.userId || !adminUser.userId._id) {
      return false;
    }

    const adminId = toUserIdString(adminUser.userId._id);

    if (
      typeof adminUser.userId === 'object' &&
      adminUser.userId !== null &&
      'isDeleted' in adminUser.userId &&
      adminUser.userId.isDeleted === true
    ) {
      return false;
    }

    const iBlockedAdmin = iBlocked(adminId);
    const adminBlockedMe = blockedMap.get(adminId)?.has(toUserIdString(userId)) ?? false;

    if (iBlockedAdmin || adminBlockedMe) {
      return false;
    }

    return true;
  });

  const userProfiles = await fetchProfilesForUserIds(uniqueUserIds);

  const chatIds = filteredChats.map((c) => toUserIdString(c._id));

  const messages = (await messageModel
    .find({ chat: { $in: chatIds } })
    .sort({ createdAt: -1 })
    .limit(RECENT_MESSAGES_LIMIT)
    .lean()) as MessageWithChat[];

  const messagesByChat = messages.reduce<Record<string, MessageWithChat[]>>((acc, msg) => {
    const id = toUserIdString(msg.chat);
    const bucket = acc[id] ?? [];
    bucket.push(msg);
    acc[id] = bucket;
    return acc;
  }, {});

  function getUnreadMessagesCount(messages: MessageWithChat[], userId: string): number {
    let count = 0;
    for (const msg of messages) {
      if (msg.readByUsers.some((u) => sameId(u, userId))) break;
      count++;
    }
    return count;
  }

  const allChats = filteredChats.map((chat) => {
    const enrichedUsers = enrichChatUsersWithProfiles(chat.users, userProfiles, {
      includeExtended: true,
      getPerUserOptions: (user, _profile) => {
        const isDeleted =
          typeof user.userId === 'object' &&
          user.userId !== null &&
          'isDeleted' in user.userId &&
          user.userId.isDeleted === true;
        const isBlocked = isUserBlocked(user.userId as unknown as ChatUser);
        const hideProfile = isDeleted || isBlocked;
        return { hideProfile, isDeleted, isBlocked };
      },
    });

    const profileDp =
      !chat.isGroupChat
        ? (enrichedUsers.find((u) => u.userId._id && !sameId(u.userId._id, userId))?.userId as PopulatedUserId)
            ?.profileDp ?? null
        : null;

    const latestMessageTime =
      chat.latestMessage && 'createdAt' in chat.latestMessage ? new Date(chat.latestMessage.createdAt).getTime() : 0;

    return {
      ...chat,
      users: enrichedUsers,
      groupLogoImage: profileDp,
      unreadMessagesCount: getUnreadMessagesCount(messagesByChat[toUserIdString(chat._id)] || [], userId),
      latestMessageTime,
    };
  });

  (allChats as UserChatListItem[]).sort((a, b) => {
    const aCreatedAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreatedAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const aTime = a.latestMessageTime || aCreatedAt;
    const bTime = b.latestMessageTime || bCreatedAt;
    return bTime - aTime;
  });

  return allChats;
};

export const createGroupChat = async (
  adminId: string,
  usersToAdd: { userId: string; acceptRequest: boolean }[],
  groupName: string,
  groupDescription: string,
  groupLogo: media | null = null,
  community: CommunityRef
) => {
  if (!adminId || !groupName) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Admin ID and group name are required');
  }

  const normalizedUsers =
    usersToAdd
      ?.filter((user) => user.userId && user.userId !== adminId)
      .map((user) => ({
        userId: new mongoose.Types.ObjectId(user.userId),
        isRequestAccepted: false,
        isStarred: false,
      })) || [];

  const groupData = {
    chatName: groupName.trim(),
    community: community,
    users: [
      ...normalizedUsers,
      {
        userId: new mongoose.Types.ObjectId(adminId),
        isRequestAccepted: true,
        isStarred: false,
      },
    ],
    isGroupChat: true,
    groupAdmin: adminId,
    groupDescription: groupDescription?.trim() || '',
    groupLogo: groupLogo || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const newGroup = await chatModel.create(groupData);
    return newGroup;
  } catch (error) {
    console.error('Failed to create group chat:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create group chat');
  }
};

/**
 * Applies group name and logo updates to a chat document when values actually changed.
 * Used by editGroupChatV2 and editGroupChat.
 */
function applyGroupMetadataUpdates(
  currentGroup: { chatName: string; groupLogo?: { imageUrl?: string | String; publicId?: string | String } | null },
  updates: GroupMetadataUpdates
): void {
  if (updates.groupName && updates.groupName !== currentGroup.chatName) {
    currentGroup.chatName = updates.groupName;
  }
  const currentImageUrl = currentGroup.groupLogo?.imageUrl?.toString?.() ?? currentGroup.groupLogo?.imageUrl;
  const currentPublicId = currentGroup.groupLogo?.publicId?.toString?.() ?? currentGroup.groupLogo?.publicId;
  if (
    updates.groupLogo &&
    (updates.groupLogo.imageUrl !== currentImageUrl || updates.groupLogo.publicId !== currentPublicId)
  ) {
    currentGroup.groupLogo = updates.groupLogo;
  }
}

export const editGroupChatV2 = async (
  groupId: string,
  usersToAdd: { userId: string; acceptRequest: boolean }[],
  groupName: string,
  groupLogo: { imageUrl: string; publicId: string } | null
) => {
  const currentGroup = await getChatByIdOrThrow(groupId);

  // Normalize existing users first for consistent comparison
  const existingUsers = currentGroup.users.map((user) => ({
    userId: new mongoose.Types.ObjectId(user.userId),
    isRequestAccepted: user.isRequestAccepted,
  }));
  const existingUserIds = new Set(existingUsers.map((u) => u.userId.toString()));

  // Process new users - only add those not already in group
  if (usersToAdd?.length) {
    const newUsers = usersToAdd
      .filter((user) => {
        const userIdStr = user.userId?.toString();
        return userIdStr && !existingUserIds.has(userIdStr);
      })
      .map((user) => ({
        userId: new mongoose.Types.ObjectId(user.userId),
        isRequestAccepted: false, // Default to false since we're just adding IDs
      }));

    if (newUsers.length) {
      currentGroup.users = [...existingUsers, ...newUsers];
    }
  }

  applyGroupMetadataUpdates(currentGroup, { groupName, groupLogo });

  const updatedGroup = await currentGroup.save();
  return updatedGroup;
};


export const getGroupChatMembers = async (myUserId: string, chatId: string) => {
  const myObjectId = new mongoose.Types.ObjectId(myUserId);
  const chatObjectId = new mongoose.Types.ObjectId(chatId);

  const myBlockedUserIds =
    (await UserProfile.findOne({ users_id: myObjectId }).select('blockedUsers').lean())?.blockedUsers?.map(
      (b: any) => new mongoose.Types.ObjectId(b.userId)
    ) || [];

  const pipeline = getGroupChatMembersPipeline(chatObjectId, myObjectId, myBlockedUserIds);
  const result = await chatModel.aggregate(pipeline);

  if (!result.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'You are not a member of this group');
  }

  return result[0];
};
export const toggleAddToGroup = async (userID: string, userToToggleId: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);
  if (!chat.isGroupChat) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Not a group chat');
  }

  if (!sameId(chat.groupAdmin, userID)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not the admin of this group');
  }

  const doesUserExist = chat.users.some((user) => sameId(user.userId, userToToggleId));

  if (doesUserExist) {
    chat.users = chat.users.filter((item) => !sameId(item.userId, userToToggleId));
  } else {
    chat.users.push({
      userId: new mongoose.Types.ObjectId(userToToggleId),
      isRequestAccepted: false,
      isStarred: false,
    });
  }
  return await chat.save();
};

export const leaveGroupByUserId = async (userID: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);
  if (!chat.isGroupChat) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Not a group chat');
  }

  const doesUserExist = chat.users.find((user) => sameId(user.userId, userID));

  if (doesUserExist && sameId(doesUserExist.userId, chat.groupAdmin)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Admin cannot leave the group');
  }
  if (doesUserExist) {
    chat.users = chat.users.filter((item) => !sameId(item.userId, userID));
  } else {
    throw new ApiError(httpStatus.NOT_FOUND, 'You are not a member of this group');
  }
  return await chat.save();
};

export const deleteChatGroupByAdmin = async (userID: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);

  if (!chat.isGroupChat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Group not found');
  }

  const isAdmin = chat.groupAdmin.toString() === userID;

  if (!isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not the admin of this group');
  }

  await chatModel.findByIdAndDelete(chatId);

  return { message: 'Group deleted successfully' };
};




export const acceptSingleRequest = async (userId: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);

  if (chat.isRequestAccepted) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already accepted');
  }

  if (sameId(chat.groupAdmin, userId)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not allowed');
  }

  chat.isRequestAccepted = true;

  return await chat.save();
};

export const acceptGroupRequest = async (userId: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);
  const user = chat.users.find((user) => sameId(user.userId, userId));

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found in chat');
  }

  if (user.isRequestAccepted) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already accepted');
  }

  if (sameId(chat.groupAdmin, userId)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not allowed');
  }

  user.isRequestAccepted = true;

  return await chat.save();
};

export const toggleStarredStatus = async (userId: string, chatId: string) => {
  const chat = await getChatByIdOrThrow(chatId);
  const user = chat.users.find((user) => user.userId.toString() === userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found in chat');
  }

  user.isStarred = !user.isStarred;

  return await chat.save();
};

export const messageNotification = async (
  userId: string = '',
  page: number = DEFAULT_NOTIFICATION_PAGE,
  limit: number = DEFAULT_NOTIFICATION_LIMIT
) => {
  const skip = (page - 1) * limit;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chats = await chatModel
    .find({
      users: { $elemMatch: { userId: userObjectId } },
      latestMessage: { $exists: true, $ne: null },
    })
    .sort({ createdAt: -1 })
    .populate({
      path: 'users.userId',
      select: 'firstName lastName',
    })
    .populate({
      path: 'latestMessage',
      match: {
        readByUsers: { $ne: userObjectId },
      },
    })
    .skip(skip)
    .limit(limit)
    .lean();

  const filteredChats = chats.filter((chat) => chat.latestMessage !== null);

  const userIds = filteredChats.flatMap((chat) =>
    chat.users
      .map((user) => {
        if (typeof user.userId === 'object' && user.userId._id) {
          return user.userId._id.toString();
        }
        return user.userId.toString();
      })
      .filter(Boolean)
  );

  const uniqueUserIds = [...new Set(userIds)];

  const userProfiles = await UserProfile.find({ users_id: { $in: uniqueUserIds } })
    .select('profile_dp users_id')
    .lean();

  const allChats = filteredChats.map((chat) => {
    let profileDp: string | null = null;

    if (!chat.isGroupChat) {
      const otherUser = chat.users.find(
        (user) => typeof user.userId === 'object' && user.userId._id && !sameId(user.userId._id, userId)
      );

      if (otherUser) {
        const userProfile = userProfiles.find((profile: any) =>
          sameId(profile.users_id, otherUser.userId._id as any)
        );
        profileDp = userProfile ? userProfile.profile_dp?.imageUrl ?? null : null;
      }
    } else {
      chat.users = chat.users.map((user) => {
        const userProfile = userProfiles.find((profile) => profile.users_id.toString() === user.userId.toString());
        const profileDp = userProfile ? userProfile.profile_dp?.imageUrl ?? null : null;

        return {
          ...user,
          profileDp,
        };
      }) as any;
    }

    return {
      ...chat,
      groupLogoImage: profileDp,
    };
  });

  return allChats;
};

export const messageNotificationTotalCount = async (userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chats = await chatModel.find({
    users: { $elemMatch: { userId: userObjectId } },
    latestMessage: { $exists: true, $ne: null },
  });

  const chatsId = chats.map((item) => item?._id);

  const unreadMessagesTotalCount = await messageService.unreadMessagesCount(chatsId, userId);

  return unreadMessagesTotalCount;
};
