import { Response } from 'express';
import * as userPostService from './userPost.service';
import httpStatus from 'http-status';
import he from 'he';
import { userIdExtend } from 'src/config/userIDType';
import catchAsync from '../utils/catchAsync';
import { PaginationQuery, parsePagination, parsePostIdOrThrow, requireAuthenticatedUserIdOrThrow, requireQueryUserIdOrThrow } from '../../utils/common';
import { GetAllUserPostsQuery } from './userPost.interface';


export const getAllUserPosts = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit, userId } = req.query as GetAllUserPostsQuery;
  const myUserId = req.userId;
  const { page: pageNum, limit: limitNum } = parsePagination({
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });
  const targetUserId = requireQueryUserIdOrThrow(userId);

  const userPosts = await userPostService.getAllUserPosts(targetUserId, pageNum, limitNum, myUserId);
  return res.status(httpStatus.OK).json(userPosts);
});

export const createUserPost = catchAsync(async (req: userIdExtend, res: Response) => {
  const { body } = req;
  body.content = he.decode(body.content);
  const post = await userPostService.createUserPost({ ...body, user_id: req.userId });
  return res.status(httpStatus.CREATED).json(post);
});

export const updateUserPost = catchAsync(async (req: userIdExtend, res: Response) => {
  const parsedPostId = parsePostIdOrThrow(req.params['postId']);

  await userPostService.updateUserPost(parsedPostId, req.body);
  return res.status(httpStatus.OK).json({ message: 'Updated Successfully' });
});

export const deleteUserPost = catchAsync(async (req: userIdExtend, res: Response) => {
  const parsedPostId = parsePostIdOrThrow(req.params['postId']);

  await userPostService.deleteUserPost(parsedPostId);
  return res.status(httpStatus.OK).json({ message: 'deleted' });
});

export const getAllTimelinePosts = catchAsync(async (req: userIdExtend, res: Response) => {
  const { page, limit } = req.query as PaginationQuery;
  const userId = requireAuthenticatedUserIdOrThrow(req);
  const { page: pageNum, limit: limitNum } = parsePagination({
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });

  const timelinePosts = await userPostService.getTimelinePostsFromRelationship(userId, pageNum, limitNum);
  return res.status(httpStatus.OK).json(timelinePosts);
});

export const updateLikeStatus = catchAsync(async (req: userIdExtend, res: Response) => {
  const parsedPostId = parsePostIdOrThrow(req.params['postId']);
  const userId = requireAuthenticatedUserIdOrThrow(req);

  const likeCount = await userPostService.likeUnlike(parsedPostId.toString(), userId);
  return res.status(httpStatus.OK).json(likeCount);
});
