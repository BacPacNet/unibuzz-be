import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as userService from './user.service';
// import { notificationService } from '../Notification';
// import { io } from '../../index';
// import { notificationRoleAccess } from '../Notification/notification.interface';
import { userIdExtend } from 'src/config/userIDType';
import { loginEmailVerificationService } from '../loginEmailVerification';
import { communityService } from '../community';
import { communityGroupService } from '../communityGroup';
import { redis } from '../../config/redis';
//import { redis } from '../../config/redis';

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

export const getUser = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params['userId'] as string;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID');
    }

    const user = await userService.getUserProfileById(new mongoose.Types.ObjectId(userId));
    if (!user) {
      return next(new ApiError(httpStatus.NOT_FOUND, 'User not found'));
    }
    res.status(httpStatus.OK).json(user);
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error on get user');
  }
});

export const getUserByUsername = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userName = req.params['userName'] as string;

    if (!userName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Username is required');
    }

    const user = await userService.getUserProfileByUsername(userName);
    if (!user) {
      return next(new ApiError(httpStatus.NOT_FOUND, 'User not found'));
    }
    res.status(httpStatus.OK).json(user);
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error on get user');
  }
});

export const getAllUser = catchAsync(async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { page, limit, name, universityName, studyYear, major, occupation, affiliation } = req.query as any;
  try {
    let allUsers = await userService.getAllUser(
      name,
      Number(page),
      Number(limit),
      req.userId as string,
      universityName,
      studyYear ? studyYear.split(',') : [],
      major ? major.split(',') : [],
      occupation ? occupation.split(',') : [],
      affiliation ? affiliation.split(',') : []
    );
    return res.status(200).json(allUsers);
  } catch (error) {
    console.error(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Users'));
  }
});

export const updateUser = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params['userId'];

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID');
    }

    const user = await userService.updateUserById(new mongoose.Types.ObjectId(userId), req.body);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Clear cache for this user
    const cacheKey = `cache:${req.originalUrl}`;
    console.log(cacheKey, 'cacheKey');
    await redis.del(cacheKey);

    res.status(httpStatus.OK).json({
      status: 'success',
      data: user,
    });
  } catch (error: any) {
    next(new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message));
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
      const communityGroup = await communityGroupService.getCommunityGroup(communityGroupId);
      if (userID !== String(communityGroup?.adminUserId)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin Allowed!');
      }
      let user = await userService.updateUserCommunityGroupRole(id, communityGroupId, role);
      // const notifications = {
      //   sender_id: userID,
      //   receiverId: id,
      //   communityGroupId: communityGroupId,
      //   type: notificationRoleAccess.ASSIGN,
      //   message: `assigned you as ${role}`,
      // };

      // await notificationService.CreateNotification(notifications);
      // io.emit(`notification_${id}`, { type: notificationRoleAccess.ASSIGN });
      return res.status(200).json({ user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateUserCommunityRole = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId, role, userID } = req.body;
  const adminID = req.userId;

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
      const community = await communityService.getCommunity(communityId);
      if (adminID !== String(community?.adminId)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Only Admin Allowed!');
      }
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
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const checkUserEmailAvailability = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    await userService.UserEmailAvailability(email);
    return res.status(httpStatus.OK).json({ message: 'Email is available', isAvailable: true });
  } catch (error: any) {
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const changeUserName = async (req: userIdExtend, res: Response) => {
  const { userName, newUserName, password } = req.body;
  const userID = req.userId;

  try {
    if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    const user = await userService.changeUserName(userID, userName, newUserName, password);
    return res.status(httpStatus.OK).json(user);
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const changeUserPassword = async (req: userIdExtend, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userID = req.userId;

  try {
    if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    const user = await userService.changeUserPassword(userID, currentPassword, newPassword);
    return res.status(httpStatus.OK).json(user);
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const changeEmail = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { currentEmail, newMail, emailOtp } = req.body;

  try {
    if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    await loginEmailVerificationService.checkloginEmailVerificationOtp(emailOtp, newMail);
    let userProfile = await userService.changeUserEmail(userID, currentEmail, newMail);
    return res.status(200).json(userProfile);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const deActivateUserAccount = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { userName, email, Password } = req.body;

  try {
    if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    let userProfile = await userService.deActivateUserAccount(userID, userName, email, Password);
    return res.status(200).json(userProfile);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
