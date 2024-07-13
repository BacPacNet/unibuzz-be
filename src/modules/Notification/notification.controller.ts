import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { notificationService } from '.';
import { communityGroupService } from '../communityGroup';

interface extendedRequest extends Request {
  userId?: string;
}

export const getGroupNotification = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;

  try {
    if (userID) {
      const notification = await notificationService.getUserNotification(userID);
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
      const notification = await notificationService.updateUserNotification(id);

      return res.status(200).json({ notification });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const JoinGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { id, groupId } = req.body;

  let status;
  try {
    if (userID && groupId) {
      status = await communityGroupService.joinLeaveCommunityGroup(userID, groupId, 'Member');
      await notificationService.updateUserNotification(id);
      return res.status(200).json(status);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
