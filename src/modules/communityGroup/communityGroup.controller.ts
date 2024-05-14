import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityGroupService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateCommunityGroup = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const userID = req.userId;
  const { communityId } = req.params;
  // console.log(communityPostId);
  let group;
  if (!req.body.title) {
    return next(new ApiError(httpStatus.NOT_FOUND, 'title required!'));
  }
  try {
    if (userID && communityId) {
      group = communityGroupService.createCommunityGroup(userID, communityId, req.body);
    }
    return res.status(httpStatus.CREATED).json({ group });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateCommunityGroup = async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  try {
    if (typeof groupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
      }
      await communityGroupService.updateCommunityGroup(new mongoose.Types.ObjectId(groupId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    // console.log("err",error.message);
    res.status(error.statusCode).json({ message: error.message });
  }
};

export const deleteCommunityGroup = async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  try {
    if (typeof groupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
      }
      await communityGroupService.deleteCommunityGroup(new mongoose.Types.ObjectId(groupId));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    // console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

export const getAllCommunityGroup = async (req: Request, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  let groups;

  try {
    if (communityId) {
      groups = await communityGroupService.getAllCommunityGroup(communityId);
      return res.status(200).json({ groups });
    }
  } catch (error) {
    console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Community Group'));
  }
};
