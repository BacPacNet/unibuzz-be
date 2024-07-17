import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as userService from './user.service';
import { userProfileService } from '../userProfile';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  // const userProfile = await userProfileService.createUserProfile(user);
  res.status(httpStatus.CREATED).send({ user });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'role']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.getUserById(new mongoose.Types.ObjectId(req.params['userId']));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    const userProfile = await userProfileService.getUserProfile(user.id);
    res.send({ user, userProfile });
  }
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.updateUserById(new mongoose.Types.ObjectId(req.params['userId']), req.body);
    res.send(user);
  }
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const getUsersWithProfileData = async(req:any,res:Response)=>{
  const {  name } = req.query;
  const userID = req.userId;

  try {
    
      let user = await userService.getUsersWithProfile( name, userID);
      return res.status(200).json({ user });
    
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}


export const joinCommunity = async (req: any, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  // console.log(communityId);
  const { communityName } = req.body;

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      let user = await userService.joinCommunity(new mongoose.Types.ObjectId(req.userId), communityId, communityName);
      return res.status(200).json({ message: 'joined Successfully', user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveCommunity = async (req: any, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      let user = await userService.leaveCommunity(new mongoose.Types.ObjectId(req.userId), communityId);
      return res.status(200).json({ message: 'Left the community', user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const findUsersByCommunityId = async (req: any, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  const { privacy, name } = req.query;
  const userID = req.userId;
  // console.log("priva",userID);

  try {
    if (typeof communityId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID'));
      }
      let user = await userService.findUsersByCommunityId(communityId, privacy, name, userID);
      return res.status(200).json({ user });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
