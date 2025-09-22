import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import * as userProfileService from './userProfile.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from 'src/config/userIDType';
import { communityModel, communityService } from '../community';
import { universityVerificationEmailService } from '../universityVerificationEmail';
import universityModel, { IUniversity } from '../university/university.model';
import UniversityModel from '../university/university.model';
import { EditProfileRequest } from './userProfile.interface';
import { redis } from '../../config/redis';

// update userProfile
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { userProfileId } = req.params;
  const updateData = req.body as EditProfileRequest;

  console.log(updateData, 'updateData');

  try {
    // Validate userProfileId
    if (!userProfileId || !mongoose.Types.ObjectId.isValid(userProfileId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid User Profile ID'));
    }

    // Validate update data
    if (!updateData || Object.keys(updateData).length === 0) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'No update data provided'));
    }

    const updatedUserProfile = await userProfileService.updateUserProfile(
      new mongoose.Types.ObjectId(userProfileId),
      updateData
    );

    // Clear cache for this user
    const cacheKey = `cache:v1/users/${updatedUserProfile.users_id}`;
    await redis.del(cacheKey);

    return res.status(httpStatus.OK).json({
      success: true,
      data: updatedUserProfile,
    });
  } catch (error: any) {
    return next(
      new ApiError(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Error updating user profile')
    );
  }
};

export const toggleFollow = async (req: userIdExtend, res: Response) => {
  const { userToFollow } = req.query as { userToFollow?: string };
  const userId = req.userId;
  try {
    if (userToFollow === userId) {
      return res.status(httpStatus.METHOD_NOT_ALLOWED).json({ message: 'You cannot follow to yorself' });
    }

    if (userId && userToFollow) {
      let followed = await userProfileService.toggleFollow(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(userToFollow)
      );
      return res.status(200).json(followed);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllUserFollowing = async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as any;
  try {
    if (req.userId) {
      let profile = await userProfileService.getFollowing(name, userId, Number(page), Number(limit));

      return res.status(200).json(profile);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllUserFollowers = async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as any;
  try {
    if (req.userId) {
      let profile = await userProfileService.getFollowers(name, userId, Number(page), Number(limit));
      return res.status(200).json(profile);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllMututalUsers = async (req: userIdExtend, res: Response) => {
  const { page, limit, name, userId } = req.query as any;
  try {
    if (req.userId) {
      let profile = await userProfileService.getFollowingAndMutuals(name, userId, Number(page), Number(limit));
      return res.status(200).json(profile);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllUserFollowersAndFollowing = async (req: userIdExtend, res: Response) => {
  const { name } = req.query as { name?: string };

  try {
    if (req.userId) {
      let user = await userProfileService.getFollowersAndFollowing(name, req.userId);
      return res.status(200).json(user);
    }
  } catch (error: any) {
    console.log(error);

    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserProfile = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  try {
    if (userID) {
      let profile = await userProfileService.getUserProfile(userID);
      return res.status(200).json({ profile });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserProfileVerifiedUniversityEmails = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;

  try {
    if (userID) {
      let profile = await userProfileService.getUserProfileVerifiedUniversityEmails(userID);
      return res.status(200).json(profile);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getBlockedUsers = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  try {
    if (userID) {
      let blockedUsers = await userProfileService.getBlockedUsers(userID);
      return res.status(200).json({ blockedUsers });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const addUniversityEmail = async (req: userIdExtend, res: Response) => {
  const userID = req.userId;
  const { universityName, universityEmail, UniversityOtp } = req.body;
  try {
    if (!userID) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

    await universityVerificationEmailService.checkUniversityEmailVerificationOtp(UniversityOtp, universityEmail);
    let community: any = await communityModel.findOne({ name: universityName });
    if (!community) {
      const fetchUniversity = await universityModel.findOne({ name: universityName });

      const { _id: university_id, logo, campus, total_students, short_overview } = fetchUniversity as IUniversity;

      community = await communityModel.create({
        name: universityName,
        communityLogoUrl: { imageUrl: logo },
        communityCoverUrl: { imageUrl: campus },
        total_students: total_students,
        university_id: university_id,
        created_by: userID,
        about: short_overview,
      });

      await UniversityModel.updateOne({ _id: university_id }, { $set: { communityId: community._id, isVerified: true } });
    }

    const { _id: communityId } = community;

    const user = community.users.find((user: any) => user._id.toString() === userID.toString());

    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User is already verified to this community' });
    }

    await userProfileService.addUniversityEmail(
      userID,
      universityEmail,
      universityName,
      communityId.toString(),
      community.communityLogoUrl.imageUrl
    );
    const result = await communityService.joinCommunity(new mongoose.Types.ObjectId(userID), communityId.toString(), true);

    return res.status(200).json(result);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
