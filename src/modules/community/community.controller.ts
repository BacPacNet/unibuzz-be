import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { communityService } from '.';
import mongoose from 'mongoose';
import { universityService } from '../university';
import { communityGroupService } from '../communityGroup';
import { userService } from '../user';

// get all userCommunity
export const getAllUserCommunity = async (req: any, res: Response, next: NextFunction) => {
  let community;
  const userID = req.userId;
  try {
    community = await communityService.getUserCommunitys(userID);
    return res.status(200).json({ community });
  } catch (error) {
    //   console.log(req);
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

export const CreateCommunity = async (req: any, res: Response) => {
  const userID = req.userId;
  // console.log(userID);

  const { collegeID }: any = req.body;
  // console.log("cc",collegeID);

  try {
    const college: any = await universityService.getUniversityById(collegeID);

    if (!college.isCommunityCreated) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'community Not Allowed');
    }

    const community: any = await communityService.createCommunity(
      college.name,
      userID,
      collegeID,
      college.topUniInfo.studentsAndFacultiesData,
      college.images,
      college.logos
    );
    // return res.status(201).json({ community });
    await userService.joinCommunity(userID, String(community._id), community.name, true);
    const dataForCommunityGroup = {
      title: community.name,
      communityGroupLogoCoverUrl: {
        imageUrl: community.communityCoverUrl.imageUrl ? community.communityCoverUrl.imageUrl : '',
      },
      communityGroupLogoUrl: { imageUrl: community.communityLogoUrl.imageUrl ? community.communityLogoUrl.imageUrl : '' },
    };

    const communityGroup = await communityGroupService.createCommunityGroup(userID, community._id, dataForCommunityGroup);
    await communityGroupService.joinLeaveCommunityGroup(userID, String(communityGroup._id));
    //  console.log("gg",group);

    return res.status(201).json({ community });
  } catch (error: any) {
    //   console.log(req);
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
