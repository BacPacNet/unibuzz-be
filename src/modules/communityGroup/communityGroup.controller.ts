import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityGroupService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';

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
      const user = await User.findById(req.userId);

      const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];

      if (!userVerifiedCommunityIds.includes(String(communityId))) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the Groups!'));
      }

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

export const getAllCommunityGroup = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  let groups;

  try {
    if (communityId) {
      const user = await User.findById(req.userId);

      const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];
      const userUnverifiedVerifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];
      // console.log(userVerifiedCommunityIds);

      if (
        !userUnverifiedVerifiedCommunityIds.includes(String(communityId)) &&
        !userVerifiedCommunityIds.includes(String(communityId))
      ) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the Groups!'));
      }

      groups = await communityGroupService.getAllCommunityGroupWithUserProfiles(communityId);
      return res.status(200).json({ groups });
    }
  } catch (error: any) {
    // console.log(req);
    // console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const Join_leave_CommunityGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId;
  const { groupId } = req.params;
  let status;
  try {
    if (userID && groupId) {
      status = await communityGroupService.joinLeaveCommunityGroup(userID, groupId);
      // console.log(status);
      return res.status(200).json(status);
    }
  } catch (error: any) {
    // console.log(error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    } else {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'An internal server error occurred' });
    }
  }
};
