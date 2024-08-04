import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import userPostCommentsModel from '../userPostComments/userPostComments.model';
import { User } from '../user';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile } from '../userProfile';
import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
import { UserProfileDocument } from '../userProfile/userProfile.interface';

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
  const UsersPosts = await getUserPostsForUserIds(followingAndSelfUserIds!);
  const CommunityPosts = await getCommunityPostsForUserIds(followingAndSelfUserIds!);

  //merge them and sort them by latest
  const allPosts: any = [...UsersPosts, ...CommunityPosts];
  allPosts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

  return allPosts;
};

// Helper Services for getAllPosts

//get user ids of followers and the user itself
const getFollowingAndSelfUserIds = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingUsers = await UserProfile.findOne({ users_id: userId });
  let followingUserIds: mongoose.Schema.Types.ObjectId[] = [];
  if (followingUsers?.following?.length && followingUsers.following.length > 0) {
    followingUserIds = followingUsers?.following.map((user) => user.userId);
  }
  followingUserIds.push(userId);
  return followingUserIds;
};

//fetch userPosts for given user ids
const getUserPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[]) => {
  //get all posts of the users and his followers
  const followingUserPosts = await UserPostModel.find({ user_id: { $in: userIDs } })
    .populate({
      path: 'user_id',
      select: 'firstName lastName _id',
    })
    .sort({ createdAt: -1 })
    .lean();
  //get all comments of the posts

  const postIds = followingUserPosts.map((post: any) => post._id);
  const comments = await userPostCommentsModel.find({ userPostId: { $in: postIds } }).populate({
    path: 'commenterId',
    select: 'firstName lastName content _id',
  });

  //get all ids of the users who posted and commented
  const userIds = [
    ...new Set([
      ...followingUserPosts.map((post: any) => post.user_id._id.toString()),
      ...comments.map((comment: any) => comment.commenterId._id.toString()),
    ]),
  ];
  const profiles = await UserProfile.find({ users_id: { $in: userIds } });

  //merge posts with comments and profiles
  const postsWithCommentsAndProfiles = followingUserPosts.map((post: any) => {
    const userProfile = profiles.find((profile: any) => profile.users_id?.toString() === post.user_id?._id.toString());
    const postComments = comments
      .filter((comment) => comment.userPostId.toString() === post._id.toString())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((comment: any) => {
        const commenterProfile = profiles.find(
          (profile: UserProfileDocument) => profile.users_id.toString() === comment.commenterId._id.toString()
        );
        return {
          ...comment.toObject(),
          commenterId: {
            ...comment.commenterId.toObject(),
            profile_dp: commenterProfile ? commenterProfile.profile_dp : null,
          },
        };
      });

    return {
      ...post,
      comments: postComments,
      user_id: {
        ...post.user_id,
        profile_dp: userProfile ? userProfile.profile_dp : null,
        university_name: userProfile ? userProfile.university_name : null,
        study_year: userProfile ? userProfile.study_year : null,
        degree: userProfile ? userProfile.degree : null,
      },
    };
  });

  return postsWithCommentsAndProfiles;
};

const getCommunityPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[]) => {
  //get community ids of the user and his followers
  const followingUsers = await User.find({ _id: { $in: userIDs } });
  const followingUsersCommunityIds = followingUsers.flatMap((user) => [
    ...user.userVerifiedCommunities.map((community) => community.communityId),
    ...user.userUnVerifiedCommunities.map((community) => community.communityId),
  ]);

  //get community posts for above communities
  const followingUsersCommunityPosts = await CommunityPostModel.find({
    communityId: { $in: followingUsersCommunityIds },
    communityPostsType: 'Public',
  })
    .populate({ path: 'user_id', select: 'firstName lastName' })
    .sort({ createdAt: -1 })
    .lean();

  //get comments of the community posts
  const postIds = followingUsersCommunityPosts.map((post) => post._id);
  const comments = await communityPostCommentsModel.find({ communityId: { $in: postIds } }).populate({
    path: 'commenterId',
    select: 'firstName lastName content _id',
  });

  //get all ids of the users who posted and commented
  const userIds = [
    ...new Set([
      ...followingUsersCommunityPosts.map((post: any) => post.user_id._id.toString()),
      ...comments.map((comment: any) => comment.commenterId._id.toString()),
    ]),
  ];
  const profiles = await UserProfile.find({ users_id: { $in: userIds } });

  //merge posts with comments and profiles
  const postsWithCommentsAndProfiles = followingUsersCommunityPosts.map((post: any) => {
    const userProfile = profiles.find(
      (profile: UserProfileDocument) => profile.users_id.toString() === post.user_id._id.toString()
    );
    const postComments = comments
      .filter((comment) => comment.communityId.toString() === post._id.toString())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((comment: any) => {
        const commenterProfile = profiles.find(
          (profile: UserProfileDocument) => profile.users_id.toString() === comment.commenterId._id.toString()
        );
        return {
          ...comment.toObject(),
          commenterId: {
            ...comment.commenterId.toObject(),
            profile_dp: commenterProfile ? commenterProfile.profile_dp : null,
          },
        };
      });

    return {
      ...post,
      comments: postComments,
      user_id: {
        ...post.user_id,
        profile_dp: userProfile ? userProfile.profile_dp : null,
        university_name: userProfile ? userProfile.university_name : null,
        study_year: userProfile ? userProfile.study_year : null,
        degree: userProfile ? userProfile.degree : null,
      },
    };
  });

  return postsWithCommentsAndProfiles;
};

export const getUserPost = async (postId: string) => {
  const post = await UserPostModel.findById(postId)
    .populate({
      path: 'user_id',
      select: 'firstName lastName _id',
    })
    .lean();

  const comments = await userPostCommentsModel
    .find({ userPostId: post?._id })
    .populate({
      path: 'commenterId',
      select: 'firstName lastName content _id',
    })
    .sort({ createdAt: -1 });

  const profiles = await UserProfile.find({ users_id: post?.user_id });
  return {
    ...post,
    comments,
    profiles,
  };
};
