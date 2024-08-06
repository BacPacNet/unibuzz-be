import httpStatus from 'http-status';
import { userIdExtend } from 'src/config/userIDType';
import { chatService } from '.';
import { Response } from 'express';

export const Create_Get_Chat = async (req: userIdExtend, res: Response) => {
  const YourUserID = req.userId;
  const { userId } = req.body;
  try {
    if (YourUserID) {
      const chat: any = await chatService.getChat(YourUserID, userId);
      if (chat.length > 0) {
        return res.status(200).json(chat);
      } else {
        const newChat = await chatService.createChat(YourUserID, userId);
        return res.status(200).json(newChat);
      }
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

export const CreateGroupChat = async (req: userIdExtend, res: Response) => {
  const { users, groupName, groupDescription, groupLogo } = req.body;
  const userID = req.userId;
  try {
    if (users && userID) {
      const newGroup = await chatService.createGroupChat(userID, users, groupName, groupDescription, groupLogo);
      return res.status(201).json(newGroup);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const ToggleAddToGroup = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userToToggleId } = req.body;
  const { chatId } = req.params;
  try {
    if (userID && chatId) {
      const newGroup = await chatService.toggleAddToGroup(userID, userToToggleId, chatId);
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
