import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { notificationModel, notificationService } from '.';
import { communityGroupService } from '../communityGroup';
import { notificationStatus } from './notification.interface';
import { convertToObjectId } from '../../utils/common';

interface extendedRequest extends Request {
  userId?: string;
}

export const getGroupNotification = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { page, limit } = req.query;
  try {
    if (userID) {
      const notification = await notificationService.getUserNotification(userID, Number(page), Number(limit));
      return res.status(200).json(notification);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const getUserNotification = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { page, limit } = req.query;

  try {
    if (userID) {
      const notification = await notificationService.getUserNotificationMain(userID, Number(page), Number(limit));
      return res.status(200).json(notification);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const markUserNotificationsAsRead = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;

  try {
    if (userID) {
      const notification = await notificationService.markNotificationsAsRead(userID);
      return res.status(200).json(notification);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserNotificationTotalCount = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;

  try {
    if (userID) {
      const notification = await notificationService.getUserNotificationCount(userID);
      return res.status(200).json(notification);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateGroupNotification = async (req: extendedRequest, res: Response) => {
  const { id } = req.body;

  try {
    if (id) {
      const notification = await notificationService.updateUserNotification(id, notificationStatus.default);

      return res.status(200).json({ notification });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const JoinGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { id, groupId } = req.body;

  try {
    if (userID && groupId) {
      const checkIfNotificationExist = await notificationModel.find({ _id: convertToObjectId(id), receiverId: userID });
      if (!checkIfNotificationExist) {
        throw new Error('Notification does not exist');
      }

      //  const status = await communityGroupService.joinCommunityGroup(userID, groupId);
      const acceptRequest = await communityGroupService.acceptCommunityGroupJoinApproval(convertToObjectId(groupId), userID);
      await notificationService.updateUserNotification(id, notificationStatus.accepted);
      return res.status(200).json({ message: 'Group joined successfully', data: acceptRequest });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
