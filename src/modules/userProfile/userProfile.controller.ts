import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import * as userProfileService from './userProfile.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';

// update userProfile
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { userProfileId } = req.params;
  // console.log(req.params);

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
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message });
  }
};
