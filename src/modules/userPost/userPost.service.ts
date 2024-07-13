import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import { followingRelationship } from '../userFollow';

export const createUserPost = async (post: userPostInterface) => {

  return await UserPostModel.create(post);
};

export const likeUnlike = async (id: string, userId: string) => {
  // console.log(id);

  const post = await UserPostModel.findById(id);

  if (!post?.likeCount.some((x) => x.userId === userId)) {
    return await post?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await post.updateOne({ $pull: { likeCount: { userId } } });
  }
};

export const updateUserPost = async (id: mongoose.Types.ObjectId, post: userPostInterface) => {
  let userPostToUpdate;

  userPostToUpdate = await UserPostModel.findById(id);

  if (!userPostToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'post not found!');
  }
  Object.assign(userPostToUpdate, {
    content: post.content,
  });
  await userPostToUpdate.save();
  return userPostToUpdate;
};

export const deleteUserPost = async (id: mongoose.Types.ObjectId) => {
  return await UserPostModel.findByIdAndDelete(id);
};

export const getAllPosts = async (userId: mongoose.Schema.Types.ObjectId) => {
  // Fetch all posts of user followers
  const followingRelationships = await followingRelationship.find({ user_id: userId});
  const followingUserIds = followingRelationships.map((relationship) => relationship.following_user_id);
  followingUserIds.push(userId);
  const posts = await UserPostModel.find({ userId: { $in: followingUserIds } }).sort({ createdAt: -1 });

  return posts;
};
