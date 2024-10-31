import mongoose from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import UserPostModel from './userPost.model';
import userPostCommentsModel from '../userPostComments/userPostComments.model';
// import { User } from '../user';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile } from '../userProfile';
// import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
// import { UserProfileDocument } from '../userProfile/userProfile.interface';

export const getAllUserPosts = async (userId: mongoose.Schema.Types.ObjectId, page: number = 0, limit: number = 10) => {
  const userPosts = await getUserPostsForUserIds([userId], page, limit);
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
  return await UserPostModel.findByIdAndDelete(id);
};

export const getAllTimelinePosts = async (userId: mongoose.Schema.Types.ObjectId, page: number = 1, limit: number = 5) => {
  // Get user IDs of the user and their followers
  const followingAndSelfUserIds = await getFollowingAndSelfUserIds(userId);

  const skip = (page - 1) * limit;
  // Get different types of posts

  const totalUserPosts = await countUserPostsForUserIds(followingAndSelfUserIds!);
  const totalCommunityPosts = await countCommunityPostsForUserIds(followingAndSelfUserIds!);
  const totalPosts = totalUserPosts + totalCommunityPosts;

  const UsersPosts = await getUserPostsForUserIds(followingAndSelfUserIds!, skip, limit);

  const remainingLimit = Math.max(0, 5 - UsersPosts.length);

  const CommunityPosts = await getCommunityPostsForUserIds(followingAndSelfUserIds!, limit + remainingLimit, skip);

  // Merge and sort all posts by latest
  // const allPosts: any = [...UsersPosts, ...CommunityPosts];
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
const countCommunityPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[]) => {
  const ids = userIDs.map((item) => new mongoose.Types.ObjectId(item as any));

  try {
    const totalCommunityPosts = await CommunityPostModel.countDocuments({
      user_id: { $in: ids },
      communityPostsType: 'Public', // Only public posts count
    });
    return totalCommunityPosts;
  } catch (error) {
    console.error('Error counting community posts:', error);
    throw new Error('Failed to count community posts');
  }
};

// Get user IDs of the user and their followers
const getFollowingAndSelfUserIds = async (userId: mongoose.Schema.Types.ObjectId) => {
  const followingUsers = await UserProfile.findOne({ users_id: userId });
  let followingUserIds: mongoose.Schema.Types.ObjectId[] = [];
  if (followingUsers?.following?.length) {
    followingUserIds = followingUsers?.following.map((user) => user.userId);
  }
  followingUserIds.push(userId);
  return followingUserIds;
};

const getUserPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[], page: number, limit: number) => {
  console.log(page, limit);
  const ids = userIDs.map((item) => new mongoose.Types.ObjectId(item as any));
  const data = await UserPostModel.aggregate([
    {
      $match: {
        user_id: { $in: ids },
      },
    },
  ])
    .skip(page)
    .limit(limit);
  console.log(data);

  try {
    const followingUserPosts = await UserPostModel.aggregate([
      {
        $match: {
          user_id: { $in: ids },
        },
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

const getCommunityPostsForUserIds = async (userIDs: mongoose.Schema.Types.ObjectId[], limit: number, skip: number) => {
  const ids = userIDs.map((item) => new mongoose.Types.ObjectId(item as any));

  try {
    const followingCommunityPosts =
      (await CommunityPostModel.aggregate([
        {
          $match: {
            user_id: { $in: ids },
            communityPostsType: 'Public',
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

    return followingCommunityPosts;
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw new Error('Failed to Get User Posts');
  }
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
