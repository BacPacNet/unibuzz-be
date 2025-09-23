import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile, userProfileService } from '../userProfile';
import { CommunityType, userPostType } from '../../config/community.type';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { convertToObjectId } from '../../utils/common';
import PostRelationship from './postRelationship.model';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';

export const getAllUserPosts = async (userId: string, page: number = 1, limit: number = 10, myUserId?: string) => {
  const skip = (page - 1) * limit;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const pipeline: any[] = [
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
  ];

  if (myUserId) {
    pipeline.push({
      $match: {
        'userProfile.blockedUsers.userId': {
          $ne: new mongoose.Types.ObjectId(myUserId),
        },
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'userpostcomments',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$userPostId', '$$postId'] },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'allComments',
      },
    },
    {
      $addFields: {
        commentCount: { $size: '$allComments' },
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
          isCommunityAdmin: 1,
          adminCommunityId: 1,
        },
      },
    }
  );

  const userPosts = await UserPostModel.aggregate(pipeline).exec();

  const totalPosts = await UserPostModel.countDocuments({ user_id: userId });

  return {
    data: userPosts,
    currentPage: page,
    totalPages: Math.ceil(totalPosts / limit),
    totalPosts,
  };
};

export const createUserPost = async (post: userPostInterface) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const createdPost = await UserPostModel.create([post], { session });

    if (!createdPost || createdPost.length === 0) {
      throw new Error('Failed to create user post or post not found after creation.');
    }
    // Create relationship entry
    await PostRelationship.create(
      [
        {
          userId: post.user_id,
          userPostId: createdPost[0]!._id,
          type: 'user',
        },
      ],
      { session }
    );
    await session.commitTransaction();
    return createdPost[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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
  //   if (!isOwnPost && !hasLiked) {
  if (!isOwnPost) {
    const notification = {
      sender_id: userId,
      receiverId: post.user_id,
      userPostId: post._id,
      type: notificationRoleAccess.REACTED_TO_POST,
      message: 'Reacted to your Post.',
    };
    // await notificationQueue.add(NotificationIdentifier.like_notification, notification);

    await queueSQSNotification(notification);
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Delete the user post
    const result = await UserPostModel.deleteOne({ _id: id }, { session });
    // Delete the relationship entry
    await PostRelationship.deleteMany({ userPostId: id }, { session });
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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

export const getRecentTimelinePosts = async (userId: string, page: number = 1, limit: number = 10): Promise<any> => {
  try {
    // 1. Get user's profile with following and communities
    const userProfile = await UserProfile.findOne({ users_id: userId }).select('following communities').lean();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // 2. Extract IDs for queries
    const followingUserIds = userProfile.following.filter((follow) => !follow.isBlock).map((follow) => follow.userId);

    const communityIds = userProfile.communities.map((community) => community.communityId);

    const communityGroupIds: mongoose.Types.ObjectId[] = userProfile.communities.flatMap((community) =>
      (community.communityGroups || []).map((group) => new mongoose.Types.ObjectId(group.id))
    );

    // 3. Create match stages for both post types
    const userPostMatchStage = {
      $or: [
        { user_id: { $in: followingUserIds }, PostType: 'PUBLIC' },
        { user_id: { $in: followingUserIds }, PostType: 'FOLLOWER_ONLY' },
        { user_id: convertToObjectId(userId) }, // User can always see their own posts
      ],
    };

    const communityPostMatchStage = {
      $or: [
        {
          communityId: { $in: communityIds },
          communityGroupId: null,
          communityPostsType: 'PUBLIC',
        },
        {
          communityGroupId: { $in: communityGroupIds },
        },
      ],
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
          $lookup: {
            from: 'userpostcomments',
            let: { commentIds: '$comments._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$commentIds'] },
                },
              },
              {
                $graphLookup: {
                  from: 'userpostcomments',
                  startWith: '$replies',
                  connectFromField: 'replies',
                  connectToField: '_id',
                  as: 'nestedReplies',
                },
              },
            ],
            as: 'commentsWithReplies',
          },
        },
        {
          $addFields: {
            commentCount: {
              $add: [
                { $size: '$comments' },
                {
                  $reduce: {
                    input: '$commentsWithReplies',
                    initialValue: 0,
                    in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                  },
                },
              ],
            },
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
              isCommunityAdmin: 1,
              adminCommunityId: 1,
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
            foreignField: 'postId',
            as: 'comments',
          },
        },
        {
          $lookup: {
            from: 'communitypostcomments',
            let: { commentIds: '$comments._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$commentIds'] },
                },
              },
              {
                $graphLookup: {
                  from: 'communitypostcomments',
                  startWith: '$replies',
                  connectFromField: 'replies',
                  connectToField: '_id',
                  as: 'nestedReplies',
                },
              },
            ],
            as: 'commentsWithReplies',
          },
        },
        {
          $addFields: {
            commentCount: {
              $add: [
                { $size: '$comments' },
                {
                  $reduce: {
                    input: '$commentsWithReplies',
                    initialValue: 0,
                    in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                  },
                },
              ],
            },
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
              isCommunityAdmin: 1,
              adminCommunityId: 1,
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
      .sort((a, b) => {
        const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        return dateB - dateA;
      })
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
        $lookup: {
          from: 'userpostcomments',
          let: { commentIds: '$comments._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$commentIds'] },
              },
            },
            {
              $graphLookup: {
                from: 'userpostcomments',
                startWith: '$replies',
                connectFromField: 'replies',
                connectToField: '_id',
                as: 'nestedReplies',
              },
            },
          ],
          as: 'commentsWithReplies',
        },
      },
      {
        $addFields: {
          commentCount: {
            $add: [
              { $size: '$comments' },
              {
                $reduce: {
                  input: '$commentsWithReplies',
                  initialValue: 0,
                  in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                },
              },
            ],
          },
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
            isCommunityAdmin: 1,
            adminCommunityId: 1,
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
          $lookup: {
            from: 'communitypostcomments',
            let: { commentIds: '$comments._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$commentIds'] },
                },
              },
              {
                $graphLookup: {
                  from: 'communitypostcomments',
                  startWith: '$replies',
                  connectFromField: 'replies',
                  connectToField: '_id',
                  as: 'nestedReplies',
                },
              },
            ],
            as: 'commentsWithReplies',
          },
        },
        {
          $addFields: {
            commentCount: {
              $add: [
                { $size: '$comments' },
                {
                  $reduce: {
                    input: '$commentsWithReplies',
                    initialValue: 0,
                    in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                  },
                },
              ],
            },
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
              isCommunityAdmin: 1,
              adminCommunityId: 1,
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
              $or: [
                { $eq: ['$user_id', userId] },
                ...(followingObjectIds.length > 0 ? [{ $in: ['$user_id', followingObjectIds] }] : []),
              ],
            },
            isAuthorizedUserAndMutual: {
              $or: [{ $eq: ['$user_id', userId] }, ...(mutualId.length > 0 ? [{ $in: ['$user_id', mutualId] }] : [])],
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

      ...(myUserId
        ? [
            {
              $match: {
                $expr: {
                  $not: {
                    $in: [userId, { $ifNull: ['$profile.blockedUsers.userId', []] }],
                  },
                },
              },
            },
          ]
        : []),
      {
        $lookup: {
          from: 'userpostcomments',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userPostId', '$$postId'] },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'allComments',
        },
      },
      {
        $addFields: {
          commentCount: { $size: '$allComments' },
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

export const getFullTimelinePosts = async (userId: string, page: number = 1, limit: number = 10) => {
  // Explicitly type userProfile as any to avoid linter errors for dynamic Mongoose documents
  const userProfile: any = await UserProfile.findOne({ users_id: userId }).select('following communities').lean();
  if (!userProfile) throw new Error('User profile not found');

  // 2. Extract IDs
  const followingUserIds = userProfile.following
    .filter((f: { userId: any; isBlock: boolean }) => !f.isBlock)
    .map((f: { userId: any }) => {
      if (typeof f.userId === 'string') return f.userId;
      if (f.userId && typeof f.userId === 'object' && typeof f.userId.toString === 'function') return f.userId.toString();
      return String(f.userId);
    });
  followingUserIds.push(userId); // include self

  const communityIds = userProfile.communities.map((c: any) =>
    typeof c.communityId === 'string' ? c.communityId : c.communityId.toString()
  );

  // Get accepted group IDs (status === 'accepted')
  const acceptedGroupIds = userProfile.communities.flatMap((c: any) =>
    (c.communityGroups || [])
      .filter((g: any) => g.status === 'accepted')
      .map((g: any) => (typeof g.id === 'string' ? new mongoose.Types.ObjectId(g.id) : g.id))
  );

  // 3. Aggregation queries
  const [userPosts, communityPosts, groupPosts] = await Promise.all([
    // User posts
    UserPostModel.aggregate([
      { $match: { user_id: { $in: followingUserIds.map((id: any) => new mongoose.Types.ObjectId(id)) } } },
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
        $lookup: {
          from: 'userpostcomments',
          let: { commentIds: '$comments._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$commentIds'] },
              },
            },
            {
              $graphLookup: {
                from: 'userpostcomments',
                startWith: '$replies',
                connectFromField: 'replies',
                connectToField: '_id',
                as: 'nestedReplies',
              },
            },
          ],
          as: 'commentsWithReplies',
        },
      },
      {
        $addFields: {
          commentCount: {
            $add: [
              { $size: '$comments' },
              {
                $reduce: {
                  input: '$commentsWithReplies',
                  initialValue: 0,
                  in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                },
              },
            ],
          },
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
            isCommunityAdmin: 1,
            adminCommunityId: 1,
          },
        },
      },
    ]),
    // Community posts
    CommunityPostModel.aggregate([
      {
        $match: {
          communityId: { $in: communityIds.map((id: any) => new mongoose.Types.ObjectId(id)) },
          communityGroupId: null,
        },
      },
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
          foreignField: 'postId',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'communitypostcomments',
          let: { commentIds: '$comments._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$commentIds'] },
              },
            },
            {
              $graphLookup: {
                from: 'communitypostcomments',
                startWith: '$replies',
                connectFromField: 'replies',
                connectToField: '_id',
                as: 'nestedReplies',
              },
            },
          ],
          as: 'commentsWithReplies',
        },
      },
      {
        $addFields: {
          commentCount: {
            $add: [
              { $size: '$comments' },
              {
                $reduce: {
                  input: '$commentsWithReplies',
                  initialValue: 0,
                  in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                },
              },
            ],
          },
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
            isCommunityAdmin: 1,
            adminCommunityId: 1,
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
    // Community group posts
    CommunityPostModel.aggregate([
      { $match: { communityGroupId: { $in: acceptedGroupIds } } },
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
          foreignField: 'postId',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'communitypostcomments',
          let: { commentIds: '$comments._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$commentIds'] },
              },
            },
            {
              $graphLookup: {
                from: 'communitypostcomments',
                startWith: '$replies',
                connectFromField: 'replies',
                connectToField: '_id',
                as: 'nestedReplies',
              },
            },
          ],
          as: 'commentsWithReplies',
        },
      },
      {
        $addFields: {
          commentCount: {
            $add: [
              { $size: '$comments' },
              {
                $reduce: {
                  input: '$commentsWithReplies',
                  initialValue: 0,
                  in: { $add: ['$$value', { $size: '$$this.nestedReplies' }] },
                },
              },
            ],
          },
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
            isCommunityAdmin: 1,
            adminCommunityId: 1,
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
  ]);

  // 4. Merge, sort, paginate
  const allPosts = [...userPosts, ...communityPosts, ...groupPosts]
    .sort((a, b) => {
      const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit);

  return {
    allPosts,
    currentPage: page,
    totalPages: Math.ceil((userPosts.length + communityPosts.length + groupPosts.length) / limit),
    totalPosts: userPosts.length + communityPosts.length + groupPosts.length,
    hasNextPage: page * limit < userPosts.length + communityPosts.length + groupPosts.length,
    hasPreviousPage: page > 1,
  };
};

/**
 * Fetch all timeline posts for a user using the PostRelationship schema.
 * @param userId - The user's ID (string)
 * @param followingUserIds - Array of user IDs the user follows (including self)
 * @param joinedCommunityIds - Array of community IDs the user has joined
 * @param joinedGroupIds - Array of group IDs the user has joined and been accepted into
 * @param page - Page number (default 1)
 * @param limit - Page size (default 10)
 */

export const getTimelinePostsFromRelationship = async (userId: string, page: number = 1, limit: number = 10) => {
  const userProfile: any = await UserProfile.findOne({ users_id: userId }).select('following communities').lean();
  if (!userProfile) throw new Error('User profile not found');

  const followingUserIds = userProfile.following.map((f: { userId: any }) =>
    typeof f.userId === 'string' ? f.userId : f.userId?.toString?.() || String(f.userId)
  );
  followingUserIds.push(userId);

  const joinedCommunityIds = userProfile.communities.map((c: any) =>
    typeof c.communityId === 'string' ? c.communityId : c.communityId.toString()
  );

  const joinedGroupIds = userProfile.communities.flatMap((c: any) =>
    (c.communityGroups || [])
      .filter((g: any) => g.status === 'accepted')
      .map((g: any) => (typeof g.id === 'string' ? new mongoose.Types.ObjectId(g.id) : g.id))
  );

  const orQuery: any[] = [];
  if (followingUserIds.length) {
    orQuery.push({ type: 'user', userId: { $in: followingUserIds } });
  }
  if (joinedCommunityIds.length) {
    orQuery.push({ type: 'community', communityId: { $in: joinedCommunityIds } });
  }
  if (joinedGroupIds.length) {
    orQuery.push({ type: 'group', communityGroupId: { $in: joinedGroupIds } });
  }
  if (!orQuery.length) {
    return {
      allPosts: [],
      currentPage: page,
      totalPages: 0,
      totalPosts: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const relationships = await PostRelationship.find({ $or: orQuery }).lean();

  const userPostIds = relationships.filter((r) => r.type === 'user' && r.userPostId).map((r) => r.userPostId);

  const communityPostIds = relationships
    .filter((r) => (r.type === 'community' || r.type === 'group') && r.communityPostId)
    .map((r) => r.communityPostId);

  const [userPosts, communityPosts] = await Promise.all([
    userPostIds.length
      ? UserPostModel.aggregate([
          { $match: { _id: { $in: userPostIds } } },
          { $sort: { createdAt: -1 } },
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
            $unwind: {
              path: '$userProfile',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $match: {
              'userProfile.blockedUsers.userId': {
                $ne: new mongoose.Types.ObjectId(userId),
              },
            },
          },

          {
            $lookup: {
              from: 'userpostcomments',
              let: { postId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$userPostId', '$$postId'] },
                  },
                },
                { $project: { _id: 1 } },
              ],
              as: 'allComments',
            },
          },
          {
            $addFields: {
              commentCount: { $size: '$allComments' },
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
                isCommunityAdmin: 1,
                adminCommunityId: 1,
              },
            },
          },
        ])
      : [],
    communityPostIds.length
      ? CommunityPostModel.aggregate([
          { $match: { _id: { $in: communityPostIds }, isPostLive: true } },
          { $sort: { createdAt: -1 } },
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
            $unwind: {
              path: '$userProfile',
              preserveNullAndEmptyArrays: true,
            },
          },
          //   {
          //     $match: {
          //       'userProfile.blockedUsers.userId': {
          //         $ne: new mongoose.Types.ObjectId(userId),
          //       },
          //     },
          //   },
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
              let: { postId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$postId', '$$postId'] },
                  },
                },
                { $project: { _id: 1 } },
              ],
              as: 'allComments',
            },
          },
          {
            $addFields: {
              commentCount: { $size: '$allComments' },
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
                isCommunityAdmin: 1,
                adminCommunityId: 1,
              },
              community: {
                _id: 1,
                name: 1,
                logo: 1,
                description: 1,
              },
            },
          },
        ])
      : [],
  ]);

  const allPosts = [...userPosts, ...communityPosts].sort((a, b) => {
    const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const totalPosts = allPosts.length;
  const totalPages = Math.ceil(totalPosts / limit);
  const paginatedPosts = allPosts.slice((page - 1) * limit, page * limit);

  return {
    allPosts: paginatedPosts,
    currentPage: page,
    totalPages,
    totalPosts,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
