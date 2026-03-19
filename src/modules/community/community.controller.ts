import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { communityService } from '.';
import mongoose from 'mongoose';
import { universityService } from '../university';
import { userIdExtend } from '../../config/userIDType';
import { CreateCommunityBody, GetCommunityUsersOptions, communityInterface } from './community.interface';
import catchAsync from '../utils/catchAsync';
import { IUniversity } from '../university/university.interface';



// get all userCommunity
export const getAllUserCommunity = catchAsync(async (req: userIdExtend, res: Response) => {
    const userID = req.userId as string;
    const communities = await communityService.getUserCommunities(userID);
    return res.status(httpStatus.OK).json(communities);
});
export const getFilteredUserCommunity = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId as string;
  const { communityId } = req.params;
    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'communityId not found');
    }
    const communities = await communityService.getUserFilteredCommunities(userID, communityId, req.body.sort, req.body);
   return res.status(httpStatus.OK).json(communities);

})

//get community
export const getCommunity = catchAsync(async (req: userIdExtend, res: Response) => {
  const communityId = req.params['communityId'];
  if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID');
  }

  const options =
    req.userId != null && req.userId.length > 0 ? { currentUserId: String(req.userId) } : undefined;
  const community = await communityService.getCommunity(communityId, options);
  return res.status(httpStatus.OK).json(community);
});


export const updateCommunity = catchAsync(async (req: Request<{ communityId: string }>, res: Response) => {
  let community;


    if (!mongoose.Types.ObjectId.isValid(req.params.communityId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID')
    }
    community = await communityService.updateCommunity(req.params.communityId, req.body);
    return res.status(httpStatus.OK).json({ community });

})

export const CreateCommunity = catchAsync(async (req: Request<object, object, CreateCommunityBody>, res: Response) => {
  const { university_id } = req.body;

  const college: IUniversity | null = await universityService.getUniversityByRealId(university_id);
  if (!college) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const totalStudents = typeof college.total_students === 'object' && college.total_students?.$numberInt != null
    ? Number(college.total_students.$numberInt)
    : Number(college.total_students) || 0;
  const totalFaculty = Number((college as IUniversity & { total_faculty_staff?: number }).total_faculty_staff) || 0;

  const community: communityInterface = await communityService.createCommunity(
    college.name,
    university_id,
    String(totalStudents),
    String(totalFaculty),
    college.campus || '',
    college.logo || '',
    college.short_overview || ''
  );

  return res.status(httpStatus.CREATED).json({ community });
})

export const joinCommunityFromUniversity = catchAsync(async (req: userIdExtend, res: Response) => {
  const { universityId } = req.query as any;
  const userId = req.userId as string;

    const community = await communityService.joinCommunityFromUniversity(userId, universityId);
    return res.status(httpStatus.OK).json(community);
})

export const joinCommunity = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityId } = req.params as any;

  if (!mongoose.Types.ObjectId.isValid(communityId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID');
  }

    const user = await communityService.joinCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
    return res.status(httpStatus.OK).json({ message: 'Joined Successfully', user });
})

export const leaveCommunity = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityId } = req.params;

    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID')
    }
    let user = await communityService.leaveCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
    return res.status(httpStatus.OK).json(user);
})

export const getCommunityUsersController = catchAsync(async (req: userIdExtend, res: Response) => {

    const { communityId } = req.params;
    const { isVerified = false, searchQuery, page = 1, limit = 10 } = req.query as unknown as GetCommunityUsersOptions;
    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid communityId');
    }
    const options: GetCommunityUsersOptions = {
      isVerified,
      searchQuery,
      page: Number(page),
      limit: Number(limit),
      userId: req.userId as string,
    };
    const users = await communityService.getCommunityUsersService(communityId, options);
   return res.status(httpStatus.OK).json({ success: true, ...users });

})

export const getCommunityUsersWithfilterController = catchAsync(async (req: userIdExtend, res: Response) => {

    const { communityId } = req.params;
    const userId = req.userId;
    const {
      isVerified = false,
      searchQuery,
      page = 1,
      limit = 10,
      communityGroupId,
    } = req.query as unknown as GetCommunityUsersOptions;

    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid communityId');
    }
    const options: GetCommunityUsersOptions = {
      isVerified,
      searchQuery,
      communityGroupId,
      page: Number(page),
      limit: Number(limit),
      userId: userId as string,
    };
    const users = await communityService.getCommunityUsersByFilterService(communityId, options);
    return res.status(httpStatus.OK).json({ success: true, ...users });

})
