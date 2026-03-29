import { Response } from 'express';
import httpStatus from 'http-status';
import { notificationModel, notificationService } from '.';
import { communityGroupService } from '../communityGroup';
import { notificationStatus } from './notification.interface';
import { convertToObjectId, parsePagination, requireAuthenticatedUserIdOrThrow } from '../../utils/common';
import catchAsync from '../utils/catchAsync';
import { userIdExtend } from '../../config/userIDType';
import { ApiError } from '../errors';



export const getGroupNotification = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const { page, limit } = parsePagination(req.query);

  const notification = await notificationService.getUserNotification(userID, page, limit);
  return res.status(httpStatus.OK).json(notification);
});

export const getUserNotification = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const { page, limit } = parsePagination(req.query);

  const notification = await notificationService.getUserNotificationMain(userID, page, limit);
  return res.status(httpStatus.OK).json(notification);
});

export const markUserNotificationsAsRead = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);

  const notification = await notificationService.markNotificationsAsRead(userID);
  return res.status(httpStatus.OK).json(notification);
});

export const getUserNotificationTotalCount = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);

  const notification = await notificationService.getUserNotificationCount(userID);
  return res.status(httpStatus.OK).json(notification);
});

export const updateGroupNotification = catchAsync(async (req: userIdExtend, res: Response) => {
  const { id } = req.body;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Notification ID is required');
  }

  const notification = await notificationService.updateUserNotification(id, notificationStatus.default);
  return res.status(httpStatus.OK).json({ notification });
});

export const JoinGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const { id, groupId } = req.body;

  if (!id || !groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Notification ID and Group ID are required');
  }

  const notificationExists = await notificationModel.findOne(
    { _id: convertToObjectId(id), receiverId: userID },
    { _id: 1 }
  );
  if (!notificationExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification does not exist');
  }

  const acceptRequest = await communityGroupService.acceptCommunityGroupJoinApproval(convertToObjectId(groupId), userID);
  await notificationService.updateUserNotification(id, notificationStatus.accepted);
  return res.status(httpStatus.OK).json({ message: 'Group joined successfully', data: acceptRequest });
});
