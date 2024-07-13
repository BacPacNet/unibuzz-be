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

export const getAllCommunityPost = async (communityId: string) => {
  const posts: any = await communityPostsModel
    .find({ communityId })
    .populate({
      path: 'user_id',
      select: 'firstName lastName',
    })
    .sort({ createdAt: -1 })
    .lean();

  const postIds = posts.map((post: any) => post._id);
  const comments = await communityPostCommentsModel.find({ communityId: { $in: postIds } }).populate({
    path: 'commenterId',
    select: 'firstName lastName content _id',
  });

  const userIds = [
    ...new Set([
      ...posts.map((post: any) => post.user_id._id.toString()),
      ...comments.map((comment: any) => comment.commenterId._id.toString()),
    ]),
  ];

  const profiles = await UserProfile.find({ users_id: { $in: userIds } });

  const postsWithCommentsAndProfiles = posts.map((post: any) => {
    const userProfile = profiles.find((profile: any) => profile.users_id.toString() === post.user_id._id.toString());
    const postComments = comments
      .filter((comment) => comment.communityId.toString() === post._id.toString())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((comment: any) => {
        const commenterProfile = profiles.find(
          (profile: any) => profile.users_id.toString() === comment.commenterId._id.toString()
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
