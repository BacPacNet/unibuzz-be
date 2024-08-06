import { userIdExtend } from 'src/config/userIDType';

import { Response } from 'express';
import httpStatus from 'http-status';
import { messageService } from '.';
import { chatService } from '../chat';
import { chatInterface } from '../chat/chat.interface';
import { ApiError } from '../errors';

export const sendMessge = async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { content, chatId, media, UserProfileId } = req.body;

  try {
    if (UserID) {
      const chat: chatInterface | null = await chatService.getChatById(chatId);
      const doesUserExist = chat?.users.some((user) => user.toString() == UserID);

      if (!doesUserExist || chat?.isBlock) {
        throw new ApiError(httpStatus.NOT_FOUND, 'you are not authorized');
      }
      const newMessge = await messageService.createmessage(UserID, content, UserProfileId, chatId, media);
      return res.status(200).json(newMessge);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserMessages = async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { chatId } = req.params;
  try {
    if (UserID && chatId) {
      const message = await messageService.getMessages(chatId);
      return res.status(200).json(message);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
