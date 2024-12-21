import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityGroupModel, communityGroupService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';
//import { communityGroupRoleAccess } from '../user/user.interfaces';
import { communityGroupAccess } from '../../config/community.type';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userId = req.userId;
  const { communityId } = req.params;
  const { body } = req;
  try {
    if (!communityId || !userId) {
      return new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required');
    }
    const getCommunityByName = await communityGroupModel.findOne({ title: body.title });
    if (getCommunityByName?.title) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Community group already exists' });
    }
    const createCommunityGroup = await communityGroupService.createCommunityGroup(body, communityId, userId);

    return res.status(200).json({
      success: true,
      message: 'Successfully created the community group',
      data: createCommunityGroup,
    });
  } catch (error: any) {
    console.log(error);
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
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const deleteCommunityGroup = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  try {
    const deleteCommunityGroup = await communityGroupService.deleteCommunityGroup(new mongoose.Types.ObjectId(groupId));
    return res.status(200).json(deleteCommunityGroup);
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getCommunityGroupById = async (req: extendedRequest, res: Response) => {
  //  const { communityId } = req.params;
  const { communityGroupId } = req.query;

  try {
    const communityGroup = await communityGroupService.getCommunityGroupById(communityGroupId as string);
    if (!communityGroup) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Community group not found' });
    }
    return res.status(httpStatus.OK).json(communityGroup);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllCommunityGroup = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  const { communityGroupId } = req.query;
  let groups;
  let access = communityGroupAccess.Public;
  try {
    if (communityId) {
      const user = await User.findById(req.userId);

      const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];
      const userUnverifiedVerifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];

      if (
        !userUnverifiedVerifiedCommunityIds.includes(String(communityId)) &&
        !userVerifiedCommunityIds.includes(String(communityId))
      ) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the Groups!'));
      }

      if (userUnverifiedVerifiedCommunityIds.includes(String(communityId))) {
        access = communityGroupAccess.Public;
      }
      if (userVerifiedCommunityIds.includes(String(communityId))) {
        access = communityGroupAccess.Private;
      }
      groups = await communityGroupService.getAllCommunityGroupWithUserProfiles(communityId, access);

      if (communityGroupId) {
        const group = groups.find((g) => g._id.toString() === communityGroupId);
        if (!group) {
          return next(new ApiError(httpStatus.NOT_FOUND, 'Group not found'));
        }
        return res.status(httpStatus.OK).json(group);
      } else {
        return res.status(httpStatus.OK).json(groups);
      }
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const joinCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  try {
    const updatedCommunity = await communityGroupService.joinCommunityGroup(userID, groupId as string);

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the community group',
      data: updatedCommunity,
    });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  try {
    const updatedCommunity = await communityGroupService.leaveCommunityGroup(userID, groupId as string);

    res.status(200).json({
      success: true,
      message: 'Successfully left the community group',
      data: updatedCommunity,
    });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
