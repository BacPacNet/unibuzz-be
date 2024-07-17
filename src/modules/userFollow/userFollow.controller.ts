// import httpStatus from "http-status";
import * as userFollowService from './userFollow.service';
import { Request, Response } from 'express';

interface userIdExtend extends Request {
  userId?: string;
}

// toggle follow/unfollow
export const toggleFollow = async (req: userIdExtend, res: Response) => {
  const userId = req.userId;
  const { userToFollowId } = req.params;
  // console.log(req.params);

  try {
    if (userId && userToFollowId) {
      const follow = await userFollowService.follow_unfollow_User(userId, userToFollowId);
      return res.status(200).send(follow);
    }
  } catch (error) {
    // Add error handling here
    console.error(error);
    return res.status(500).json({ message: 'Failed to toggle follow status' });
  }
};

// Get follow counts
export const getFollowCounts = async (req: userIdExtend, res: Response) => {
  const userId = req.userId;

  try {
    if (userId) {
      const counts = await userFollowService.getFollowCounts(userId);
      return res.status(200).json(counts);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to get follow counts' });
  }
};


// get User following
export const getUserFollowing = async (req: any, res: Response) => {
  const userId = req.userId;
  const {  name } = req.query;
  try {
    
      const userFollowing = await userFollowService.getUserFollowing(name,userId);
      return res.status(200).json(userFollowing);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to get follow counts' });
  }
}

// get User followers
export const getUserFollowers = async (req: any, res: Response) => {
  const userId = req.userId;
  const {  name } = req.query;
  try {
    
      const userFollowers = await userFollowService.getUserFollowers(name,userId);
      return res.status(200).json(userFollowers);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to get follow counts' });
  }
}
