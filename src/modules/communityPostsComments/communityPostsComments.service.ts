import mongoose from 'mongoose';
import communityPostCommentModel from './communityPostsComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import { convertToObjectId } from '../../utils/common';

export const createCommunityComment = async (userID: string, communityPostId: string, body: any) => {
  const { commenterProfileId, adminId } = body;

  const comment = await communityPostCommentModel.create({
    ...body,
    postId: convertToObjectId(communityPostId),
    commenterId: convertToObjectId(userID),
    commenterProfileId: convertToObjectId(commenterProfileId),
    level: 0,
  });

  if (userID !== adminId) {
    await notificationQueue.add(NotificationIdentifier.community_post_comment_notification, {
      sender_id: userID,
      receiverId: adminId,
      communityPostId,
      communityPostCommentId: comment._id,
      type: notificationRoleAccess.COMMUNITY_COMMENT,
      message: 'commented on your community post',
    });
  }

  await comment.populate([
    { path: 'commenterId', select: 'firstName lastName _id' },
    {
      path: 'commenterProfileId',
      select: 'profile_dp university_name study_year degree major affiliation occupation role',
    },
    {
      path: 'replies',
      options: { sort: { createdAt: -1 } },
      populate: [
        { path: 'commenterId', select: 'firstName lastName _id' },
        {
          path: 'commenterProfileId',
          select: 'profile_dp university_name study_year degree major affiliation occupation role',
        },
      ],
    },
    { path: 'postId', select: 'user_id' },
  ]);

  return comment;
};

export const updateCommunityPostComment = async (id: mongoose.Types.ObjectId, comment: any) => {
  let communityPostCommentToUpadate;

  communityPostCommentToUpadate = await communityPostCommentModel.findById(id);

  if (!communityPostCommentToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(communityPostCommentToUpadate, {
    content: comment.content,
    imageUrl: comment.imageurl,
  });
  await communityPostCommentToUpadate.save();
  return communityPostCommentToUpadate;
};

export const deleteCommunityPostComment = async (id: mongoose.Types.ObjectId) => {
  return await communityPostCommentModel.findByIdAndDelete(id);
};

export const getAllCommunityPostComment = async (commentPostId: string) => {
  return await communityPostCommentModel.find({ communityId: commentPostId });
};

export const likeUnlikeComment = async (id: string, userId: string) => {
  const comment = await communityPostCommentModel.findById(id);

  if (!comment?.likeCount.some((x) => x.userId === userId)) {
    return await comment?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await comment.updateOne({ $pull: { likeCount: { userId } } });
  }
};

export const getCommunityPostComments = async (postId: string, page: number = 1, limit: number = 2) => {
  const skip = (page - 1) * limit;
  // Fetch the main comments on the post
  const comments =
    (await communityPostCommentModel
      .find({ postId: postId })
      .populate([
        { path: 'commenterId', select: 'firstName lastName _id' },
        { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree major affiliation occupation' },
        {
          path: 'replies',
          options: { sort: { createdAt: -1 } },
          populate: [
            { path: 'commenterId', select: 'firstName lastName _id' },
            {
              path: 'commenterProfileId',
              select: 'profile_dp university_name study_year degree major affiliation occupation',
            },
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
        const deeperReplies = await communityPostCommentModel
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

  const totalComments = await communityPostCommentModel.countDocuments({ postId: postId });

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
  const comments = await communityPostCommentModel
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
        const deeperReplies = await communityPostCommentModel
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

export const commentReply = async (commentId: string, userID: string, body: any, level: number) => {
  const newReply = {
    communityId: null,
    commenterId: userID,
    level: level + 1,
    ...body,
  };

  const savedReply = await communityPostCommentModel.create(newReply);

  const parentComment = await communityPostCommentModel
    .findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } }, { new: true })
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year degree major affiliation occupation role',
      },
      {
        path: 'replies',
        options: { sort: { createdAt: -1 } },
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year degree major affiliation occupation role',
          },
        ],
      },
    ])
    .lean();

  return parentComment;
};

export const getSingleCommunityCommentByCommentId = async (commentId: string) => {
  const comment = await communityPostCommentModel
    .findById(new mongoose.Types.ObjectId(commentId))
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      { path: 'commenterProfileId', select: 'profile_dp university_name study_year affiliation occupation degree role' },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          { path: 'commenterProfileId', select: 'profile_dp university_name study_year affiliation occupation degree role' },
        ],
      },
    ])
    .lean();

  return comment;
};
