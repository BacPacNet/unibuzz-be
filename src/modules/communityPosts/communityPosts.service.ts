import mongoose from 'mongoose';
import { userService } from '../user';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';

export const createCommunityPost = async (post: communityPostsInterface, adminId: mongoose.Types.ObjectId) => {
  const admin = await userService.getUserById(adminId);
  //    console.log(admin?.joinedCommunity.toString() != post.communityId.toString());

  //  if(admin?.joinedCommunity.toString() == post.communityId.toString() || admin?.role != "admin"){
  //       throw new ApiError(httpStatus.UNAUTHORIZED,"you are not admin of the group!")
  //  }
  const adminUnverifiedCommunityIds = admin?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];

  if (adminUnverifiedCommunityIds.includes(post.communityId.toString()) || admin?.role !== 'admin') {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not admin of the group!');
  }
  return await CommunityPostModel.create(post);
};

export const likeUnlike = async (id: string, userId: string) => {
  const post = await communityPostsModel.findById(id);

  if (!post?.likeCount.some((x) => x.userId === userId)) {
    return await post?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await post.updateOne({ $pull: { likeCount: { userId } } });
  }
};

export const updateCommunityPost = async (id: mongoose.Types.ObjectId, community: communityPostsInterface) => {
  let communityToUpadate;

  communityToUpadate = await communityPostsModel.findById(id);

  if (!communityToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityToUpadate, {
    content: community.content,
    communityPostsType: community.communityPostsType,
  });
  await communityToUpadate.save();
  return communityToUpadate;
};

export const deleteCommunityPost = async (id: mongoose.Types.ObjectId) => {
  return await communityPostsModel.findByIdAndDelete(id);
};

export const getAllCommunityPost = async (communityId: string) => {
  return await communityPostsModel.find({ communityId: communityId });
};
