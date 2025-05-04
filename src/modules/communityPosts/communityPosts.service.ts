import mongoose, { Types } from 'mongoose';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import { CommunityType } from '../../config/community.type';
import { UserProfile } from '../userProfile';
import { communityGroupModel } from '../communityGroup';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import communityModel from '../community/community.model';
import { convertToObjectId } from '../../utils/common';

export const createCommunityPost = async (post: communityPostsInterface, userId: mongoose.Types.ObjectId) => {
  const { communityId, communityGroupId } = post;

  const community = await communityModel.findOne({ _id: communityId }, 'name');
  const communityName = community?.name;
  let communityGroup: any;
  if (communityGroupId) {
    communityGroup = await communityGroupModel.findOne({ _id: communityGroupId }, ['title', 'communityGroupAccess']);
  }
  const postData = { ...post, user_id: userId };
  const isPostVerified = () => {
    if (communityGroup) {
      return communityGroup.communityGroupAccess === 'Private';
    }
    return false;
  };

  return await CommunityPostModel.create({
    ...postData,
    communityName,
    communityGroupName: communityGroup?.title,
    isPostVerified: isPostVerified(),
  });
};

export const likeUnlike = async (id: string, userId: string) => {
  const post = await communityPostsModel.findById(id);

  if (!post?.likeCount.some((x) => x.userId === userId)) {
    const notifications = {
      sender_id: userId,
      receiverId: post?.user_id,
      communityPostId: post?._id,
      type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
      message: 'Reacted to your Community Post.',
    };
    if (userId !== String(post?.user_id)) {
      await notificationQueue.add(NotificationIdentifier.community_post_like_notification, notifications);
    }

    await post?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    await post.updateOne({ $pull: { likeCount: { userId } } });
  }

  const updatedPost = await communityPostsModel.findById(id).select('likeCount');
  return { likeCount: updatedPost?.likeCount };
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

export const getCommunityPostsByCommunityId = async (communityId: string, page: number = 1, limit: number = 10) => {
  try {
    const communityObjectId = new Types.ObjectId(communityId);

    const finalPost = await CommunityPostModel.aggregate([
      {
        $match: {
          communityId: communityObjectId,
          communityGroupId: null,
        },
      },
      {
        $sort: {
          createdAt: -1, // latest first
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
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
          isPostVerified: 1,
          communityName: 1,
          communityGroupName: 1,
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
    ]);

    const total = await CommunityPostModel.countDocuments({ communityId: communityObjectId });

    return {
      finalPost,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: any) {
    throw new Error(`Failed to get community posts: ${error.message}`);
  }
};

export const getCommunityGroupPostsByCommunityId = async (
  communityId: string,
  communityGroupId: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const communityObjectId = convertToObjectId(communityId);
    const communityGroupObjectId = convertToObjectId(communityGroupId);

    const finalPost = await CommunityPostModel.aggregate([
      {
        $match: {
          communityId: communityObjectId,
          communityGroupId: communityGroupObjectId,
        },
      },
      {
        $sort: {
          createdAt: -1, // latest first
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
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
          isPostVerified: 1,
          communityName: 1,
          communityGroupName: 1,
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
    ]);

    const total = await CommunityPostModel.countDocuments({ communityId: communityObjectId });

    return {
      finalPost,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: any) {
    throw new Error(`Failed to get community posts: ${error.message}`);
  }
};

export const getAllCommunityPost = async (
  FollowinguserIds: mongoose.Schema.Types.ObjectId[] = [],
  communityId: string,
  communityGroupId?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const FollowingIds = FollowinguserIds.map((item) => new mongoose.Types.ObjectId(item as any));

    const matchConditions: any = [];

    // Default conditions when communityGroupId is not provided
    if (!communityGroupId || communityGroupId.length === 0) {
      matchConditions.push(
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communityPostsType: CommunityType.PUBLIC,
          communityGroupId: { $exists: false },
        },
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communityPostsType: CommunityType.FOLLOWER_ONLY,
          user_id: { $in: FollowingIds.map((id) => new mongoose.Types.ObjectId(id)) },
          communityGroupId: { $exists: false },
        }
      );
    } else {
      // Conditions when communityGroupId is provided
      matchConditions.push(
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
          communityPostsType: CommunityType.PUBLIC,
        },
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
          communityPostsType: CommunityType.FOLLOWER_ONLY,
          user_id: { $in: FollowingIds.map((id) => new mongoose.Types.ObjectId(id)) },
        }
      );
    }

    const matchStage: any = {
      $or: matchConditions,
    };

    const totalPost = await CommunityPostModel.countDocuments(matchStage);
    const totalPages = Math.ceil(totalPost / limit);

    const skip = (page - 1) * limit;

    const finalPost =
      (await CommunityPostModel.aggregate([
        {
          $match: matchStage,
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },

        {
          $unwind: { path: '$communityGroup', preserveNullAndEmptyArrays: true },
        },
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
            isPostVerified: 1,
            communityName: 1,
            communityGroupName: 1,
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

    return {
      finalPost,
      currentPage: page,
      totalPages,
      totalPost,
    };
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error('Failed to Get User Posts');
  }
};

export const getcommunityPost = async (postId: string, myUserId: string = '') => {
  try {
    const userProfile = await UserProfile.findOne({ users_id: myUserId });
    const followingIds = userProfile?.following.map((user) => user.userId.toString()) || [];
    const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));
    const userId = new mongoose.Types.ObjectId(myUserId);
    const postIdToGet = new mongoose.Types.ObjectId(postId);

    const allCommunityIds = userProfile?.communities;

    const post = await communityPostsModel.findOne({ _id: postIdToGet });
    if (!post) throw new Error('Post not found');

    let isCommunityGroupMember = false;
    if (post.communityGroupId) {
      const communityGroup = await communityGroupModel.findOne({
        _id: post.communityGroupId,
        'users.userId': myUserId,
      });
      isCommunityGroupMember = !!communityGroup;

      if (!communityGroup) throw new Error('you are not a member');
    }

    const pipeline = [
      { $match: { _id: postIdToGet } },

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
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },

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
          commentCount: { $size: { $ifNull: ['$comments', []] } }, // Count comments here
          isPublic: { $eq: ['$communityPostsType', CommunityType.PUBLIC] },
          isFollowerOnly: { $eq: ['$communityPostsType', CommunityType.FOLLOWER_ONLY] },

          isCommunityMember: {
            $or: [
              { $eq: ['$user_id', userId] },
              { $in: ['$communityId', allCommunityIds] },
              { $literal: isCommunityGroupMember },
            ],
          },

          isFollowing: {
            $or: [{ $eq: ['$user_id', userId] }, { $in: ['$user_id', followingObjectIds] }],
          },

          comments: { $ifNull: ['$comments', []] },
        },
      },

      { $unwind: { path: '$comments', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'users',
          localField: 'comments.commenterId',
          foreignField: '_id',
          as: 'commenter',
        },
      },
      { $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true } },

      {
        $match: {
          $or: [
            { isPublic: true },
            {
              isFollowerOnly: true,
              isCommunityMember: true,
              isFollowing: true,
            },
          ],
        },
      },

      {
        $project: {
          _id: 1,
          user_id: 1,
          communityId: 1,
          communityPostsType: 1,
          content: 1,
          imageUrl: 1,
          likeCount: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            firstName: '$user.firstName',
            lastName: '$user.lastName',
          },
          profile: '$profile',
          commentCount: 1, // Use the pre-calculated `commentCount`
        },
      },
    ];

    return await communityPostsModel.aggregate(pipeline);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error(error as string);
  }
};
