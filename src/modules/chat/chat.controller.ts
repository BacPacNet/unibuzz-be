import httpStatus from 'http-status';
import { userIdExtend } from 'src/config/userIDType';
import { chatService } from '.';
import { Response } from 'express';
import { userProfileService } from '../userProfile';

export const Create_Get_Chat = async (req: userIdExtend, res: Response) => {
  const YourUserID = req.userId;
  const { userId } = req.body;

  try {
    if (!YourUserID || !userId) {
      throw new Error('Invalid user id'); // throw error if user id is invalid
    }

    const chat: any = await chatService.getChat(YourUserID, userId);
    if (chat.length > 0) {
      return res.status(200).json(chat[0]);
    } else {
      const userProfile = await userProfileService.getUserProfile(YourUserID);
      const followingIds = userProfile?.following.map((id: any) => id.userId._id.toString());
      const followersIds = userProfile?.followers.map((id: any) => id.userId._id.toString());

      const isRequestAcceptedBoolean = (followingIds?.includes(userId) && followersIds?.includes(userId)) ?? false;
      const newChat = await chatService.createChat(YourUserID, userId, isRequestAcceptedBoolean);
      return res.status(200).json(newChat);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserChats = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;

  try {
    if (userID) {
      const chats = await chatService.getUserChats(userID);
      return res.status(200).json(chats);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserMessageNotification = async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { page, limit } = req.query;
  try {
    let message = await chatService.messageNotification(UserID, Number(page), Number(limit));
    return res.status(200).json({ message });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const getUserMessageNotificationTotalCount = async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;

  try {
    if (!UserID) throw new Error('Invalid user id');
    const messageTotalCount = await chatService.messageNotificationTotalCount(UserID);
    return res.status(200).json({ messageTotalCount });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const CreateGroupChat = async (req: userIdExtend, res: Response) => {
  const { users, groupName, groupDescription, groupLogo } = req.body;
  const userID = req.userId;

  try {
    if (users && userID) {
      const userProfile = await userProfileService.getUserProfile(userID);
      const followingIds = userProfile?.following.map((id: any) => id.userId._id.toString());
      const followersIds = userProfile?.followers.map((id: any) => id.userId._id.toString());

      const usersToAdd = users?.map((user: any) => {
        const acceptRequest = followersIds?.includes(user) && followingIds?.includes(user);

        return {
          user,
          acceptRequest,
        };
      });

      const newGroup = await chatService.createGroupChat(userID, usersToAdd, groupName, groupDescription, groupLogo);
      return res.status(201).json(newGroup);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const EditGroupChat = async (req: userIdExtend, res: Response) => {
  const { users, groupName, groupLogo } = req.body;
  const userID = req.userId;
  const { chatId } = req.params;
  try {
    if (userID && chatId) {
      const userProfile = await userProfileService.getUserProfile(userID);
      const followingIds = userProfile?.following.map((id: any) => id.userId._id.toString());
      const followersIds = userProfile?.followers.map((id: any) => id.userId._id.toString());

      const usersToAdd =
        users
          ?.filter((user: any) => user != null)
          ?.map((user: any) => {
            const acceptRequest = followersIds?.includes(user) && followingIds?.includes(user);
            return {
              user,
              acceptRequest,
            };
          }) || [];

      const updatedGroup = await chatService.editGroupChat(chatId, usersToAdd, groupName, groupLogo);

      return res.status(201).json(updatedGroup);
    }
  } catch (error: any) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const ToggleAddToGroup = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userToToggleId } = req.body;
  const { chatId } = req.params;

  try {
    if (userID && chatId) {
      await chatService.toggleAddToGroup(userID, userToToggleId, chatId);

      return res.status(201).json({ id: userToToggleId });
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveGroup = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.params;
  try {
    if (userID && chatId) {
      const newGroup = await chatService.leaveGroupByUserId(userID, chatId);
      return res.status(201).json(newGroup);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const deleteChatGroup = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.params;
  try {
    if (userID && chatId) {
      const newGroup = await chatService.deleteChatGroupByAdmin(userID, chatId);
      return res.status(201).json(newGroup);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const toggleBlock = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userIdToBlock } = req.params;
  const { chatId } = req.body;

  try {
    if (userID && userIdToBlock) {
      const blocked = await chatService.toggleBlock(userID, userIdToBlock, chatId);
      return res.status(201).json(blocked);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const acceptSingleRequest = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;

  try {
    if (userID) {
      const acceptedRequest = await chatService.acceptSingleRequest(userID, chatId);
      return res.status(201).json(acceptedRequest);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const acceptGroupRequest = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;
  try {
    if (userID) {
      const acceptedRequest = await chatService.acceptGroupRequest(userID, chatId);
      return res.status(201).json(acceptedRequest);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const toggleStarred = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { chatId } = req.body;
  try {
    if (userID) {
      const acceptedRequest = await chatService.toggleStarredStatus(userID, chatId);
      return res.status(201).json(acceptedRequest);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
