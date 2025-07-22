import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { pushNotificationService } from './';

interface extendedRequest extends Request {
  userId?: string;
}
export const CreatePushNotificationToken = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const userID = req.userId;
  const { token } = req.body;

  try {
    if (!userID) return next(new ApiError(httpStatus.NOT_FOUND, 'userId Required'));

    const created = await pushNotificationService.createPushNotification(userID, token);

    return res.status(201).json({ message: 'Bug report submitted successfully.', created });
  } catch (error) {
    next(error);
  }
};

export const sendNotification = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { userID } = req.params;
  try {
    if (!userID) return next(new ApiError(httpStatus.NOT_FOUND, 'userId Required'));

    const created = await pushNotificationService.sendPushNotification(userID, 'BE', "Let's go!");

    return res.status(201).json({ message: 'pushed notification', created });
  } catch (error) {
    next(error);
  }
};
