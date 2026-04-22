import httpStatus from 'http-status';
import { Request, Response } from 'express';
import * as userProfileService from './userProfile.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from '../../config/userIDType';
import catchAsync from '../utils/catchAsync';
import { communityService } from '../community';
import { universityVerificationEmailService } from '../universityVerificationEmail';

import {
  EditProfileRequest,
  AddUniversityEmailBody,
  PaginationQueryWithUserId,
  CommunityUser,
} from './userProfile.interface';

/** Message constants for API responses and errors */
const MESSAGES = {
  INVALID_USER_PROFILE_ID: 'Invalid User Profile ID',
  NO_UPDATE_DATA: 'No update data provided',
  USER_ID_REQUIRED: 'User ID required',
  USER_NOT_FOUND: 'User not found',
  CANNOT_FOLLOW_SELF: 'You cannot follow to yourself',
  CANNOT_BLOCK_SELF: 'You cannot block yourself',
  MISSING_USER_OR_TARGET: (fields: string) => `Missing ${fields}`,
  ALREADY_VERIFIED_IN_COMMUNITY: 'User is already verified to this community',
} as const;


function requireUserId(
  req: userIdExtend,
  options?: { status?: number; message?: string }
): string {
  const userId = req.userId;
  if (!userId) {
    throw new ApiError(
      options?.status ?? httpStatus.BAD_REQUEST,
      options?.message ?? MESSAGES.USER_ID_REQUIRED
    );
  }
  return userId;
}

// update userProfile
export const updateUserProfile = catchAsync(async (req: Request, res: Response) => {
  const { userProfileId } = req.params;
  const updateData = req.body as EditProfileRequest;

  // Validate userProfileId
  if (!userProfileId || !mongoose.Types.ObjectId.isValid(userProfileId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGES.INVALID_USER_PROFILE_ID);
  }

  // Validate update data
  if (!updateData || Object.keys(updateData).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGES.NO_UPDATE_DATA);
  }

  const updatedUserProfile = await userProfileService.updateUserProfile(
    new mongoose.Types.ObjectId(userProfileId),
    updateData
  );

  return res.status(httpStatus.OK).json({
    success: true,
    data: updatedUserProfile,
  });
});

export const toggleFollow = catchAsync(async (req: userIdExtend, res: Response) => {
  const { userToFollow } = req.query as { userToFollow?: string };
  const userId = req.userId;

  if (userToFollow === userId) {
    return res.status(httpStatus.METHOD_NOT_ALLOWED).json({ message: MESSAGES.CANNOT_FOLLOW_SELF });
  }

  if (!userId || !userToFollow) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGES.MISSING_USER_OR_TARGET('userId or userToFollow'));
  }

  const followed = await userProfileService.toggleFollow(
    new mongoose.Types.ObjectId(userId),
    new mongoose.Types.ObjectId(userToFollow)
  );
  return res.status(httpStatus.OK).json(followed);
});

export const getAllUserFollowing = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as PaginationQueryWithUserId;
  const myUserId = requireUserId(req);

  const profile = await userProfileService.getFollowing(name ?? '', userId ?? '', Number(page), Number(limit), myUserId);
  return res.status(httpStatus.OK).json(profile);
});

export const getAllUserFollowers = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as PaginationQueryWithUserId;
  const myUserId = requireUserId(req);

  const profile = await userProfileService.getFollowers(name ?? '', userId ?? '', Number(page), Number(limit), myUserId);
  return res.status(httpStatus.OK).json(profile);
});

export const getAllMutualUsers = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as PaginationQueryWithUserId;
  requireUserId(req);

  const profile = await userProfileService.getFollowingAndMutuals(name ?? '', userId ?? '', Number(page), Number(limit));
  return res.status(httpStatus.OK).json(profile);
});

export const getAllUserFollowersAndFollowing = catchAsync(async (req: userIdExtend, res: Response) => {
  const { name } = req.query as { name?: string };
  const userId = requireUserId(req);

  const user = await userProfileService.getFollowersAndFollowing(name, userId);
  return res.status(httpStatus.OK).json(user);
});

export const getUserProfile = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireUserId(req);

  const profile = await userProfileService.getUserProfile(userID);
  return res.status(httpStatus.OK).json({ profile });
});

export const getUserProfileVerifiedUniversityEmails = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireUserId(req);

  const profile = await userProfileService.getUserProfileVerifiedUniversityEmails(userID);
  return res.status(httpStatus.OK).json(profile);
});

export const getBlockedUsers = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireUserId(req);

  const blockedUsers = await userProfileService.getBlockedUsers(userID);
  return res.status(httpStatus.OK).json({ blockedUsers });
});

export const addUniversityEmail = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = requireUserId(req, { status: httpStatus.NOT_FOUND, message: MESSAGES.USER_NOT_FOUND });
  const { universityName, universityEmail, UniversityOtp } = req.body as AddUniversityEmailBody;

  await universityVerificationEmailService.checkUniversityEmailVerificationOtp(UniversityOtp, universityEmail);

  const community = await communityService.findOrCreateCommunityByUniversityName(universityName, userID);
  const { _id: communityId } = community;

  const user = community.users.find((u: CommunityUser) => u._id.toString() === userID.toString());

  if (user && user.isVerified) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: MESSAGES.ALREADY_VERIFIED_IN_COMMUNITY });
  }

  await userProfileService.addUniversityEmail(
    userID,
    universityEmail,
    universityName,
    communityId.toString(),
    String(community.communityLogoUrl.imageUrl)
  );
  const result = await communityService.joinCommunity(new mongoose.Types.ObjectId(userID), communityId.toString(), true);

  return res.status(httpStatus.OK).json(result);
});

export const manuallyVerifyUniversityUser = catchAsync(async (req: Request, res: Response) => {
  const { userID, universityEmail } = req.body;

  const universityName = 'Unibuzz';
  const communityId = '6881f7fa83fc938b6302b0aa';
  const communityLogoUrl = 'https://unibuzz-uploads.s3.ap-south-1.amazonaws.com/assets/unibuzz_dark_square.png';
  
  await userProfileService.addUniversityEmail(
    userID,
    universityEmail,
    universityName,
    communityId,
    communityLogoUrl
  );

  const result = await communityService.joinCommunity(
    new mongoose.Types.ObjectId(userID),
    communityId,
    true
  );

  return res.status(httpStatus.OK).json(result);
});

export const toggleBlock = catchAsync(async (req: userIdExtend, res: Response) => {
  const { userToBlock } = req.query as { userToBlock?: string };
  const userId = req.userId;

  if (userToBlock === userId) {
    return res.status(httpStatus.METHOD_NOT_ALLOWED).json({ message: MESSAGES.CANNOT_BLOCK_SELF });
  }

  if (!userId || !userToBlock) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGES.MISSING_USER_OR_TARGET('userId or userToBlock'));
  }

  const result = await userProfileService.toggleBlock(
    new mongoose.Types.ObjectId(userId),
    new mongoose.Types.ObjectId(userToBlock)
  );
  return res.status(httpStatus.OK).json(result);
});
