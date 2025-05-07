import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile, userProfileService } from '../userProfile';
import { CommunityType, userPostType } from '../../config/community.type';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';

export const getAllUserPosts = async (userId: string, page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const userPosts = await UserPostModel.aggregate([
    {
      $match: {
        user_id: userObjectId,
      },
    },
    {
      $sort: { createdAt: -1 },
    },
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
          major: 1,
          affiliation: 1,
          occupation: 1,
          role: 1,
        },
      },
    },
  ]).exec();

  const totalPosts = await UserPostModel.countDocuments({ user_id: userId });

  return {
    data: userPosts,
    currentPage: page,
    totalPages: Math.ceil(totalPosts / limit),
    totalPosts,
  };
};

export const createUserPost = async (post: userPostInterface) => {
  return await UserPostModel.create(post);
};

export const likeUnlike = async (id: string, userId: string) => {
  const post = await UserPostModel.findById(id);
  if (!post) {
    throw new Error('Post not found');
  }

  // Determine if user already liked the post
  const hasLiked = post.likeCount.some((like) => like.userId.toString() === userId);
  const isOwnPost = userId === post.user_id.toString();

  // Prepare notification if needed
  if (!isOwnPost) {
    const notification = {
      sender_id: userId,
      receiverId: post.user_id,
      userPostId: post._id,
      type: notificationRoleAccess.REACTED_TO_POST,
      message: 'Reacted to your Post.',
    };
    await notificationQueue.add(NotificationIdentifier.like_notification, notification);
  }

  const updatedPost = await UserPostModel.findOneAndUpdate(
    { _id: id },
    hasLiked ? { $pull: { likeCount: { userId } } } : { $push: { likeCount: { userId } } },
    { new: true, select: 'likeCount' }
  );

  if (!updatedPost) {
    throw new Error('Failed to update post');
  }

  return {
    likeCount: updatedPost.likeCount,
    totalCount: updatedPost.likeCount.length,
  };
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
  const userProfile = await userProfileService.getUserProfileById(String(id));
  return userProfile?.communities.map((community) => community.communityId);
};

//interface PaginatedPosts {
//  posts: any[];
//  pagination: {
//    currentPage: number;
//    totalPages: number;
//    totalPosts: number;
//    hasNextPage: boolean;
//    hasPreviousPage: boolean;
//  };
//}

export const getRecentTimelinePosts = async (
  userId: mongoose.Types.ObjectId,
  page: number = 1,
  limit: number = 10
): Promise<any> => {
  try {
    // 1. Get user's profile with following and communities
    const userProfile = await UserProfile.findOne({ users_id: userId }).select('following communities').lean();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // 2. Extract IDs for queries
    const followingUserIds = userProfile.following.filter((follow) => !follow.isBlock).map((follow) => follow.userId);

    const communityIds = userProfile.communities.map((community) => community.communityId);

    // Include self in the user posts
    //const allUserIds = [...followingUserIds, userId];

    // 3. Create match stages for both post types
    const userPostMatchStage = {
      $or: [
        { user_id: { $in: followingUserIds }, PostType: 'PUBLIC' },
        { user_id: { $in: followingUserIds }, PostType: 'FOLLOWER_ONLY' },
        { user_id: userId }, // User can always see their own posts
      ],
    };

    const communityPostMatchStage = {
      communityId: { $in: communityIds },
      communityPostsType: 'PUBLIC',
    };

    // 4. Fetch posts using aggregation with full population
    const [userPosts, communityPosts, totalUserPosts, totalCommunityPosts] = await Promise.all([
      // User posts aggregation
      UserPostModel.aggregate([
        { $match: userPostMatchStage },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
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
            postType: 'user', // Add post type identifier
          },
        },
        {
          $project: {
            _id: 1,
            content: 1,
            createdAt: 1,
            updatedAt: 1,
            imageUrl: 1,
            likeCount: 1,
            commentCount: 1,
            PostType: 1,
            postType: 1,
            user: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
            },
            userProfile: {
              profile_dp: 1,
              university_name: 1,
              study_year: 1,
              degree: 1,
              major: 1,
              affiliation: 1,
              occupation: 1,
              role: 1,
            },
          },
        },
      ]),

      // Community posts aggregation
      CommunityPostModel.aggregate([
        { $match: communityPostMatchStage },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
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
        {
          $unwind: { path: '$userProfile', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'communities',
            localField: 'communityId',
            foreignField: '_id',
            as: 'community',
          },
        },
        { $unwind: '$community' },
        {
          $lookup: {
            from: 'communitypostcomments',
            localField: '_id',
            foreignField: 'communityPostId',
            as: 'comments',
          },
        },
        {
          $addFields: {
            commentCount: { $size: '$comments' },
            postType: 'community', // Add post type identifier
          },
        },
        {
          $project: {
            _id: 1,
            content: 1,
            createdAt: 1,
            updatedAt: 1,
            imageUrl: 1,
            likeCount: 1,
            commentCount: 1,
            communityPostsType: 1,
            isPostVerified: 1,
            postType: 1,
            communityName: 1,
            communityGroupName: 1,
            communityGroupId: 1,
            user: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
            },
            userProfile: {
              profile_dp: 1,
              university_name: 1,
              study_year: 1,
              degree: 1,
              major: 1,
              affiliation: 1,
              occupation: 1,
              role: 1,
            },
            community: {
              _id: 1,
              name: 1,
              logo: 1,
              description: 1,
            },
          },
        },
      ]),

      // Count queries remain the same
      UserPostModel.countDocuments(userPostMatchStage),
      CommunityPostModel.countDocuments(communityPostMatchStage),
    ]);

    // 5. Combine and sort posts by date
    const allPosts = [...userPosts, ...communityPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // 6. Calculate pagination details
    const totalPosts = totalUserPosts + totalCommunityPosts;
    const totalPages = Math.ceil(totalPosts / limit);

    return {
      allPosts,
      currentPage: page,
      totalPages,
      totalPosts,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  } catch (error) {
    console.error('Error in getRecentTimelinePosts:', error);
    throw new Error('Failed to fetch timeline posts');
  }
};
export const getAllTimelinePosts = async (userId: mongoose.Schema.Types.ObjectId, page: number = 1, limit: number = 5) => {
  // Get user IDs of the user and their followers
  const [followingAndSelfUserIds = [], followersAndSelfUserIds = []] = await getFollowingAndSelfUserIds(userId);
  const allCommunityId = (await getUserJoinedCommunityIds(userId)) || [];
  const mutualIds = followingAndSelfUserIds
    .map((id) => id.toString())
    .filter((id) => followersAndSelfUserIds.map((fid) => fid.toString()).includes(id));

  const skip = (page - 1) * limit;

  const totalUserPosts = await countUserPostsForUserIds(followingAndSelfUserIds!);

  const totalCommunityPosts = await countCommunityPostsForUserIds(allCommunityId);

  const totalPosts = totalUserPosts + totalCommunityPosts;

  const UsersPosts = await getUserPostsForUserIds(String(userId), followingAndSelfUserIds!, mutualIds, skip, limit);

  const remainingLimit = Math.max(0, 5 - UsersPosts.length);

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

const countCommunityPostsForUserIds = async (communityIds: string[] = []) => {
  try {
    const matchConditions: any = [
      {
        communityId: { $in: communityIds.map((id) => new mongoose.Types.ObjectId(id)) },
        communityPostsType: CommunityType.PUBLIC,
        communityGroupId: { $exists: false },
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
export const getFollowingAndSelfUserIds = async (userId: any) => {
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
            major: 1,
            affiliation: 1,
            occupation: 1,
            role: 1,
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
        communityGroupId: { $exists: false },
        communityPostsType: CommunityType.PUBLIC,
      },
      {
        communityId: { $in: communityIds.map((id) => new mongoose.Types.ObjectId(id)) },
        communityGroupId: { $exists: false },
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
            communityGroupId: 1,
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
              major: 1,
              affiliation: 1,
              occupation: 1,
              role: 1,
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

export const getUserPost = async (postId: string, myUserId: string = '') => {
  try {
    const userProfile = myUserId ? await UserProfile.findOne({ users_id: myUserId }) : null;
    const followingIds = userProfile?.following.map((user) => user.userId.toString()) || [];
    const followertsIds = userProfile?.followers.map((user) => user.userId.toString()) || [];
    const mutualIds = followertsIds
      .map((id) => id.toString())
      .filter((id) => followertsIds.map((fid) => fid.toString()).includes(id));
    const mutualId = mutualIds.map((item) => new mongoose.Types.ObjectId(item as any));
    const userId = myUserId ? new mongoose.Types.ObjectId(myUserId) : null;
    const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));

    const postIdToGet = new mongoose.Types.ObjectId(postId);

    const pipeline: any[] = [{ $match: { _id: postIdToGet } }];

    if (!myUserId) {
      pipeline.push({
        $match: { PostType: userPostType.PUBLIC },
      });
    } else {
      pipeline.push(
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
        }
      );
    }

    pipeline.push(
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
      }
    );

    return await UserPostModel.aggregate(pipeline);
  } catch (error) {
    console.error('Error fetching getUserPost', error);
    throw new Error(error as string);
  }
};
