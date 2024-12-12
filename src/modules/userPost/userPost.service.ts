import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile, userProfileService } from '../userProfile';

import { CommunityType, userPostType } from '../../config/community.type';

export const getAllUserPosts = async (userId: mongoose.Schema.Types.ObjectId, page: number = 0, limit: number = 10) => {
  const userPosts = await getUserPostsForUserIds(String(userId), [userId], [], page, limit);
  return userPosts;
};

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
  return await UserPostModel.deleteOne(id);
};
export const getUserJoinedCommunityIds = async (id: mongoose.Schema.Types.ObjectId) => {
  // const user = await User.findById(id);
  // const userVerifiedCommunityId = user?.userVerifiedCommunities.map((item) => item.communityId) || [];
  // const userUnVerifiedCommunityId = user?.userUnVerifiedCommunities.map((item) => item.communityId) || [];

  // const userVerifiedCommunityGroupId =
  //   user?.userVerifiedCommunities?.flatMap((x) => x.communityGroups.map((y) => y.communityGroupId.toString())) || [];
  // const userUNVerifiedCommunityGroupId =
  //   user?.userUnVerifiedCommunities?.flatMap((x) => x.communityGroups.map((y) => y.communityGroupId.toString())) || [];

  // const allCommunityId = [...userVerifiedCommunityId, ...userUnVerifiedCommunityId];
  // const allCommunityGroupId = [...userVerifiedCommunityGroupId, ...userUNVerifiedCommunityGroupId];

  // return [allCommunityId, allCommunityGroupId];

  const userProfile = await userProfileService.getUserProfileById(String(id));
  const allCommunityId = userProfile?.email.map((item) => item.communityId);
  return allCommunityId;
};

export const getAllTimelinePosts = async (userId: mongoose.Schema.Types.ObjectId, page: number = 1, limit: number = 5) => {
  // Get user IDs of the user and their followers
  const [followingAndSelfUserIds = [], followersAndSelfUserIds = []] = await getFollowingAndSelfUserIds(userId);
  // const [allCommunityId, allCommunityGroupId] = (await getUserJoinedCommunityIds(userId)) || [];
  const allCommunityId = (await getUserJoinedCommunityIds(userId)) || [];
  const mutualIds = followingAndSelfUserIds
    .map((id) => id.toString())
    .filter((id) => followersAndSelfUserIds.map((fid) => fid.toString()).includes(id));

  const skip = (page - 1) * limit;

  const totalUserPosts = await countUserPostsForUserIds(followingAndSelfUserIds!);

  // const totalCommunityPosts = await countCommunityPostsForUserIds(allCommunityId, allCommunityGroupId);
  const totalCommunityPosts = await countCommunityPostsForUserIds(allCommunityId);

  const totalPosts = totalUserPosts + totalCommunityPosts;

  const UsersPosts = await getUserPostsForUserIds(String(userId), followingAndSelfUserIds!, mutualIds, skip, limit);

  const remainingLimit = Math.max(0, 5 - UsersPosts.length);

  // const CommunityPosts = await getCommunityPostsForUser(
  //   allCommunityId,
  //   allCommunityGroupId,
  //   followingAndSelfUserIds,
  //   limit + remainingLimit,
  //   skip
  // );
  const CommunityPosts = await getCommunityPostsForUser(
    allCommunityId,

    followingAndSelfUserIds,
    limit + remainingLimit,
    skip
  );

  const allPosts: any = [...UsersPosts, ...CommunityPosts];
  allPosts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

  // return allPosts;
  // Calculate total pages
  const totalPages = Math.ceil(totalPosts / limit);

  // Return posts and pagination details
  return {
    allPosts,
    currentPage: page,
    totalPages,
    totalPosts,
  };
};

// Helper Services

const countUserPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[]) => {
  const ids = userIDs.map((item) => new mongoose.Types.ObjectId(item as any));

  try {
    const totalUserPosts = await UserPostModel.countDocuments({ user_id: { $in: ids } });
    return totalUserPosts;
  } catch (error) {
    console.error('Error counting user posts:', error);
    throw new Error('Failed to count user posts');
  }
};

// Function to count community posts
// const countCommunityPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[]) => {
//   const ids = userIDs.map((item) => new mongoose.Types.ObjectId(item as any));

//   try {
//     const totalCommunityPosts = await CommunityPostModel.countDocuments({
//       user_id: { $in: ids },
//       communityPostsType: 'Public', // Only public posts count
//     });
//     return totalCommunityPosts;
//   } catch (error) {
//     console.error('Error counting community posts:', error);
//     throw new Error('Failed to count community posts');
//   }
// };

const countCommunityPostsForUserIds = async (communityIds: string[] = []) => {
  try {
    const matchConditions: any = [
      {
        communityId: { $in: communityIds.map((id) => new mongoose.Types.ObjectId(id)) },
        communityPostsType: CommunityType.PUBLIC,
        communiyGroupId: { $exists: false },
      },
    ];

    const matchStage: any = {
      $or: matchConditions,
    };

    const totalCommunityPosts = await CommunityPostModel.countDocuments(matchStage);

    return totalCommunityPosts;
  } catch (error) {
    console.error('Error counting community posts:', error);
    throw new Error('Failed to count community posts');
  }
};

// Get user IDs of the user and their followers
export const getFollowingAndSelfUserIds = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingUsers = await UserProfile.findOne({ users_id: userId });
  let followingUserIds: mongoose.Schema.Types.ObjectId[] = [];
  let followersUserIds: mongoose.Schema.Types.ObjectId[] = [];

  if (followingUsers?.following?.length) {
    followingUserIds = followingUsers?.following.map((user) => user.userId);
  }
  if (followingUsers?.followers?.length) {
    followersUserIds = followingUsers?.followers.map((user) => user.userId);
  }
  followingUserIds.push(userId);
  followersUserIds.push(userId);
  return [followingUserIds, followersUserIds];
};

const getUserPostsForUserIds = async (
  userId: string,
  FollowerIds: mongoose.Schema.Types.ObjectId[],
  mutualIds: string[],
  page: number,
  limit: number
) => {
  const ids = FollowerIds.map((item) => new mongoose.Types.ObjectId(item as any));
  const mutualId = mutualIds.map((item) => new mongoose.Types.ObjectId(item as any));

  const matchConditions: any = [
    {
      user_id: { $in: ids },
      PostType: userPostType.PUBLIC,
    },
    {
      user_id: { $in: ids },
      PostType: userPostType.FOLLOWER_ONLY,
    },
    {
      user_id: { $in: mutualId },
      PostType: userPostType.MUTUAL,
    },
    {
      user_id: new mongoose.Types.ObjectId(userId),
      PostType: userPostType.ONLY_ME,
    },
  ];

  const matchStage: any = {
    $or: matchConditions,
  };

  try {
    const followingUserPosts = await UserPostModel.aggregate([
      {
        // $match: {
        //   user_id: { $in: ids },
        // },
        $match: matchStage,
      },
      {
        $sort: { createdAt: -1 },
      },
      { $skip: page },
      { $limit: limit },

      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $lookup: {
          from: 'userprofiles',
          localField: 'user._id',
          foreignField: 'users_id',
          as: 'userProfile',
        },
      },
      {
        $unwind: { path: '$userProfile', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'userpostcomments',
          localField: '_id',
          foreignField: 'userPostId',
          as: 'comments',
        },
      },
      {
        $addFields: {
          commentCount: { $size: '$comments' },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          imageUrl: 1,
          likeCount: 1,
          commentCount: 1,
          user: {
            _id: 1,
            firstName: 1,
            lastName: 1,
          },
          userProfile: {
            profile_dp: 1,
            university_name: 1,
            study_year: 1,
            degree: 1,
          },
        },
      },
    ]).exec();

    return followingUserPosts;
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error('Failed to Get User Posts');
  }
};

export const getCommunityPostsForUser = async (
  communityIds: string[] = [],
  FollowinguserIds: mongoose.Schema.Types.ObjectId[] = [],
  limit: number,
  skip: number
) => {
  try {
    const FollowingIds = FollowinguserIds.map((item) => new mongoose.Types.ObjectId(item as any));

    const matchConditions: any = [
      {
        communityId: { $in: communityIds.map((id) => new mongoose.Types.ObjectId(id)) },
        communiyGroupId: { $exists: false },
        communityPostsType: CommunityType.PUBLIC,
      },
      {
        communityId: { $in: communityIds.map((id) => new mongoose.Types.ObjectId(id)) },
        communiyGroupId: { $exists: false },
        communityPostsType: CommunityType.FOLLOWER_ONLY,
        user_id: { $in: FollowingIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    ];

    const matchStage: any = {
      $or: matchConditions,
    };

    const finalPost =
      (await CommunityPostModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'userprofiles',
            localField: 'user._id',
            foreignField: 'users_id',
            as: 'userProfile',
          },
        },
        { $unwind: { path: '$userProfile', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'communitypostcomments',
            localField: '_id',
            foreignField: 'communityId',
            as: 'comments',
          },
        },
        {
          $addFields: {
            commentCount: { $size: '$comments' },
          },
        },
        {
          $project: {
            _id: 1,
            content: 1,
            createdAt: 1,
            imageUrl: 1,
            likeCount: 1,
            commentCount: 1,
            communiyGroupId: 1,
            communityId: 1,
            communityPostsType: 1,
            user: {
              _id: 1,
              firstName: 1,
              lastName: 1,
            },
            userProfile: {
              profile_dp: 1,
              university_name: 1,
              study_year: 1,
              degree: 1,
            },
          },
        },
      ]).exec()) || [];

    return finalPost;
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error('Failed to Get User Posts');
  }
};
export const getUserPost = async (postId: string, myUserId: string) => {
  try {
    const userProfile = await UserProfile.findOne({ users_id: myUserId });
    const followingIds = userProfile?.following.map((user) => user.userId.toString()) || [];
    const followertsIds = userProfile?.followers.map((user) => user.userId.toString()) || [];
    const mutualIds = followertsIds
      .map((id) => id.toString())
      .filter((id) => followertsIds.map((fid) => fid.toString()).includes(id));
    const mutualId = mutualIds.map((item) => new mongoose.Types.ObjectId(item as any));
    const userId = new mongoose.Types.ObjectId(myUserId);
    const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));

    const postIdToGet = new mongoose.Types.ObjectId(postId);

    const pipeline = [
      { $match: { _id: postIdToGet } },

      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'postOwner',
        },
      },
      { $unwind: { path: '$postOwner', preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          isPublic: { $eq: ['$PostType', userPostType.PUBLIC] },
          isFollowerOnly: { $eq: ['$PostType', userPostType.FOLLOWER_ONLY] },
          isMutual: { $eq: ['$PostType', userPostType.MUTUAL] },
          isOnlyMe: { $eq: ['$PostType', userPostType.ONLY_ME] },

          isAuthorizedUser: {
            $or: [{ $eq: ['$user_id', userId] }, { $in: ['$user_id', followingObjectIds] }],
          },
          isAuthorizedUserAndMutual: {
            $or: [{ $eq: ['$user_id', userId] }, { $in: ['$user_id', mutualId] }],
          },
        },
      },

      {
        $match: {
          $or: [
            { isPublic: true },
            { isFollowerOnly: true, isAuthorizedUser: true },
            { isMutual: true, isAuthorizedUserAndMutual: true },
            { isOnlyMe: true, user_id: userId },
          ],
        },
      },

      {
        $lookup: {
          from: 'userprofiles',
          localField: 'user_id',
          foreignField: 'users_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'userpostcomments',
          localField: '_id',
          foreignField: 'userPostId',
          as: 'comments',
        },
      },

      {
        $addFields: {
          commentCount: { $size: '$comments' },
        },
      },

      {
        $project: {
          _id: 1,
          user_id: 1,
          PostType: 1,
          content: 1,
          imageUrl: 1,
          likeCount: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            firstName: '$postOwner.firstName',
            lastName: '$postOwner.lastName',
          },
          profile: '$profile',
          commentCount: 1,
        },
      },
    ];

    return await UserPostModel.aggregate(pipeline);
  } catch (error) {
    console.error('Error fetching getUserPost', error);
    throw new Error(error as string);
  }
};
