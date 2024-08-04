import mongoose from 'mongoose';
import { UserProfile, userProfileService } from '../userProfile';
import { chatInterface } from './chat.interface';
import chatModel from './chat.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const getChat = async (yourId: string, userId: string) => {
  const isChat: chatInterface[] = await chatModel
    .find({
      isGroupChat: false,
      $and: [{ users: { $elemMatch: { $eq: yourId } } }, { users: { $elemMatch: { $eq: userId } } }],
    })
    .populate([{ path: 'users', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const userProfiledata = await UserProfile.find({ users_id: userId }).select('profile_dp  users_id');

  const ChatWithDp = isChat.map((item) => ({
    ...item,
    ProfileDp: userProfiledata.find((profile) => profile.users_id.toString() !== yourId)?.profile_dp?.imageUrl ?? null,
  }));

  return ChatWithDp;
};

export const getChatById = async (chatId: string) => {
  return await chatModel.findById(chatId);
};

export const createChat = async (yourId: string, userId: string) => {
  const chatToCreate = {
    chatName: 'OneToOne',
    isGroupChat: false,
    users: [yourId, userId],
  };
  const chat = await chatModel.create(chatToCreate);

  const createdChat: chatInterface[] | null = await chatModel
    .findById(chat._id)
    .populate([{ path: 'users', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const userProfiledata = await UserProfile.find({ users_id: userId }).select('profile_dp  users_id');

  const ChatWithDp = {
    ...createdChat,
    ProfileDp: userProfiledata.find((profile) => profile.users_id.toString() !== yourId)?.profile_dp?.imageUrl ?? null,
  };

  return ChatWithDp;
};

export const getUserChats = async (userId: string) => {
  const chats: (chatInterface & { _id: string })[] = await chatModel
    .find({ users: userId })
    .populate([{ path: 'users', select: 'firstName lastName' }, { path: 'latestMessage' }])
    .lean();

  const userIds = chats.flatMap((chat) => chat.users.map((user) => user._id));
  const uniqueuserIds = new Set(userIds);
  const userProfiles = await UserProfile.find({ users_id: { $in: [...uniqueuserIds] } })
    .select('profile_dp  users_id')
    .lean();

  const allChats = chats.map((chat) => {
    let profileDp = null;

    if (!chat.isGroupChat) {
      const otherUser = chat.users.find((user) => user._id.toString() !== userId.toString());
      if (otherUser) {
        const userProfile = userProfiles.find((profile) => profile.users_id.toString() === otherUser._id.toString());
        profileDp = userProfile ? userProfile.profile_dp?.imageUrl : null;
      }
    } else {
      chat.users = chat.users.map((user) => {
        const userProfile =
          userProfiles.find((profile) => profile.users_id.toString() === user._id.toString())?.profile_dp?.imageUrl ?? null;
        return {
          ...user,
          ProfileDp: userProfile || null,
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

export const createGroupChat = async (
  userID: string,
  users: string[],
  groupName: string,
  groupDescription: string,
  groupLogo: { imageUrl: string; publicId: string }
) => {
  const NewGroupData = {
    chatName: groupName,
    users: [...users, userID],
    isGroupChat: true,
    groupAdmin: userID,
    groupDescription,
    groupLogo,
  };

  const newGroup = await chatModel.create(NewGroupData);
  return newGroup;
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

  const doesUserExist = chat.users.some((user) => user.toString() == userToToggleId.toString());

  if (doesUserExist) {
    chat.users = chat.users.filter((item) => item.toString() !== userToToggleId.toString());
    updated = true;
  } else {
    chat.users.push(new mongoose.Types.ObjectId(userToToggleId));

    updated = true;
  }
  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, ' group not found');
  }
  return await chat.save();
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

  const doesUserExist = chat?.users.some((user) => user.toString() == userId.toString());
  const doesUserToBlockExist = chat?.users.some((user) => user.toString() == userToBlockId.toString());

  if (!doesUserExist || !doesUserToBlockExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'chat does not exist');
  }

  if (chat.isBlock) {
    chat.isBlock = false;

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
