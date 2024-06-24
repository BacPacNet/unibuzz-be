import mongoose from 'mongoose';
import { userService } from '../user';
import { communityPostsInterface } from './communityPosts.interface';
import CommunityPostModel from './communityPosts.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { communityPostsModel } from '.';
import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
import { communityGroupService } from '../communityGroup';
import { communityService } from '../community';
import { UserProfile } from '../userProfile';

export const createCommunityPost = async (post: communityPostsInterface, adminId: mongoose.Types.ObjectId) => {
  const admin = await userService.getUserById(adminId);
  const adminCommunityGroup = await communityGroupService.getCommunityGroup(String(post.communityId));
  const adminCommunity = await communityService.getCommunity(String(post.communityId));
  // return console.log("g",adminCommunityGroup,"c",adminCommunity,"a",admin?._id)
  // console.log(String(admin?._id) != adminCommunityGroup?.adminUserId.toString());
  // console.log(String(admin?._id) != adminCommunity?.adminId);

  //    console.log(admin?.joinedCommunity.toString() != post.communityId.toString());

  //  if(admin?.joinedCommunity.toString() == post.communityId.toString() || admin?.role != "admin"){
  //       throw new ApiError(httpStatus.UNAUTHORIZED,"you are not admin of the group!")
  //  }
  // const adminUnverifiedCommunityIds = admin?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];
  // console.log(adminUnverifiedCommunityIds);

  // if (!adminUnverifiedCommunityIds.includes(post.communityId.toString()) && admin?.role !== 'admin') {
  //   throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not admin of the group!');
  // }

  if (adminCommunity?.adminId != null) {
    if (String(admin?._id) != adminCommunity?.adminId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not admin of the group!');
    }
  }

  if (adminCommunityGroup?.adminUserId != null) {
    if (String(admin?._id) != adminCommunityGroup?.adminUserId.toString()) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not admin of the group!');
    }
  }
  return await CommunityPostModel.create(post);
};

export const likeUnlike = async (id: string, userId: string) => {
  // console.log(id);

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

// export const getAllCommunityPost = async (communityId: string) => {
//   // return await communityPostsModel.find({ communityId: communityId });
//     // Fetch all posts in the community
//     const posts = await communityPostsModel.find({ communityId }).lean()
//         // return console.log(posts,communityId);

//     // Fetch all comments related to these posts
//     const postIds = posts.map(post => post._id);
//     const comments = await communityPostCommentsModel.find({ communityId: { $in: postIds } })
//     .populate({
//       path: 'commenterId',
//       select: 'firstName lastName content _id'
//     })

//     // Associate comments with their respective posts
//     const postsWithComments = posts.map(post => ({
//       ...post,
//       comments: comments.filter(comment => comment.communityId.toString() === post._id.toString()),
//     }));

//     return postsWithComments;
// };

export const getAllCommunityPost = async (communityId: string) => {
  // return await communityPostsModel.find({ communityId: communityId });
  // Fetch all posts in the community
  const posts = await communityPostsModel.find({ communityId }).sort({ createdAt: -1 }).lean();
  // return console.log(posts,communityId);

  const postIds = posts.map((post) => post._id);
  const comments = await communityPostCommentsModel.find({ communityId: { $in: postIds } }).populate({
    path: 'commenterId',
    select: 'firstName lastName content _id',
  });

  // const userIds = comments.map((comments:any) => comments.commenterId._id); // Assuming userId is the field in posts related to userProfileSchema
  const userIds = [...new Set(comments.map((comment: any) => comment.commenterId._id.toString()))];
  // return console.log(userIds);

  const profiles = await UserProfile.find({ users_id: { $in: userIds } });

  const postsWithComments = posts.map((post: any) => {
    const postComments = comments
      .filter((comment: any) => comment.communityId.toString() === post._id.toString())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((comment: any) => {
        const userProfile = profiles.find((profile) => profile.users_id.toString() === comment.commenterId._id.toString());
        return {
          ...comment.toObject(),
          commenterId: {
            ...comment.commenterId.toObject(),
            profile_dp: userProfile ? userProfile.profile_dp : null,
          },
        };
      });

    return {
      ...post,
      comments: postComments,
      profile_dp: post.profile_dp,
    };
  });

  return postsWithComments;
};
