import httpStatus from 'http-status';
import { userIdExtend } from 'src/config/userIDType';
import { chatService } from '.';
import { Response } from 'express';
import { userProfileService } from '../userProfile';
import catchAsync from '../utils/catchAsync';
import { ApiError } from '../errors';

export const Create_Get_Chat = catchAsync(async (req: userIdExtend, res: Response) => {
  const YourUserID = req.userId;
  const { userId } = req.body;

  if (!YourUserID || !userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }

  const chat: any = await chatService.getChat(YourUserID, userId);
  if (chat.length > 0) {
    return res.status(httpStatus.OK).json(chat[0]);
  }

  const userProfile = await userProfileService.getUserProfile(YourUserID);
  const followingIds = userProfile?.following.map((id: any) => id.userId._id.toString());
  const followersIds = userProfile?.followers.map((id: any) => id.userId._id.toString());

  const isRequestAcceptedBoolean = (followingIds?.includes(userId) && followersIds?.includes(userId)) ?? false;
  const newChat = await chatService.createChat(YourUserID, userId, isRequestAcceptedBoolean);
  return res.status(httpStatus.OK).json(newChat);
});

export const getUserChats = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;

  if (!userID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }
  const chats = await chatService.getUserChats(userID);
  return res.status(httpStatus.OK).json(chats);
});

export const getUserMessageNotification = catchAsync(async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { page, limit } = req.query;
  const message = await chatService.messageNotification(UserID, Number(page), Number(limit));
  return res.status(httpStatus.OK).json({ message });
});

export const getUserMessageNotificationTotalCount = catchAsync(async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;

  if (!UserID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }
  const messageTotalCount = await chatService.messageNotificationTotalCount(UserID);
  return res.status(httpStatus.OK).json({ messageTotalCount });
});

export const CreateGroupChat = catchAsync(async (req: userIdExtend, res: Response) => {
  const { users, groupName, groupDescription, groupLogo, community } = req.body;
  const userID = req.userId;

  if (!users || !userID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Users and user id are required');
  }

  const userProfile = await userProfileService.getUserProfile(userID);
  const followingIds = userProfile?.following.map((id: any) => id.userId._id.toString());
  const followersIds = userProfile?.followers.map((id: any) => id.userId._id.toString());

  const usersToAdd = users?.map((user: any) => {
    const acceptRequest = followersIds?.includes(user) && followingIds?.includes(user);

    return {
      userId: user,
      acceptRequest,
    };
  });

  const newGroup = await chatService.createGroupChat(
    userID,
    usersToAdd,
    groupName,
    groupDescription,
    groupLogo,
    community
  );
  return res.status(httpStatus.CREATED).json(newGroup);
});

export const EditGroupChat = catchAsync(async (req: userIdExtend, res: Response) => {
  const { users = [], groupName, groupLogo } = req.body;
  const userID = req.userId;
  const { chatId } = req.params;

  if (!userID || !chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required parameters');
  }

  const userProfile = await userProfileService.getUserProfile(userID);

  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
  }

  const followingIds = new Set(userProfile.following?.map((f: any) => f.userId?.toString()).filter(Boolean) || []);
  const followersIds = new Set(userProfile.followers?.map((f: any) => f.userId?.toString()).filter(Boolean) || []);

  const usersToAdd = users
    .filter((userId: string) => userId !== null && userId !== undefined)
    .map((userId: string) => {
      const userIdStr = userId.toString();
      const isMutualFollow = followingIds.has(userIdStr) && followersIds.has(userIdStr);
      return {
        userId: userIdStr,
        acceptRequest: isMutualFollow,
      };
    });

  const updatedGroup = await chatService.editGroupChatV2(chatId, usersToAdd, groupName, groupLogo);

  return res.status(httpStatus.OK).json(updatedGroup);
});

export const GetGroupChatMember = catchAsync(async (req: userIdExtend, res: Response) => {
  const { groupId } = req.params;
  const userID = req.userId;

  if (!userID || !groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User id and group id are required');
  }
  const members = await chatService.getGroupChatMembers(userID, groupId);
  return res.status(httpStatus.CREATED).json({ members });
});

export const ToggleAddToGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userToToggleId } = req.body;
  const { chatId } = req.params;

  if (!userID || !chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User id and chat id are required');
  }
  await chatService.toggleAddToGroup(userID, userToToggleId, chatId);

  return res.status(httpStatus.CREATED).json({ id: userToToggleId });
});

export const leaveGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.params;

  if (!userID || !chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User id and chat id are required');
  }
  const newGroup = await chatService.leaveGroupByUserId(userID, chatId);
  return res.status(httpStatus.CREATED).json(newGroup);
});

export const deleteChatGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.params;

  if (!userID || !chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User id and chat id are required');
  }
  const newGroup = await chatService.deleteChatGroupByAdmin(userID, chatId);
  return res.status(httpStatus.CREATED).json(newGroup);
});



export const acceptSingleRequest = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;

  if (!userID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }
  const acceptedRequest = await chatService.acceptSingleRequest(userID, chatId);
  return res.status(httpStatus.CREATED).json(acceptedRequest);
});

export const acceptGroupRequest = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;

  if (!userID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }
  const acceptedRequest = await chatService.acceptGroupRequest(userID, chatId);
  return res.status(httpStatus.CREATED).json(acceptedRequest);
});

export const toggleStarred = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;

  if (!userID) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user id');
  }
  const result = await chatService.toggleStarredStatus(userID, chatId);
  return res.status(httpStatus.CREATED).json(result);
});
