import mongoose from 'mongoose';
import userPostCommentsModel from './userPostComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import {
  getCommentEnrichmentStages,
  getRepliesLookupStage,
  getMyBlockedUserIds,
  getBlockedUserFilterStages,
  getCommentCountPipeline,
  MATCH_COMMENTER_NOT_DELETED_STAGES,
  type CommentEnrichmentOptions,
} from './userPostComments.pipeline';
import { CreateCommentBody, UpdateCommentBody, PopulatedReplyWithReplies, CreateUserPostCommentResult, CommentReplyResult } from './userPostComments.interface';
import { getPaginationSkip, computeTotalPages } from '../../utils/common';
const DEFAULT_COMMENTS_PAGE_SIZE = 2;
const MAX_REPLY_DEPTH = 3;
const DEFAULT_COMMENTS_SORT_ORDER: 'asc' | 'desc' = 'desc';

/** Level for top-level comments (replies have level >= 1). */
const TOP_LEVEL = 0;
/** MongoDB sort order: ascending. */
const SORT_ASC = 1;
/** MongoDB sort order: descending. */
const SORT_DESC = -1;

/** User-facing error message when a comment is not found. */
const COMMENT_NOT_FOUND_MESSAGE = 'comment not found!';

/** Fields to select when populating commenterId (users). */
const COMMENTER_SELECT = 'firstName lastName _id';
/** Fields to select when populating commenterProfileId (userprofiles). */
const COMMENTER_PROFILE_SELECT =
  'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin';

/** Run aggregation to get a single comment by id with enrichment. Returns first result or undefined. */
async function getEnrichedCommentById(
  commentId: string | mongoose.Types.ObjectId,
  options: CommentEnrichmentOptions
) {
  const id = typeof commentId === 'string' ? new mongoose.Types.ObjectId(commentId) : commentId;
  const result = await userPostCommentsModel.aggregate([
    { $match: { _id: id } },
    ...getCommentEnrichmentStages(options),
  ]);
  return result[0];
}

export const createUserPostComment = async (
  userId: string,
  userPostId: string,
  body: CreateCommentBody
): Promise<CreateUserPostCommentResult | undefined> => {
  const payload = {
    ...body,
    userPostId,
    commenterId: userId,
    level: TOP_LEVEL,
  };

  const createdComment = await userPostCommentsModel.create(payload);

  const comment = await getEnrichedCommentById(createdComment._id, {
    includeUserPost: true,
    commentWithUserPostProject: true,
    repliesStage: getRepliesLookupStage(),
  });

  return comment as CreateUserPostCommentResult | undefined;
};

export const updateUserPostComment = async (
  commentId: mongoose.Types.ObjectId,
  comment: UpdateCommentBody
) => {
  let updatedUserPostComment;

  updatedUserPostComment = await userPostCommentsModel.findById(commentId);

  if (!updatedUserPostComment) {
    throw new ApiError(httpStatus.NOT_FOUND, COMMENT_NOT_FOUND_MESSAGE);
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

export const likeUnlikeComment = async (commentId: string, userId: string) => {
  const comment = await userPostCommentsModel.findById(commentId);

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, COMMENT_NOT_FOUND_MESSAGE);
  }

  const hasLiked = comment.likeCount.some((x) => x.userId === userId);
  if (!hasLiked) {
    return await comment.updateOne({ $push: { likeCount: { userId } } });
  }
  return await comment.updateOne({ $pull: { likeCount: { userId } } });
};

export const commentReply = async (
  commentId: string,
  userId: string,
  userPostId: string,
  body: CreateCommentBody,
  level: number
): Promise<CommentReplyResult | undefined> => {
  const newReply = {
    ...body,
    userPostId,
    commenterId: userId,
    level: level + 1,
  };

  const savedReply = await userPostCommentsModel.create(newReply);

  await userPostCommentsModel.findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } }, { new: true });

  const parentComment = await getEnrichedCommentById(commentId, {
    includeUserPost: true,
    repliesStage: getRepliesLookupStage(),
  });

  return parentComment as CommentReplyResult | undefined;
};

export const getUserPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = DEFAULT_COMMENTS_PAGE_SIZE,
  sortOrder: 'asc' | 'desc' = DEFAULT_COMMENTS_SORT_ORDER,
  myUserId: string
) => {
  const skip = getPaginationSkip(page, limit);
  const mainSortOrder = sortOrder === 'asc' ? SORT_ASC : SORT_DESC;
  const myBlockedUserIds = await getMyBlockedUserIds(myUserId);
  const blockedUserFilterStages = getBlockedUserFilterStages(myUserId, myBlockedUserIds);
  const replyFilterStagesAfterCommenter = MATCH_COMMENTER_NOT_DELETED_STAGES;

  const comments = await userPostCommentsModel.aggregate([
    {
      $match: {
        userPostId: new mongoose.Types.ObjectId(postId),
        level: TOP_LEVEL,
      },
    },
    { $sort: { createdAt: mainSortOrder } },
    { $skip: skip },
    { $limit: limit },
    ...getCommentEnrichmentStages({
      matchAfterCommenter: MATCH_COMMENTER_NOT_DELETED_STAGES,
      matchAfterProfile: blockedUserFilterStages,
      repliesStage: getRepliesLookupStage(replyFilterStagesAfterCommenter, blockedUserFilterStages),
    }),
  ]);

  const [totalCommentsAgg, totalTopLevelAgg] = await Promise.all([
    userPostCommentsModel.aggregate(getCommentCountPipeline(postId, false)),
    userPostCommentsModel.aggregate(getCommentCountPipeline(postId, true)),
  ]);

  const totalComments = totalCommentsAgg[0]?.total || 0;
  const totalTopLevelComments = totalTopLevelAgg[0]?.total || 0;

    const totalPages = computeTotalPages(totalTopLevelComments, limit);

  return {
    finalComments: comments,
    currentPage: page,
    totalPages,
    totalComments,
  };
};

// not being used anywhere but kept for future reference  
export const getPostCommentById = async (commentId: string) => {
  // Fetch the main comments on the post
  const comments = await userPostCommentsModel
    .findById(commentId)
    .populate([
      { path: 'commenterId', select: COMMENTER_SELECT },
      { path: 'commenterProfileId', select: COMMENTER_PROFILE_SELECT },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: COMMENTER_SELECT },
          { path: 'commenterProfileId', select: COMMENTER_PROFILE_SELECT },
        ],
      },
    ])
    .sort({ createdAt: -1 })
    .lean();

  // Ensure comments is an array (in case findById returns a single document)
  const commentArray = Array.isArray(comments) ? comments : [comments];

  const populateNestedReplies = async (
    replies: PopulatedReplyWithReplies[] = [],
    depth: number = 1,
    maxDepth: number = MAX_REPLY_DEPTH
  ): Promise<{ populatedReplies: PopulatedReplyWithReplies[]; totalCount: number }> => {
    if (!replies || replies.length === 0 || depth > maxDepth + 1) {
      return { populatedReplies: [], totalCount: 0 };
    }

    const populatedReplies = await Promise.all(
      replies.map(async (reply: PopulatedReplyWithReplies) => {
        const deeperReplies = await userPostCommentsModel
          .find({ _id: { $in: reply.replies || [] } })
          .populate([
            { path: 'commenterId', select: COMMENTER_SELECT },
            { path: 'commenterProfileId', select: COMMENTER_PROFILE_SELECT },
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
    commentArray.map(async (comment: PopulatedReplyWithReplies | null) => {
      const c = comment as PopulatedReplyWithReplies;
      const { populatedReplies, totalCount } = await populateNestedReplies(
        (c.replies as PopulatedReplyWithReplies[]) || [],
        1,
        MAX_REPLY_DEPTH
      );
      return {
        ...c,
        replies: populatedReplies,
        totalCount: totalCount,
      };
    })
  );

  return {
    finalComments,
  };
};

export const getSingleCommentByCommentId = async (commentId: string, myUserId: string = '') => {
  const myBlockedUserIds = await getMyBlockedUserIds(myUserId);
  const blockedUserFilterStages = getBlockedUserFilterStages(myUserId, myBlockedUserIds);

  const comment = await getEnrichedCommentById(commentId, {
    matchAfterCommenter: MATCH_COMMENTER_NOT_DELETED_STAGES,
    matchAfterProfile: blockedUserFilterStages,
    includeUserPost: true,
    commentWithUserPostProject: false,
    repliesStage: getRepliesLookupStage(
      MATCH_COMMENTER_NOT_DELETED_STAGES,
      blockedUserFilterStages
    ),
  });

  return comment ?? null;
};
