import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { parseUserIdOrThrow, requireAuthenticatedUserIdOrThrow } from '../../utils/common';
import { IOptions } from '../paginate/paginate';
import * as userService from './user.service';
import { userIdExtend } from '../../config/userIDType';
import { userProfileService } from '../userProfile';
import { BlockedUserEntry } from '../userProfile/userProfile.interface';
import { GetAllUserQuery } from './user.interfaces';
import { whitelistRewardCommunityService } from '../whitelistRewardCommunity';

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

export const getUser = catchAsync(async (req: userIdExtend, res: Response): Promise<void> => {
  const userIdObj = parseUserIdOrThrow(req.params['userId']);
  const userIdStr = userIdObj.toString();
  const myUserId = req.userId;

  const myProfile = await userProfileService.getUserProfileById(myUserId as string);
  let isBlocked = false;
  if (myProfile?.blockedUsers.some((user: BlockedUserEntry) => user.userId.toString() === userIdStr)) {
    isBlocked = true;
  }

  const user = await userService.getUserProfileById(userIdObj, myUserId as string);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.isBlocked = isBlocked;
  res.status(httpStatus.OK).json(user);
});

export const getAllUser = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit, name, universityName, studyYear, major, occupation, affiliation, chatId,role } = req.query as GetAllUserQuery;
  const allUsers = await userService.getAllUser(
    name ?? '',
    Number(page),
    Number(limit),
    req.userId as string,
    universityName ?? '',
    studyYear ? studyYear.split(',') : [],
    major ? major.split(',') : [],
    occupation ? occupation.split(',') : [],
    affiliation ? affiliation.split(',') : [],
    chatId ?? '',
    role?.toLowerCase() ?? ''
  );
  res.status(httpStatus.OK).json(allUsers);
});



export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const softDeleteUser = catchAsync(async (req: userIdExtend, res: Response) => {
  const userId = parseUserIdOrThrow(req.userId);
  const { password } = req.body;
  await userService.softDeleteUserById(userId, password);
  res.status(httpStatus.NO_CONTENT).json({ message: 'User deleted successfully' });
});

export const checkUserEmailAndUserNameAvailability = async (req: Request, res: Response) => {
  const { email, userName } = req.body;

  try {
    await userService.userEmailAndUserNameAvailability(email, userName);
    return res.status(httpStatus.OK).json({ message: 'Email and username are available', isAvailable: true });
  } catch (error: any) {
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const checkUserEmailAvailability = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    await userService.userEmailAvailability(email);
    return res.status(httpStatus.OK).json({ message: 'Email is available', isAvailable: true });
  } catch (error: any) {
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const changeUserName = catchAsync(async (req: userIdExtend, res: Response) => {
  const { userName, newUserName, password } = req.body;
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const user = await userService.changeUserName(userID, userName, newUserName, password);
  res.status(httpStatus.OK).json(user);
});

export const changeUserPassword = catchAsync(async (req: userIdExtend, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const user = await userService.changeUserPassword(userID, currentPassword, newPassword);
  res.status(httpStatus.OK).json(user);
});



export const deActivateUserAccount = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const { userName, email, Password } = req.body;
  const userProfile = await userService.deActivateUserAccount(userID, userName, email, Password);
  res.status(httpStatus.OK).json(userProfile);
});

export const IsNewUserToggle = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireAuthenticatedUserIdOrThrow(req);
  const UserData = await userService.IsNewUserFalse(userID);
  res.status(httpStatus.OK).json({ message: 'success', UserData });
});

export const getReferredUsers = catchAsync(async (req: userIdExtend, res: Response): Promise<void> => {
  const userId = parseUserIdOrThrow(req.userId);
  const { page, limit } = req.query as { page?: string; limit?: string };

  const result = await userService.getReferredUsers(
    userId,
    page ? Number(page) : 1,
    limit ? Number(limit) : 10
  );

  // Get all user profiles in one query to avoid N+1 queries
  const referralIds = result.referrals.map((referral) => new mongoose.Types.ObjectId(referral._id));
  const profiles = await userProfileService.getUserProfiles(referralIds);

  // Map profiles to referrals
  const referralsWithProfiles = result.referrals.map((referral) => {
    const profile = profiles.find((p) => p.users_id.toString() === referral._id.toString());
    return {
      ...referral,
      profile: profile || null,
    };
  });

  res.status(httpStatus.OK).json({
    referCode: result.referCode,
    totalReferrals: result.totalReferrals,
    currentPage: result.currentPage,
    totalPages: result.totalPages,
    referrals: referralsWithProfiles,
  });
});



export const getRewards = catchAsync(async (req: userIdExtend, res: Response): Promise<void> => {
  const userId = parseUserIdOrThrow(req.userId);
  const result = await userService.getRewardsDetails(
    userId,
  );

  res.status(httpStatus.OK).json({
    referCode: result.referCode,
    totalInvites: result.totalInvites,
    totalEarning: result.totalEarning,
    thisMonthProgress: result.thisMonthProgress,
    previousMonthProgress: result.previousMonthProgress,
    thisMonthReward: result.thisMonthReward,
    previousMonthReward: result.previousMonthReward,
    thisMonthLeftoverInvites: result.thisMonthLeftoverInvites,
    previousMonthLeftoverInvites: result.previousMonthLeftoverInvites,
    currentUPI: result.currentUPI
    // previousMonthRedeemed: result.previousMonthmoRedeemed,
  });
});

export const isUserEligibleForRewards = catchAsync(async (req: userIdExtend, res: Response): Promise<void> => {

  
  const userId = parseUserIdOrThrow(req.userId);
  const eligible = await whitelistRewardCommunityService.isUserEligibleForRewards(userId);
  res.status(httpStatus.OK).json({ eligible });
});