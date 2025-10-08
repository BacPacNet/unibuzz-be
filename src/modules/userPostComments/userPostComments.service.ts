import mongoose from 'mongoose';
import userPostCommentsModel from './userPostComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createUserPostComment = async (userId: string, userPostId: string, body: any) => {
  const payload = {
    ...body,
    userPostId,
    commenterId: userId,
    level: 0,
  };

  const comment = await userPostCommentsModel.create(payload);

  await comment.populate([
    { path: 'commenterId', select: 'firstName lastName _id' },
    {
      path: 'commenterProfileId',
      select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
    },
    {
      path: 'replies',
      options: { sort: { createdAt: -1 } },
      populate: [
        { path: 'commenterId', select: 'firstName lastName _id' },
        {
          path: 'commenterProfileId',
          select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
        },
      ],
    },
    { path: 'userPostId', select: 'user_id' },
  ]);

  return comment;
};

export const updateUserPostComment = async (commentId: mongoose.Types.ObjectId, comment: any) => {
  let updatedUserPostComment;

  updatedUserPostComment = await userPostCommentsModel.findById(commentId);

  if (!updatedUserPostComment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(updatedUserPostComment, {
    content: comment.content,
    imageUrl: comment.imageurl,
  });
  await updatedUserPostComment.save();
  return updatedUserPostComment;
};

export const deleteUserPostComment = async (commentId: mongoose.Types.ObjectId) => {
  return await userPostCommentsModel.findByIdAndDelete(commentId);
};

export const getAllUserPostComment = async (userPostId: string) => {
  return await userPostCommentsModel.find({ userPostId }).populate('replies');
};

export const likeUnlikeComment = async (commentId: string, userId: string) => {
  const comment = await userPostCommentsModel.findById(commentId);

  if (!comment?.likeCount.some((x) => x.userId === userId)) {
    return await comment?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await comment.updateOne({ $pull: { likeCount: { userId } } });
  }
};

export const commentReply = async (commentId: string, userID: string, userPostId: string, body: any, level: number) => {
  const newReply = {
    userPostId: userPostId,
    commenterId: userID,
    level: level + 1,
    ...body,
  };

  const savedReply = await userPostCommentsModel.create(newReply);

  const parentComment = await userPostCommentsModel
    .findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } }, { new: true })
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
      },
      {
        path: 'replies',
        options: { sort: { createdAt: -1 } },
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
          },
        ],
      },
      { path: 'userPostId', select: 'user_id' },
    ])
    .lean();

  return parentComment;
};

export const getUserPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = 2,
  sortOrder: 'asc' | 'desc' = 'desc'
) => {
  const skip = (page - 1) * limit;
  const mainSortOrder = sortOrder === 'asc' ? 1 : -1;

  const comments =
    (await userPostCommentsModel
      .find({ userPostId: postId, level: 0 })
      .populate([
        { path: 'commenterId', select: 'firstName lastName _id' },
        {
          path: 'commenterProfileId',
          select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
        },
        {
          path: 'replies',
          options: { sort: { createdAt: -1 } },
          populate: [
            { path: 'commenterId', select: 'firstName lastName _id' },
            {
              path: 'commenterProfileId',
              select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
            },
          ],
        },
      ])
      .sort({ createdAt: mainSortOrder })
      .skip(skip)
      .limit(limit)
      .lean()) || [];

  const totalComments = await userPostCommentsModel.countDocuments({
    userPostId: postId,
  });

  const totalTopLevelComments = await userPostCommentsModel.countDocuments({
    userPostId: postId,
    level: 0,
  });

  const totalPages = Math.ceil(totalTopLevelComments / limit);

  return {
    finalComments: comments,
    currentPage: page,
    totalPages,
    totalComments,
  };
};

export const getPostCommentById = async (commentId: string) => {
  // Fetch the main comments on the post
  const comments = await userPostCommentsModel
    .findById(commentId)
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
      },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
          },
        ],
      },
    ])
    .sort({ createdAt: -1 })
    .lean();

  // Ensure comments is an array (in case findById returns a single document)
  const commentArray = Array.isArray(comments) ? comments : [comments];

  const populateNestedReplies = async (
    replies: any[] = [],
    depth: number = 1,
    maxDepth: number = 3
  ): Promise<{ populatedReplies: any[]; totalCount: number }> => {
    if (!replies || replies.length === 0 || depth > maxDepth + 1) {
      return { populatedReplies: [], totalCount: 0 };
    }

    const populatedReplies = await Promise.all(
      replies.map(async (reply: any) => {
        const deeperReplies = await userPostCommentsModel
          .find({ _id: { $in: reply.replies || [] } })
          .populate([
            { path: 'commenterId', select: 'firstName lastName _id' },
            {
              path: 'commenterProfileId',
              select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
            },
          ])
          .lean();

        const { populatedReplies: nestedReplies, totalCount: nestedCount } = await populateNestedReplies(
          deeperReplies,
          depth + 1,
          maxDepth
        );

        return {
          ...reply,
          replies: nestedReplies,
          totalCount: nestedCount,
        };
      })
    );

    return {
      populatedReplies,
      totalCount: populatedReplies.length,
    };
  };

  const finalComments = await Promise.all(
    commentArray.map(async (comment: any) => {
      const { populatedReplies, totalCount } = await populateNestedReplies(comment.replies, 1, 3);
      return {
        ...comment,
        replies: populatedReplies,
        totalCount: totalCount,
      };
    })
  );

  return {
    finalComments,
  };
};

export const getSingleCommentByCommentId = async (commentId: string) => {
  const comment = await userPostCommentsModel
    .findById(commentId)
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
      },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
          },
        ],
      },
      { path: 'userPostId', select: 'user_id' },
    ])
    .lean();

  return comment;
};
