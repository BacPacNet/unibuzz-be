import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import userPostCommentsModel from '../userPostComments/userPostComments.model';
import { followingRelationship } from '../userFollow';
import { User } from '../user';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile } from '../userProfile';

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
  // get user ids of the user and his followers
  const followingAndSelfUserIds = await getFollowingAndSelfUserIds(userId);
  // get different types of posts
  const UsersPosts = await getUserPostsForUserIds(followingAndSelfUserIds);
  const CommunityPosts = await getCommunityPostsForUserIds(followingAndSelfUserIds);
  
  const allPosts: any = [...UsersPosts, ...CommunityPosts];

  // get all comments for the posts
  const postIds = allPosts.map((post: any) => post._id);
  const comments = await userPostCommentsModel.find({ userPostId: { $in: postIds}}).populate({
    path: 'commenterId',
    select: 'firstName lastName content _id'
  });

  //get profiles of commenters and post owners
  const userIds = [
    ...new Set([
      ...comments.map((comment: any) => comment.commenterId._id.toString()),
      ...followingAndSelfUserIds
    ])
  ];
  const profiles = await UserProfile.find({ users_id: { $in: userIds }});

  // Associate comments with their respective posts
  const postsWithComments = allPosts.map((post: any) => {
    const postComments = comments
      .filter((comment: any) => comment.userPostId.toString() === post._id.toString())
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((comment: any) => {
      const userProfile = profiles.find((profile: any) => profile.users_id.toString() === comment.commenterId._id.toString());
      return {
        ...comment.toObject(),
        commenterId: {
          ...comment.commenterId.toObject(),
          profile_dp: userProfile ? userProfile.profile_dp : null
        },
      };
    });

    const postUserProfile = profiles.find((profile: any) => profile.users_id.toString() === post.userId.toString());
    console.log(postUserProfile);
    

    return {
      ...post,
      comments: postComments,
      
    };
  })

  return postsWithComments;
};

// Helper Services for getAllPosts

//get user ids of followers and the user itself
const getFollowingAndSelfUserIds = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingRelationships = await followingRelationship.find({ user_id: userId });
  const followingUserIds = followingRelationships.map((relationship) => relationship.following_user_id);
  followingUserIds.push(userId);
  return followingUserIds;
}

//fetch userPosts for given user ids
const getUserPostsForUserIds = async (userIds: mongoose.Schema.Types.ObjectId[]) => {
  const followingUserPosts = await UserPostModel.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).lean();
  return followingUserPosts;
}

const getCommunityPostsForUserIds = async (userIds: mongoose.Schema.Types.ObjectId[]) => {
  const followingUsers = await User.find({ _id: { $in: userIds}});
  const followingUsersCommunityIds = followingUsers.flatMap((user) => [...user.userVerifiedCommunities.map((community) => community.communityId), ...user.userUnVerifiedCommunities.map((community) => community.communityId)]);
  const followingUsersCommunityPosts = await CommunityPostModel.find({ communityId: {$in: followingUsersCommunityIds}, communityPostsType: 'Public'}).sort({createdAt: -1}).lean();
  return followingUsersCommunityPosts;
}



