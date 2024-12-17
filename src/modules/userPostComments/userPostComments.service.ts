import mongoose from 'mongoose';
import userPostCommentsModel from './userPostComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createUserPostComment = async (userId: string, userPostId: string, body: any) => {
  const newComment = { ...body, userPostId, commenterId: userId, level: 0 };
  // const createdComment = await userPostCommentsModel.create(newComment);
  // const populatedComment = await createdComment.populate("userPostId");
  // return populatedComment;
  const createdComment = await userPostCommentsModel
    .create(newComment)
    .then(comment => comment.populate("userPostId", "user_id")); 

  return createdComment;
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

export const commentReply = async (commentId: string, userID: string, body: any, level: number) => {
  const newReply = {
    userPostId: null,
    commenterId: userID,
    level: level + 1,
    ...body,
  };

  const savedReply = await userPostCommentsModel.create(newReply);

  const parentComment = await userPostCommentsModel
    .findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } }, { new: true })
    .populate('replies');

  return parentComment;
};

export const getUserPostComments = async (postId: string, page: number = 1, limit: number = 2) => {
  const skip = (page - 1) * limit;
  // Fetch the main comments on the post
  const comments =
    (await userPostCommentsModel
      .find({ userPostId: postId })
      .populate([
        { path: 'commenterId', select: 'firstName lastName _id' },
        { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
        {
          path: 'replies',
          populate: [
            { path: 'commenterId', select: 'firstName lastName _id' },
            { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
          ],
        },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()) || [];

  // Helper function to recursively populate replies and calculate total count
  const populateNestedReplies = async (replies: any[] = []): Promise<{ populatedReplies: any[]; totalCount: number }> => {
    if (!replies || replies.length === 0) return { populatedReplies: [], totalCount: 0 };

    // For each reply, check if it has further replies and populate them recursively
    const populatedReplies = await Promise.all(
      replies.map(async (reply: any) => {
        // Fetch deeper replies
        const deeperReplies = await userPostCommentsModel
          .find({ _id: { $in: reply.replies || [] } })
          .populate([
            { path: 'commenterId', select: 'firstName lastName _id' },
            { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
          ])
          .lean();

        // Recursively populate nested replies and count them
        const { populatedReplies: nestedReplies, totalCount: nestedCount } = await populateNestedReplies(deeperReplies);

        return {
          ...reply,
          replies: nestedReplies,
          totalCount: nestedCount, // Add the count of deeper replies
        };
      })
    );

    // Return the populated replies and the total count (number of replies at this level + nested replies)
    return {
      populatedReplies,
      totalCount: populatedReplies.length,
    };
  };

  // Populate the nested replies for each comment and calculate the total count
  const finalComments = await Promise.all(
    comments.map(async (comment: any) => {
      const { populatedReplies, totalCount } = await populateNestedReplies(comment.replies);
      return {
        ...comment,
        replies: populatedReplies,
        totalCount: totalCount, // Include immediate replies
      };
    })
  );

  const totalComments = await userPostCommentsModel.countDocuments({ userPostId: postId });

  const totalPages = Math.ceil(totalComments / limit);

  return {
    finalComments,
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
      { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
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
            { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree' },
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
