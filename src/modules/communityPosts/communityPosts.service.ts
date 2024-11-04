import mongoose from 'mongoose';
import { userService } from '../user';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
import { communityGroupService } from '../communityGroup';
import { UserProfile } from '../userProfile';
import { CommunityType } from '../../config/community.type';

export const createCommunityPost = async (post: communityPostsInterface, adminId: mongoose.Types.ObjectId) => {
  const postData = { ...post, user_id: adminId };
  const admin = await userService.getUserById(adminId);
  const adminCommunityGroup = await communityGroupService.getCommunityGroup(String(post.communityId));

  const verifiedCommunityGroups: any = admin?.userVerifiedCommunities.flatMap((c) =>
    c.communityGroups.map((group) => group)
  );
  const unVerifiedCommunityGroups: any = admin?.userUnVerifiedCommunities.flatMap((c) =>
    c.communityGroups.map((group) => group)
  );

  const isCommunityUser = verifiedCommunityGroups?.find((group: any) => {
    if (group.communityGroupId === String(adminCommunityGroup?._id)) {
      return group;
    }
  });
  const isUnVeriCommunityUser = unVerifiedCommunityGroups?.find((group: any) => {
    if (group.communityGroupId === String(adminCommunityGroup?._id)) {
      return group;
    }
  });

  if (isCommunityUser?.role == 'Member' || isUnVeriCommunityUser?.role == 'Member') {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not admin/moderator of the group!');
  }
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
  access: string,
  communityId: string,
  communityGroupId?: string,
  page: number = 1,
  limit: number = 10
) => {
  console.log('acc', access);

  try {
    const accessType =
      access === CommunityType.Public ? CommunityType.Public : [CommunityType.Public, CommunityType.Private];

    const matchStage: any = {
      communityId: new mongoose.Types.ObjectId(communityId),
      communityPostsType: Array.isArray(accessType) ? { $in: accessType } : accessType,
    };

    if (communityGroupId && communityGroupId.length > 0) {
      matchStage.communiyGroupId = new mongoose.Types.ObjectId(communityGroupId);
    } else {
      matchStage.communiyGroupId = { $exists: false };
    }

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
      finalPost, // The actual paginated comments
      currentPage: page, // Current page for React Query
      totalPages, // Total number of pages
      totalPost, // Total number of comments/posts
    };
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error('Failed to Get User Posts');
  }
};

export const getcommunityPost = async (postId: string) => {
  const post = await communityPostsModel
    .findById(postId)
    .populate({
      path: 'user_id',
      select: 'firstName lastName',
    })
    .lean();

  const comments = await communityPostCommentsModel.countDocuments({ communityId: post?._id });

  const profiles = await UserProfile.find({ users_id: post?.user_id });

  return {
    ...post,
    comments,
    profiles,
  };
};
