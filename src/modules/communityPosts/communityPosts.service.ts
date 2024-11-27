import mongoose from 'mongoose';
import { User } from '../user';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import { CommunityType } from '../../config/community.type';
import { UserProfile } from '../userProfile';

export const createCommunityPost = async (post: communityPostsInterface, userId: mongoose.Types.ObjectId) => {
  const postData = { ...post, user_id: userId };

  return await CommunityPostModel.create(postData);
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
          communiyGroupId: { $exists: false },
        },
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communityPostsType: CommunityType.FOLLOWER_ONLY,
          user_id: { $in: FollowingIds.map((id) => new mongoose.Types.ObjectId(id)) },
          communiyGroupId: { $exists: false },
        }
      );
    } else {
      // Conditions when communityGroupId is provided
      matchConditions.push(
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communiyGroupId: new mongoose.Types.ObjectId(communityGroupId),
          communityPostsType: CommunityType.PUBLIC,
        },
        {
          communityId: new mongoose.Types.ObjectId(communityId),
          communiyGroupId: new mongoose.Types.ObjectId(communityGroupId),
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

export const getcommunityPost = async (postId: string, myUserId: string) => {
  try {
    const user = await User.findById(myUserId);
    const userProfile = await UserProfile.findOne({ users_id: myUserId });
    const followingIds = userProfile?.following.map((user) => user.userId.toString()) || [];
    const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));
    const userId = new mongoose.Types.ObjectId(myUserId);
    const postIdToGet = new mongoose.Types.ObjectId(postId);

    const verifiedCommunityIds = user?.userVerifiedCommunities?.map((item) => item.communityId) || [];
    const unverifiedCommunityIds = user?.userUnVerifiedCommunities?.map((item) => item.communityId) || [];
    const allCommunityIds = [...verifiedCommunityIds, ...unverifiedCommunityIds].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

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
        $addFields: {
          isPublic: { $eq: ['$communityPostsType', CommunityType.PUBLIC] },
          isFollowerOnly: { $eq: ['$communityPostsType', CommunityType.FOLLOWER_ONLY] },

          isCommunityMember: {
            $or: [{ $eq: ['$user_id', userId] }, { $in: ['$communityId', allCommunityIds] }],
          },

          isFollowing: {
            $or: [{ $eq: ['$user_id', userId] }, { $in: ['$user_id', followingObjectIds] }],
          },

          comments: { $ifNull: ['$comments', []] },
        },
      },

      {
        $match: {
          $or: [{ isPublic: true }, { isFollowerOnly: true, isCommunityMember: true, isFollowing: true }],
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
          commentCount: { $size: '$comments' }, // Total comment count
        },
      },
    ];

    return await communityPostsModel.aggregate(pipeline);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error(error as string);
  }
};
