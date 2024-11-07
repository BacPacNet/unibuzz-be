import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { communityService } from '.';
import mongoose from 'mongoose';
import { universityService } from '../university';
// import { communityGroupService } from '../communityGroup';
// import { userService } from '../user';
// import { communityGroupRoleAccess } from '../user/user.interfaces';

// get all userCommunity
export const getAllUserCommunity = async (req: any, res: Response, next: NextFunction) => {
  let community;
  const userID = req.userId;
  try {
    community = await communityService.getUserCommunitys(userID);
    return res.status(200).json({ community });
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Community'));
  }
};

//get community
export const getCommunity = async (req: any, res: Response, next: NextFunction) => {
  let community;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.communityId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
    }
    community = await communityService.getCommunity(req.params.communityId);
    return res.status(200).json({ community });
  } catch (error) {
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
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update Community'));
  }
};

export const CreateCommunity = async (req: any, res: Response) => {
  const userID = req.userId;

  const { collegeID }: any = req.body;

  try {
    const college: any = await universityService.getUniversityByRealId(collegeID);

    if (!college.isCommunityCreated) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'community Not Allowed');
    }

    const community: any = await communityService.createCommunity(
      college.name,
      userID,
      collegeID,
      college.topUniInfo?.studentsAndFacultiesData?.Total_students?.Total_students || 0,
      college.topUniInfo?.studentsAndFacultiesData?.Total_faculty_staff?.Total_faculty_staff || 0,
      college.images || [],
      college.logos || [],
      college.topUniInfo.about || ''
    );

    return res.status(201).json({ community });
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
