import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import * as userProfileService from './userProfile.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from 'src/config/userIDType';
import { communityModel, communityService } from '../community';
import { universityVerificationEmailService } from '../universityVerificationEmail';
import universityModel, { IUniversity } from '../university/university.model';

// update userProfile
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { userProfileId } = req.params;

  try {
    if (typeof userProfileId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(userProfileId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid User Profile ID'));
      }
      const updatedUserProfile = await userProfileService.updateUserProfile(
        new mongoose.Types.ObjectId(userProfileId),
        req.body
      );
      return res.status(200).json({ updatedUserProfile });
    }
  } catch (error: any) {
    console.error('err', error.message);
    return res.status(error.statusCode).json({ message: error.message });
  }
};

export const toggleFollow = async (req: userIdExtend, res: Response) => {
  const { userToFollow } = req.query as { userToFollow?: string };
  const userId = req.userId;
  try {
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
    console.error(error);

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
      const { _id: communityId, logo, campus, total_students, short_overview } = fetchUniversity as IUniversity;
      community = await communityModel.create({
        name: universityName,
        communityLogoUrl: { imageUrl: logo },
        communityCoverUrl: { imageUrl: campus },
        total_students: total_students,
        university_id: communityId,
        created_by: userID,
        about: short_overview,
      });
    }

    const { _id: communityId } = community;

    let userProfile = await userProfileService.addUniversityEmail(
      userID,
      universityEmail,
      universityName,
      communityId.toString(),
      community.communityLogoUrl.imageUrl
    );

    await communityService.joinCommunity(new mongoose.Types.ObjectId(userID), communityId.toString());

    return res.status(200).json({ userProfile });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
