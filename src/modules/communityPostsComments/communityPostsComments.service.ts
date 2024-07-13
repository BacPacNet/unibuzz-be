import mongoose from 'mongoose';
import communityPostCommentModel from './communityPostsComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createCommunityComment = async (userID: string, communityPostId: string, body: any) => {
  const newComment = { ...body, communityId: communityPostId, commenterId: userID };
  return await communityPostCommentModel.create(newComment);
};

export const updateCommunityPostComment = async (id: mongoose.Types.ObjectId, comment: any) => {
  let communityPostCommentToUpadate;

  communityPostCommentToUpadate = await communityPostCommentModel.findById(id);

  if (!communityPostCommentToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(communityPostCommentToUpadate, {
    content: comment.content,
    imageUrl: comment.imageurl,
  });
  await communityPostCommentToUpadate.save();
  return communityPostCommentToUpadate;
};

export const deleteCommunityPostComment = async (id: mongoose.Types.ObjectId) => {
  return await communityPostCommentModel.findByIdAndDelete(id);
};

export const getAllCommunityPostComment = async (commentPostId: string) => {
  // console.log(commentPostId);

  return await communityPostCommentModel.find({ communityId: commentPostId });
};

export const likeUnlikeComment = async (id: string, userId: string) => {
  // console.log(id);

  const comment = await communityPostCommentModel.findById(id);

  if (!comment?.likeCount.some((x) => x.userId === userId)) {
    return await comment?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await comment.updateOne({ $pull: { likeCount: { userId } } });
  }
};
