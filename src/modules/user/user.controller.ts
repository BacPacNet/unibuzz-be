import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as userService from './user.service';
import { notificationService } from '../Notification';
import { io } from '../../index';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { userIdExtend } from 'src/config/userIDType';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send({ user });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'role']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.getUserProfileById(new mongoose.Types.ObjectId(req.params['userId']));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    res.status(200).json(user);
  }
});

export const getAllUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, name } = req.query as any;
  try {
    let allUsers = await userService.getAllUser(name, Number(page), Number(limit));
    return res.status(200).json(allUsers);
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Users'));
  }
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.updateUserById(new mongoose.Types.ObjectId(req.params['userId']), req.body);
    res.send(user);
  }
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const getUsersWithProfileData = async (req: userIdExtend, res: Response) => {
  const { name } = req.query as { name?: string };
  const userID = req.userId;
  try {
    if (userID) {
      let user = await userService.getUsersWithProfile(name, userID);
      return res.status(200).json({ user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const joinCommunity = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  const { communityName } = req.body;

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      let user = await userService.joinCommunity(new mongoose.Types.ObjectId(req.userId), communityId, communityName);
      return res.status(200).json({ message: 'joined Successfully', user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveCommunity = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      let user = await userService.leaveCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
      return res.status(200).json({ message: 'Left the community', user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const findUsersByCommunityId = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  const { privacy, name } = req.query as { name?: string; privacy?: string };
  const userID = req.userId;

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      if (userID) {
        let user = await userService.findUsersByCommunityId(communityId, privacy, name, userID);
        return res.status(200).json({ user });
      }
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const findUsersByCommunityGroupId = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityGroupId } = req.params;
  const { name } = req.query as { name?: string };
  const userID = req.userId;

  try {
    if (typeof communityGroupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityGroupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      if (userID) {
        let user = await userService.findUsersByCommunityGroupId(communityGroupId, name, userID);
        return res.status(200).json({ user });
      }
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateUserCommunityGroupRole = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityGroupId, role, id } = req.body;
  const userID = req.userId;

  try {
    if (typeof communityGroupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityGroupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      let user = await userService.updateUserCommunityGroupRole(id, communityGroupId, role);
      const notifications = {
        sender_id: userID,
        receiverId: id,
        communityGroupId: communityGroupId,
        type: notificationRoleAccess.ASSIGN,
        message: `assigned you as ${role}`,
      };

      await notificationService.CreateNotification(notifications);
      io.emit(`notification_${id}`, { type: notificationRoleAccess.ASSIGN });
      return res.status(200).json({ user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateUserCommunityRole = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId, role, userID } = req.body;
  // const userID = req.userId;

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
      let user = await userService.updateUserCommunityRole(userID, communityId, role);

      return res.status(200).json({ user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const checkUserEmailAndUserNameAvailability = async (req: Request, res: Response) => {
  const { email, userName } = req.body;

  try {
    await userService.UserEmailAndUserNameAvailability(email, userName);
    return res.status(httpStatus.OK).json({ message: 'Email and username are available', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
