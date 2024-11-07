import mongoose from 'mongoose';
import { userService } from '../user';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import { communityGroupService } from '../communityGroup';
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
  try {
    const communityPostResponse = await communityPostsModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(postId) } },
      {
        $lookup: {
          from: 'users', // replace with actual collection name for users
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'userprofiles', // replace with actual collection name for profiles
          localField: 'user._id',
          foreignField: 'users_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'communitypostcomments', // replace with actual collection name for comments
          localField: '_id',
          foreignField: 'communityId',
          as: 'comments',
        },
      },
      { $unwind: { path: '$comments', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users', // replace with actual collection name for commenters
          localField: 'comments.commenterId',
          foreignField: '_id',
          as: 'commenter',
        },
      },
      { $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id',
          user_id: { $first: '$user_id' },
          content: { $first: '$content' },
          imageUrl: { $first: '$imageUrl' },
          likeCount: { $first: '$likeCount' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          user: { $first: { firstName: '$user.firstName', lastName: '$user.lastName' } },
          profile: { $first: '$profile' },
          comments: {
            $push: {
              _id: '$comments._id',
              content: '$comments.content',
              commenterId: '$comments.commenterId',
              likeCount: '$comments.likeCount',
              imageUrl: '$comments.imageUrl',
              replies: '$comments.replies',
              level: '$comments.level',
              commenter: {
                firstName: '$commenter.firstName',
                lastName: '$commenter.lastName',
              },
              createdAt: '$comments.createdAt',
            },
          },
        },
      },
    ]);

    return communityPostResponse[0];
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error(error as string);
  }
};
