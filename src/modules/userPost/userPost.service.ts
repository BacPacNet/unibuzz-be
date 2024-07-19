import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import { followingRelationship } from '../userFollow';
import { User } from '../user';
import CommunityPostModel from '../communityPosts/communityPosts.model';

export const createUserPost = async (post: userPostInterface) => {
  return await UserPostModel.create(post);
};

export const likeUnlike = async (id: string, userId: string) => {
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

//get all posts
export const getAllPosts = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingAndSelfUserIds = await getFollowingAndSelfUserIds(userId);
  const UsersPosts = await getUserPostsForUserIds(followingAndSelfUserIds);
  const CommunityPosts = await getCommunityPostsForUserIds(followingAndSelfUserIds);

  const allPosts: any = [...UsersPosts, ...CommunityPosts];
  allPosts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

  return allPosts;
};

// Helper Services for getAllPosts

//get user ids of followers and the user itself
const getFollowingAndSelfUserIds = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingRelationships = await followingRelationship.find({ user_id: userId });
  const followingUserIds = followingRelationships.map((relationship) => relationship.following_user_id);
  followingUserIds.push(userId);
  return followingUserIds;
};

//fetch userPosts for given user ids
const getUserPostsForUserIds = async (userIds: mongoose.Schema.Types.ObjectId[]) => {
  const followingUserPosts = await UserPostModel.find({ userId: { $in: userIds } }).sort({ createdAt: -1 });
  return followingUserPosts;
};

const getCommunityPostsForUserIds = async (userIds: mongoose.Schema.Types.ObjectId[]) => {
  const followingUsers = await User.find({ _id: { $in: userIds } });
  const followingUsersCommunityIds = followingUsers.flatMap((user) => [
    ...user.userVerifiedCommunities.map((community) => community.communityId),
    ...user.userUnVerifiedCommunities.map((community) => community.communityId),
  ]);
  const followingUsersCommunityPosts = await CommunityPostModel.find({
    communityId: { $in: followingUsersCommunityIds },
    communityPostsType: 'Public',
  }).sort({ createdAt: -1 });
  return followingUsersCommunityPosts;
};
