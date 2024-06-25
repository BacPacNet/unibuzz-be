import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { communityService } from '.';
import mongoose from 'mongoose';

//get all community
export const getCommunity = async (req: any, res: Response, next: NextFunction) => {
  let community;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.communityId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
    }
    community = await communityService.getCommunity(req.params.communityId);
    return res.status(200).json({ community });
  } catch (error) {
    //   console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Community'));
  }
};

export const updateCommunity = async (req: any, res: Response, next: NextFunction) => {
  let community;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.communityId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
    }
    community = await communityService.updateCommunity(req.params.communityId, req.body);
    return res.status(200).json({ community });
  } catch (error) {
    //   console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update Community'));
  }
};
