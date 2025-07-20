import { userIdExtend } from 'src/config/userIDType';

import { Response } from 'express';
import httpStatus from 'http-status';
import { messageService } from '.';
import { chatService } from '../chat';
import { chatInterface } from '../chat/chat.interface';
import { ApiError } from '../errors';
import mongoose from 'mongoose';

export const sendMessge = async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { content, chatId, media, UserProfileId } = req.body;

  try {
    if (UserID) {
      const chat: chatInterface | null = await chatService.getChatById(chatId);
      const doesUserExist = chat?.users.some((user) => user.userId._id.toString() == UserID);
      const user = chat?.users.find((user) => user.userId.toString() === UserID);

      if (!doesUserExist || chat?.isBlock) {
        throw new ApiError(httpStatus.NOT_FOUND, 'you are not authorized');
      }

      if (!chat?.isRequestAccepted && chat?.groupAdmin.toString() !== UserID && !chat?.isGroupChat) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Please accept the request to send message');
      }
      if (chat?.groupAdmin.toString() !== UserID && !user?.isRequestAccepted && chat?.isGroupChat) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Please accept the request to send message');
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

export const UpdateMessageIsSeen = async (req: userIdExtend, res: Response) => {
  const { messageId } = req.params;
  const { readByUserId } = req.body;

  try {
    if (messageId) {
      const message = await messageService.updateMessageSeen(messageId, readByUserId);
      return res.status(200).json(message);
    }
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const reactToMessage = async (req: userIdExtend, res: Response) => {
  const { messageId, emoji } = req.body;

  try {
    if (messageId && req.userId && emoji) {
      let message = await messageService.reactToMessage(new mongoose.Types.ObjectId(messageId), req.userId, emoji);
      return res.status(200).json({ message });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
