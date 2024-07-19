import mongoose from 'mongoose';
import userPostCommentsModel from './userPostComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createUserPostComment = async (userId: string, userPostId: string, body: any) => {
  const newComment = { ...body, userPostId, commenterId: userId };
  return await userPostCommentsModel.create(newComment);
};

export const updateUserPostComment = async (commentId: mongoose.Types.ObjectId, comment: any) => {
  let updatedUserPostComment;

  updatedUserPostComment = await userPostCommentsModel.findById(commentId);

  if (!updatedUserPostComment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(updatedUserPostComment, {
    content: comment.content,
    imageUrl: comment.imageurl,
  });
  await updatedUserPostComment.save();
  return updatedUserPostComment;
};

export const deleteUserPostComment = async (commentId: mongoose.Types.ObjectId) => {
  return await userPostCommentsModel.findByIdAndDelete(commentId);
};

export const getAllUserPostComment = async (userPostId: string) => {
  return await userPostCommentsModel.find({ userPostId });
};

export const likeUnlikeComment = async (commentId: string, userId: string) => {
  const comment = await userPostCommentsModel.findById(commentId);

  if (!comment?.likeCount.some((x) => x.userId === userId)) {
    return await comment?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await comment.updateOne({ $pull: { likeCount: { userId } } });
  }
};
