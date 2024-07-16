import * as userFollowService from './userFollow.service';
import { Request, Response } from 'express';

interface userIdExtend extends Request {
  userId?: string;
}

// toggle follow/unfollow
export const toggleFollow = async (req: userIdExtend, res: Response) => {
  const userId = req.userId;
  const { userToFollowId } = req.params;

  try {
    if (userId && userToFollowId) {
      const follow = await userFollowService.follow_unfollow_User(userId, userToFollowId);
      return res.status(200).send(follow);
    }
  } catch (error) {
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
