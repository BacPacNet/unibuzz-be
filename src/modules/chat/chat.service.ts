import mongoose from 'mongoose';
import { UserProfile, userProfileService } from '../userProfile';
import { chatInterface, media } from './chat.interface';
import chatModel from './chat.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { messageModel, messageService } from '../message';

export const getChat = async (yourId: string, userId: string) => {
  const isChat: chatInterface[] = await chatModel
    .find({
      isGroupChat: false,
      $and: [{ users: { $elemMatch: { userId: yourId } } }, { users: { $elemMatch: { userId: userId } } }],
    })
    .populate([{ path: 'users.userId', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const userProfiledata = await UserProfile.find({ users_id: userId }).select(
    'profile_dp  users_id university_name studyYear degree'
  );

  // const ChatWithDp = isChat.map((item) => ({
  //   ...item,
  //   ProfileDp: userProfiledata.find((profile) => profile.users_id.toString() !== yourId)?.profile_dp?.imageUrl ?? null,
  // }));

  const ChatWithDp = isChat.map((chat) => {
    const updatedUsers = chat.users.map((user) => {
      const userProfile = userProfiledata.find((profile) => profile.users_id.toString() !== yourId.toString());

      return {
        ...user,
        userId: {
          ...user.userId,
          profileDp: userProfile?.profile_dp?.imageUrl ?? null,
          universityName: userProfile?.university_name ?? null,
          studyYear: userProfile?.study_year ?? null,
          degree: userProfile?.degree ?? null,
        },
      };
    });

    return {
      ...chat,
      users: updatedUsers,
    };
  });
  return ChatWithDp;
};

export const getChatById = async (chatId: string) => {
  return await chatModel.findById(chatId);
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

  const userProfiledata = await UserProfile.find({ users_id: userId }).select(
    'profile_dp  users_id university_name studyYear degree'
  );

  // const ChatWithDp = {
  //   ...createdChat,
  //   ProfileDp: userProfiledata.find((profile) => profile.users_id.toString() !== yourId)?.profile_dp?.imageUrl ?? null,
  // };

  const ChatWithDp = {
    ...createdChat,
    users: createdChat?.users.map((user) => {
      const userProfile = userProfiledata.find((profile) => profile.users_id.toString() === user.userId._id.toString());

      return {
        ...user,
        userId: {
          ...user.userId,
          profileDp: userProfile?.profile_dp?.imageUrl ?? null,
          universityName: userProfile?.university_name ?? null,
          studyYear: userProfile?.study_year ?? null,
          degree: userProfile?.degree ?? null,
          major: userProfile?.major ?? null,
          role: userProfile?.role ?? null,
          affiliation: userProfile?.affiliation ?? null,
          occupation: userProfile?.occupation ?? null,
        },
      };
    }),
  };

  return ChatWithDp;
};

export const getUserChats = async (userId: string) => {
  const chats: (chatInterface & { _id: string })[] = await chatModel
    .find({
      users: { $elemMatch: { userId: userId } },
    })
    .populate({
      path: 'users.userId',
      select: 'firstName lastName',
    })
    .populate('latestMessage')
    .lean();

  const filteredChats = chats.filter((chat) => {
    if (!chat?.users) return false; // Ensure chat.users exists

    if (chat.isGroupChat) {
      chat.users = chat.users.filter((user) => user?.userId !== null && user?.userId !== undefined);
      return chat.users.length > 0; // Only keep group chats with valid users
    }

    // For non-group chats
    const isValidChat = chat.users.every((user) => {
      if (!user?.userId) return false;

      if (typeof user.userId === 'object') {
        return user.userId?._id !== undefined;
      }

      return typeof user.userId === 'string' || typeof user.userId === 'number';
    });

    return isValidChat;
  });

  const userIds = filteredChats
    .flatMap((chat) =>
      chat.users.map((user) => {
        if (!user?.userId) return null;

        if (typeof user.userId === 'object' && user.userId._id) {
          return user.userId._id.toString();
        }

        return user.userId.toString();
      })
    )
    .filter((id) => id !== null);

  const chatIds = filteredChats.map((chat) => chat._id.toString());
  const uniqueUserIds = [...new Set(userIds)];

  const userProfiles = await UserProfile.find({ users_id: { $in: uniqueUserIds } })
    .select('profile_dp users_id university_name study_year major affiliation occupation role')
    .lean();

  const messages = await messageModel
    .find({ chat: { $in: chatIds } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const messagesByChat = messages.reduce((acc: any, message) => {
    const chatIdStr = message.chat.toString();

    if (acc[chatIdStr]) {
      acc[chatIdStr].push(message);
    } else {
      acc[chatIdStr] = [message];
    }

    return acc;
  }, {});

  function getUnreadMessagesCount(messages: any, userId: string): number {
    let unreadCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const isReadByUser = message.readByUsers.some((readUserId: string) => readUserId.toString() === userId.toString());

      if (isReadByUser) {
        break;
      }

      unreadCount++;
    }

    return unreadCount;
  }

  const allChats = filteredChats.map((chat) => {
    let profileDp: string | null = null;

    if (!chat.isGroupChat) {
      chat.users = chat.users.map((user) => {
        if (user?.userId?._id?.toString() !== userId.toString()) {
          const userProfile = userProfiles.find((profile) => profile.users_id.toString() === user?.userId?._id?.toString());
          profileDp = userProfile?.profile_dp?.imageUrl ?? null;
          return {
            ...user,
            userId: {
              ...user.userId,
              profileDp: userProfile?.profile_dp?.imageUrl ?? null,
              universityName: userProfile?.university_name ?? null,
              studyYear: userProfile?.study_year ?? null,
              degree: userProfile?.degree ?? null,
              major: userProfile?.major ?? null,
              role: userProfile?.role ?? null,
              affiliation: userProfile?.affiliation ?? null,
              occupation: userProfile?.occupation ?? null,
            },
          };
        }
        return user;
      }) as any;
    } else {
      chat.users = chat.users.map((user) => {
        const userProfile = userProfiles.find((profile) => profile.users_id.toString() === user.userId._id.toString());
        return {
          ...user,
          userId: {
            ...user.userId,
            profileDp: userProfile?.profile_dp?.imageUrl ?? null,
            universityName: userProfile?.university_name ?? null,
            studyYear: userProfile?.study_year ?? null,
            degree: userProfile?.degree ?? null,
            major: userProfile?.major ?? null,
            role: userProfile?.role ?? null,
            affiliation: userProfile?.affiliation ?? null,
            occupation: userProfile?.occupation ?? null,
          },
        };
      }) as any;

      if (chat.users && Array.isArray(chat.users)) {
        chat.users.sort((a: any, b: any) => {
          const isAAdmin = a.userId?._id?.toString() === chat.groupAdmin?.toString();
          const isBAdmin = b.userId?._id?.toString() === chat.groupAdmin?.toString();

          if (isAAdmin && !isBAdmin) return -1;
          if (!isAAdmin && isBAdmin) return 1;

          return (a.userId?.firstName || '').toLowerCase().localeCompare((b.userId?.firstName || '').toLowerCase());
        });
      }
    }

    const latestMessageTime =
      chat.latestMessage && 'createdAt' in chat.latestMessage ? new Date(chat.latestMessage.createdAt).getTime() : 0;

    return {
      ...chat,
      groupLogoImage: profileDp,
      unreadMessagesCount: getUnreadMessagesCount(messagesByChat[chat._id.toString()] || [], userId),
      latestMessageTime,
    };
  });

  allChats.sort((a: any, b: any) => {
    const aTime = a.latestMessageTime > 0 ? a.latestMessageTime : new Date(a.createdAt || 0).getTime();
    const bTime = b.latestMessageTime > 0 ? b.latestMessageTime : new Date(b.createdAt || 0).getTime();

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
  community: any
) => {
  // Validate required fields
  if (!adminId || !groupName) {
    throw new Error('Admin ID and group name are required');
  }

  // Normalize and validate users to add
  const normalizedUsers =
    usersToAdd
      ?.filter((user) => user.userId && user.userId !== adminId) // Remove invalid IDs and prevent adding admin again
      .map((user) => ({
        userId: new mongoose.Types.ObjectId(user.userId),
        isRequestAccepted: false,
        isStarred: false,
      })) || [];

  // Create group data with proper ObjectId types
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

  // Create and return the new group
  try {
    const newGroup = await chatModel.create(groupData);
    return newGroup;
  } catch (error) {
    console.error('Failed to create group chat:', error);
    throw new Error('Failed to create group chat');
  }
};

type UsersToAdd = {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    profile: any;
  };
  acceptRequest: boolean;
};

export const editGroupChatV2 = async (
  groupId: string,
  usersToAdd: { userId: string; acceptRequest: boolean }[], // Now accepts array of strings (user IDs)
  groupName: string,
  groupLogo: { imageUrl: string; publicId: string } | null
) => {
  const currentGroup = await getChatById(groupId);
  if (!currentGroup) {
    throw new Error('Chat not found');
  }

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

  // Update group name if changed
  if (groupName && groupName !== currentGroup.chatName) {
    currentGroup.chatName = groupName;
  }

  // Update group logo if changed
  if (
    groupLogo &&
    (groupLogo.imageUrl !== currentGroup.groupLogo?.imageUrl || groupLogo.publicId !== currentGroup.groupLogo?.publicId)
  ) {
    currentGroup.groupLogo = groupLogo;
  }

  const updatedGroup = await currentGroup.save();
  return updatedGroup;
};

export const editGroupChat = async (
  groupId: string,
  usersToAdd: UsersToAdd[],
  groupName: string,
  groupLogo: { imageUrl: string; publicId: string }
) => {
  const currentGroup = await getChatById(groupId);

  if (!currentGroup) {
    throw new Error('Chat Id not found');
  }

  if (usersToAdd.length) {
    const existingUserIds = new Set(currentGroup.users.map((u: any) => u.userId.toString()));

    const normalizedUsers = usersToAdd.map((user) => ({
      userId: user.user._id.toString(),
      isRequestAccepted: user.acceptRequest,
    }));

    const newUsers = normalizedUsers.filter((user) => !existingUserIds.has(user.userId));

    if (newUsers.length > 0) {
      const cleanedCurrentUsers: any = currentGroup.users.map((u) => ({
        userId: u.userId.toString(),
        isRequestAccepted: u.isRequestAccepted,
      }));

      currentGroup.users = [...cleanedCurrentUsers, ...newUsers];
    }
  }

  if (groupName && groupName !== currentGroup.chatName) {
    currentGroup.chatName = groupName;
  }

  if (
    groupLogo &&
    (groupLogo.imageUrl !== currentGroup.groupLogo?.imageUrl || groupLogo.publicId !== currentGroup.groupLogo?.publicId)
  ) {
    currentGroup.groupLogo = groupLogo;
  }

  const updatedGroup = await currentGroup.save();
  return updatedGroup;
};

export const getGroupChatMembers = async (userID: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);
  const isMember = chat?.users.some((user) => user.userId.toString() == userID);

  if (!isMember) {
    throw new ApiError(httpStatus.NOT_FOUND, 'you are not a member of this group');
  }

  const chatWithUserDetails = await chatModel.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(chatId) },
    },
    {
      $unwind: '$users',
    },
    {
      $lookup: {
        from: 'users',
        localField: 'users.userId',
        foreignField: '_id',
        as: 'users.userId',
      },
    },
    {
      $unwind: '$users.userId',
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'users.userId._id',
        foreignField: 'users_id',
        as: 'users.userProfile',
      },
    },
    {
      $unwind: {
        path: '$users.userProfile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        'users.userId.profileDp': '$users.userProfile.profile_dp.imageUrl',
        'users.userId.studyYear': '$users.userProfile.study_year',
        'users.userId.major': '$users.userProfile.major',
        'users.userId.occupation': '$users.userProfile.occupation',
        'users.userId.affiliation': '$users.userProfile.affiliation',
        'users.userId.role': '$users.userProfile.role',
      },
    },
    {
      $group: {
        _id: '$_id',
        chatName: { $first: '$chatName' },
        groupDescription: { $first: '$groupDescription' },
        community: { $first: '$community' },
        isGroupChat: { $first: '$isGroupChat' },
        groupAdmin: { $first: '$groupAdmin' },
        users: { $push: '$users' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
      },
    },
    {
      $project: {
        'users.userProfile': 0,
        'users.userId.password': 0,
      },
    },
  ]);

  return chatWithUserDetails[0];
};
export const toggleAddToGroup = async (userID: string, userToToggleId: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);
  let updated = false;
  if (!chat?.isGroupChat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'not group chat');
  }

  if (chat.groupAdmin.toString() !== userID) {
    throw new ApiError(httpStatus.NOT_FOUND, 'you are not admin of the group');
  }

  const doesUserExist = chat.users.some((user) => user.userId.toString() == userToToggleId.toString());

  if (doesUserExist) {
    chat.users = chat.users.filter((item) => item.userId.toString() !== userToToggleId.toString());
    updated = true;
  } else {
    chat.users.push({ userId: new mongoose.Types.ObjectId(userToToggleId), isRequestAccepted: false, isStarred: false });

    updated = true;
  }
  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, ' group not found');
  }
  return await chat.save();
};

export const leaveGroupByUserId = async (userID: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);
  let updated = false;
  if (!chat?.isGroupChat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'not group chat');
  }

  const doesUserExist = chat.users.find((user) => user.userId.toString() == userID.toString());

  if (doesUserExist && doesUserExist.userId.toString() == chat.groupAdmin.toString()) {
    throw new ApiError(httpStatus.NOT_FOUND, 'you are  admin of group');
  }
  if (doesUserExist) {
    chat.users = chat.users.filter((item) => item.userId.toString() !== userID.toString());

    updated = true;
  } else {
    throw new ApiError(httpStatus.NOT_FOUND, 'you are not a member of group');
  }
  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, ' group not found');
  }
  return await chat.save();
};

export const deleteChatGroupByAdmin = async (userID: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);

  if (!chat || !chat.isGroupChat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Group not found');
  }

  const isAdmin = chat.groupAdmin.toString() === userID;

  if (!isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not an admin');
  }

  await chatModel.findByIdAndDelete(chatId);

  return { message: 'Group deleted successfully' };
};

export const toggleBlock = async (userId: string, userToBlockId: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);

  const userProfile = await userProfileService.getUserProfile(userId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'chat does not exist');
  }
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'UserPRofile does not exist');
  }
  if (chat.isGroupChat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'this is a group Chat');
  }

  const doesUserExist = chat?.users.some((user) => user.userId.toString() == userId.toString());
  const doesUserToBlockExist = chat?.users.some((user) => user.userId.toString() == userToBlockId.toString());

  if (!doesUserExist || !doesUserToBlockExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'chat does not exist');
  }

  if (chat.isBlock) {
    const user = chat.blockedBy.some((item) => item.toString() === userId.toString());
    if (user) {
      chat.blockedBy = chat.blockedBy.filter((item) => item.toString() !== userId.toString());
    } else {
      chat.blockedBy.push(new mongoose.Types.ObjectId(userId));
    }
    if (chat.blockedBy.length == 0) {
      chat.isBlock = false;
    }

    const userToblockProfile = userProfile.followers.find((user) => user.userId.toString() == userToBlockId);
    const userToblockProfileFollwing = userProfile.following.find((user) => user.userId.toString() == userToBlockId);

    if (userToblockProfile) {
      userToblockProfile.isBlock = false;
    }
    if (userToblockProfileFollwing) {
      userToblockProfileFollwing.isBlock = false;
    }
    if (!userToblockProfile && !userToblockProfileFollwing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User to block not found');
    }
  } else {
    chat.isBlock = true;
    const userExists = chat.blockedBy.some((item) => item.toString() === userId.toString());
    if (!userExists) {
      chat.blockedBy.push(new mongoose.Types.ObjectId(userId));
    }

    const userToblockProfile = userProfile.followers.find((user) => user.userId.toString() == userToBlockId);
    const userToblockProfileFollwing = userProfile.following.find((user) => user.userId.toString() == userToBlockId);
    if (userToblockProfile) {
      userToblockProfile.isBlock = true;
    }
    if (userToblockProfileFollwing) {
      userToblockProfileFollwing.isBlock = true;
    }
    if (!userToblockProfile && !userToblockProfileFollwing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User to block not found ');
    }
  }

  await userProfile.save();
  return await chat.save();
};

export const acceptSingleRequest = async (userId: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);

  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'no chat found');
  }

  if (chat?.isRequestAccepted) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already accepted');
  }

  if (chat?.groupAdmin.toString() == userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not allowed');
  }

  chat.isRequestAccepted = true;

  return await chat.save();
};

export const acceptGroupRequest = async (userId: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);

  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No chat found');
  }
  const user = chat.users.find((user) => user.userId.toString() === userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found in chat');
  }

  if (user.isRequestAccepted) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already accepted');
  }

  if (chat.groupAdmin.toString() === userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not allowed');
  }

  user.isRequestAccepted = true;

  return await chat.save();
};

export const toggleStarredStatus = async (userId: string, chatId: string) => {
  const chat = await chatModel.findById(chatId);

  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No chat found');
  }
  const user = chat.users.find((user) => user.userId.toString() === userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found in chat');
  }

  if (user.isStarred) {
    user.isStarred = false;
  } else {
    user.isStarred = true;
  }

  return await chat.save();
};

export const messageNotification = async (userId: string = '', page: number = 1, limit: number = 10) => {
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
    chat.users.map((user) => {
      if (typeof user.userId === 'object' && user.userId._id) {
        return user.userId._id.toString();
      }
      return user.userId.toString();
    })
  );

  const uniqueUserIds = [...new Set(userIds)];

  const userProfiles = await UserProfile.find({ users_id: { $in: uniqueUserIds } })
    .select('profile_dp users_id')
    .lean();

  const allChats = filteredChats.map((chat) => {
    let profileDp: string | null = null;

    if (!chat.isGroupChat) {
      const otherUser = chat.users.find((user) => user.userId._id.toString() !== userId.toString());

      if (otherUser) {
        const userProfile = userProfiles.find((profile) => profile.users_id.toString() === otherUser.userId._id.toString());
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
