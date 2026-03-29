import { userIdExtend } from '../../config/userIDType';
import { Response } from 'express';
import httpStatus from 'http-status';
import { messageService } from '.';
import { chatService } from '../chat';
import { chatInterface } from '../chat/chat.interface';
import { ApiError } from '../errors';
import mongoose from 'mongoose';
import { userService } from '../user';
import { userProfileService } from '../userProfile';
import type { BlockedUserEntry } from '../userProfile/userProfile.interface';
import catchAsync from '../utils/catchAsync';

function isBlocked(
  profile: { blockedUsers?: BlockedUserEntry[] } | null,
  userId: string
): boolean {
  return (profile?.blockedUsers ?? []).some((b: BlockedUserEntry) => b.userId.toString() === userId);
}

export const sendMessge = catchAsync(async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { content, chatId, media, UserProfileId } = req.body;

  if (!UserID) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const chat: chatInterface | null = await chatService.getChatById(chatId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  const doesUserExist = chat.users.some((user) => user.userId._id.toString() == UserID);
  const user = chat.users.find((user) => user.userId.toString() === UserID);

  if (!chat.isGroupChat) {
    const otherUser = chat.users.find((user) => user.userId.toString() !== UserID);
    const otherUserId = otherUser?.userId?.toString() ?? '';
    const [yourUserDetails, theirUserDetails] = await Promise.all([
      userService.getUserById(new mongoose.Types.ObjectId(UserID)),
      userService.getUserById(new mongoose.Types.ObjectId(otherUserId)),
    ]);

    const [yourUserProfile, theirUserProfile] = await Promise.all([
      userProfileService.getUserProfileById(UserID),
      userProfileService.getUserProfileById(otherUserId),
    ]);

    if (yourUserDetails?.isDeleted || theirUserDetails?.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User is deleted');
    }

    if (isBlocked(yourUserProfile, otherUserId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are blocked by this user');
    }

    if (isBlocked(theirUserProfile, UserID)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are blocked by this user');
    }
  }

  if (!doesUserExist || chat.isBlock) {
    throw new ApiError(httpStatus.FORBIDDEN, 'you are not authorized');
  }

  if (!chat.isRequestAccepted && chat.groupAdmin.toString() !== UserID && !chat.isGroupChat) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Please accept the request to send message');
  }
  if (chat.groupAdmin.toString() !== UserID && !user?.isRequestAccepted && chat.isGroupChat) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Please accept the request to send message');
  }

  const newMessge = await messageService.createmessage(UserID, content, UserProfileId, chatId, media);
  return res.status(200).json(newMessge);
});

export const getUserMessages = catchAsync(async (req: userIdExtend, res: Response) => {
  const UserID = req.userId;
  const { chatId } = req.params;

  if (!UserID || !chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID and chat ID are required');
  }

  const message = await messageService.getMessages(chatId, UserID);
  return res.status(200).json(message);
});

export const UpdateMessageIsSeen = catchAsync(async (req: userIdExtend, res: Response) => {
  const { messageId } = req.params;
  const { readByUserId } = req.body;

  if (!messageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Message ID is required');
  }

  const message = await messageService.updateMessageSeen(messageId, readByUserId);
  return res.status(200).json(message);
});

export const reactToMessage = catchAsync(async (req: userIdExtend, res: Response) => {
  const { messageId, emoji } = req.body;

  if (!messageId || !req.userId || !emoji) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Message ID, user ID and emoji are required');
  }

  const message = await messageService.reactToMessage(new mongoose.Types.ObjectId(messageId), req.userId, emoji);
  return res.status(200).json({ message });
});
