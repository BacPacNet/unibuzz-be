import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { communityService } from '.';
import mongoose from 'mongoose';
import { universityService } from '../university';
import { userIdExtend } from 'src/config/userIDType';
import { getCommunityUsersService, getCommunityUsersByFilterService } from './community.service';
import { GetCommunityUsersOptions } from './community.interface';

// get all userCommunity
export const getAllUserCommunity = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const userID = req.userId as string;
  try {
    const communities = await communityService.getUserCommunities(userID);
    res.status(httpStatus.OK).json(communities);
  } catch (error) {
    console.error('Error fetching user communities:', error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Community'));
  }
};
export const getFilteredUserCommunity = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const userID = req.userId as string;
  const { communityId } = req.params;

  try {
    if (!communityId) {
      throw new Error('communityId not found');
    }

    const communities = await communityService.getUserFilteredCommunities(userID, communityId, req.body.sort, req.body);
    res.status(httpStatus.OK).json(communities);
  } catch (error) {
    console.error('Error fetching user communities:', error);
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
    return res.status(200).json(community);
  } catch (error) {
    console.error(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get Community'));
  }
};
export const getCommunityFromUniversityID = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.universityId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
    }
    const community = await communityService.getCommunityFromUniversityId(req.params.universityId);
    return res.status(200).json(community);
  } catch (error) {
    console.error(error);
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
    console.error(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update Community'));
  }
};

export const CreateCommunity = async (req: any, res: Response) => {
  const { university_id }: any = req.body;

  try {
    const college: any = await universityService.getUniversityByRealId(university_id);

    // if (!college.isCommunityCreated) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'community Not Allowed');
    // }

    const community: any = await communityService.createCommunity(
      college.name,
      university_id,
      college.total_students || 0,
      college.total_faculty_staff || 0,
      college.campus || '',
      college.logo || '',
      college.short_overview || ''
    );

    return res.status(201).json({ community });
  } catch (error: any) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const joinCommunityFromUniversity = async (req: userIdExtend, res: Response) => {
  const { universityId } = req.query as any;
  const userId = req.userId as string;

  try {
    const community = await communityService.joinCommunityFromUniversity(userId, universityId);
    return res.status(httpStatus.OK).json(community);
  } catch (error: any) {
    console.log('err', error);

    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const joinCommunity = async (req: userIdExtend, res: Response) => {
  const { communityId } = req.params as any;

  if (!mongoose.Types.ObjectId.isValid(communityId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID');
  }

  try {
    const user = await communityService.joinCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
    return res.status(httpStatus.OK).json({ message: 'Joined Successfully', user });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveCommunity = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  try {
    if (!communityId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
    }
    let user = await communityService.leaveCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
    return res.status(200).json(user);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getCommunityUsersController = async (req: userIdExtend, res: Response) => {
  try {
    const { communityId } = req.params;
    const { isVerified = false, searchQuery, page = 1, limit = 10 } = req.query as unknown as GetCommunityUsersOptions;
    if (!communityId) {
      throw new Error('Invalid communityId');
    }
    const options: GetCommunityUsersOptions = {
      isVerified,
      searchQuery,
      page: Number(page),
      limit: Number(limit),
    };
    const users = await getCommunityUsersService(communityId, options);
    res.status(200).json({ success: true, ...users });
  } catch (error) {
    console.error('[getCommunityUsersController] error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getCommunityUsersWithfilterController = async (req: userIdExtend, res: Response) => {
  try {
    const { communityId } = req.params;
    const { isVerified = false, searchQuery, page = 1, limit = 10 } = req.query as unknown as GetCommunityUsersOptions;

    if (!communityId) {
      throw new Error('Invalid communityId');
    }
    const options: GetCommunityUsersOptions = {
      isVerified,
      searchQuery,
      page: Number(page),
      limit: Number(limit),
    };
    const users = await getCommunityUsersByFilterService(communityId, options);
    res.status(200).json({ success: true, ...users });
  } catch (error) {
    console.error('[getCommunityUsersController] error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
