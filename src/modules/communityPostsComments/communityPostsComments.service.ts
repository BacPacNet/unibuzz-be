import mongoose, { PipelineStage } from 'mongoose';
import communityPostCommentModel from './communityPostsComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { convertToObjectId } from '../../utils/common';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile } from '../userProfile';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import {
  buildCommentEnrichmentStages,
  buildCommentCommunitiesEnrichmentStages,
  buildCommenterLookupStages,
  buildCommenterProfileLookupStages,
  buildCommentResponseProjectStage,
} from './communityPostsComments.pipeline';
import {
  CreateCommentBody,
  UpdateCommentPayload,
  CommentReplyBody,
  PopulatedCommentReply,
  PopulatedRepliesResult,
} from './communityPostsComments.interface';
import { BlockedUserEntry } from '../userProfile/userProfile.interface';

const TOP_LEVEL = 0;
const DEFAULT_COMMENTS_LIMIT = 2;
const MAX_REPLY_DEPTH = 3;

const COLLECTION_COMMENT_POSTS = 'communitypostcomments';
const COLLECTION_COMMUNITIES = 'communities';
const COLLECTION_COMMUNITY_GROUPS = 'communitygroups';
const COLLECTION_USERS = 'users';

const buildCommentNotificationMessage = (communityName: string, communityGroupTitle?: string): string =>
  communityGroupTitle
    ? `commented on your community post in ${communityName} at ${communityGroupTitle}`
    : `commented on your community post in ${communityName}`;

interface CommentNotificationPayload {
  sender_id: string;
  receiverId: string;
  communityPostId: string;
  communityPostCommentId: string;
  type: (typeof notificationRoleAccess)[keyof Pick<typeof notificationRoleAccess, 'COMMUNITY_COMMENT' | 'REPLIED_TO_COMMUNITY_COMMENT'>];
  message: string;
  parentCommentId?: string;
}

const buildCommentNotificationPayload = (params: CommentNotificationPayload) => ({ ...params });

export interface CommunityPostDetails {
  communityId: mongoose.Types.ObjectId;
  communityName: string;
  communityGroupTitle: string;
  communityAdminId?: mongoose.Types.ObjectId;
  communityUsers?: unknown[];
  communityGroupID?: mongoose.Types.ObjectId;
}

const getCommunityPostDetails = async (communityPostId: string): Promise<CommunityPostDetails | null> => {
  const [result] = await CommunityPostModel.aggregate<CommunityPostDetails>([
    { $match: { _id: convertToObjectId(communityPostId) } },
    {
      $lookup: {
        from: COLLECTION_COMMUNITIES,
        localField: 'communityId',
        foreignField: '_id',
        as: 'community',
      },
    },
    {
      $lookup: {
        from: COLLECTION_COMMUNITY_GROUPS,
        localField: 'communityGroupId',
        foreignField: '_id',
        as: 'communityGroup',
      },
    },
    {
      $project: {
        communityId: 1,
        communityName: { $arrayElemAt: ['$community.name', 0] },
        communityGroupTitle: { $arrayElemAt: ['$communityGroup.title', 0] },
        communityAdminId: { $arrayElemAt: ['$community.adminId', 0] },
        communityUsers: { $arrayElemAt: ['$community.users', 0] },
        communityGroupID: { $arrayElemAt: ['$communityGroup._id', 0] },
      },
    },
  ]);
  return result ?? null;
};

export const createCommunityComment = async (userID: string, communityPostId: string, body: CreateCommentBody) => {
  const { commenterProfileId, adminId } = body;

  const comment = await communityPostCommentModel.create({
    ...body,
    postId: convertToObjectId(communityPostId),
    commenterId: convertToObjectId(userID),
    commenterProfileId: convertToObjectId(commenterProfileId),
    level: TOP_LEVEL,
  });

  const communityDetail = await getCommunityPostDetails(communityPostId);
  if (!communityDetail) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community post not found');
  }

  const { communityName, communityGroupTitle } = communityDetail;

  if (userID !== adminId) {
    const notification = buildCommentNotificationPayload({
      sender_id: userID,
      receiverId: adminId,
      communityPostId,
      communityPostCommentId: comment._id.toString(),
      type: notificationRoleAccess.COMMUNITY_COMMENT,
      message: buildCommentNotificationMessage(communityName, communityGroupTitle),
    });
    await queueSQSNotification(notification);
  }

  const createCommentEnrichment = buildCommentEnrichmentStages({
    communitiesOptions: { useEmailForVerifiedMember: true, currentUserId: userID },
  });
  const repliesEnrichment = buildCommentEnrichmentStages({
    communitiesOptions: { useEmailForVerifiedMember: true, currentUserId: userID },
  });

  const [result] = await communityPostCommentModel.aggregate([
    { $match: { _id: convertToObjectId(comment._id.toString()) } },
    ...createCommentEnrichment,
    buildCommentResponseProjectStage(),
    {
      $lookup: {
        from: COLLECTION_COMMENT_POSTS,
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        // Mongoose $lookup.pipeline typings are stricter than PipelineStage[]; cast needed
        pipeline: [
          { $sort: { createdAt: -1 } },
          ...repliesEnrichment,
          buildCommentResponseProjectStage(),
        ] as PipelineStage[] as any,
      },
    },
  ]);

  return result || null;
};

export const updateCommunityPostComment = async (id: mongoose.Types.ObjectId, comment: UpdateCommentPayload) => {
  let communityPostCommentToUpadate;

  communityPostCommentToUpadate = await communityPostCommentModel.findById(id);

  if (!communityPostCommentToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }
  Object.assign(communityPostCommentToUpadate, {
    content: comment.content,
    imageUrl: comment.imageUrl ?? comment.imageurl,
  });
  await communityPostCommentToUpadate.save();
  return communityPostCommentToUpadate;
};

export const deleteCommunityPostComment = async (id: mongoose.Types.ObjectId) => {
  try {
    const deletedComment = await communityPostCommentModel.findByIdAndDelete(id);
    if (!deletedComment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
    }
    return deletedComment;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to delete community post comment: ${error}`);
  }
};



export const likeUnlikeComment = async (id: string, userId: string) => {
  const comment = await communityPostCommentModel.findById(id);
  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  const hasLiked = comment.likeCount.some((x) => x.userId === userId);
  return hasLiked
    ? comment.updateOne({ $pull: { likeCount: { userId } } })
    : comment.updateOne({ $push: { likeCount: { userId } } });
};

export const getCommunityPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = DEFAULT_COMMENTS_LIMIT,
  sortOrder: 'asc' | 'desc' = 'desc',
  myUserId: string
) => {
  const skip = (page - 1) * limit;
  const mainSortOrder = sortOrder === 'asc' ? 1 : -1;

  const myProfile = await UserProfile.findOne({ users_id: myUserId }).select('blockedUsers').lean();

  const myBlockedUserIds = (myProfile?.blockedUsers || []).map((b: BlockedUserEntry) =>
    convertToObjectId(b.userId.toString())
  );

  const listCommentBaseEnrichment = [
    ...buildCommenterLookupStages({ matchNotDeleted: true }),
    ...buildCommenterProfileLookupStages(true),
    { $match: { 'commenterProfileId.blockedUsers.userId': { $ne: convertToObjectId(myUserId) } } },
    { $match: { 'commenterId._id': { $nin: myBlockedUserIds } } },
    ...buildCommentCommunitiesEnrichmentStages({ useEmailForVerifiedMember: false }),
  ];
  const listCommentEnrichment = [...listCommentBaseEnrichment, buildCommentResponseProjectStage()];
  const listRepliesPipeline = [
    { $sort: { createdAt: -1 } },
    ...listCommentBaseEnrichment,
    buildCommentResponseProjectStage(),
  ];

  const comments = await communityPostCommentModel.aggregate([
    { $match: { postId: convertToObjectId(postId), level: TOP_LEVEL } },
    { $sort: { createdAt: mainSortOrder } },
    { $skip: skip },
    { $limit: limit },
    ...listCommentEnrichment,
    {
      $lookup: {
        from: COLLECTION_COMMENT_POSTS,
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        // Mongoose $lookup.pipeline typings are stricter than PipelineStage[]; cast needed
        pipeline: listRepliesPipeline as PipelineStage[] as any,
      },
    },
  ]);

  const totalCommentsAgg = await communityPostCommentModel.aggregate([
    {
      $match: {
        postId: convertToObjectId(postId),
      },
    },
    {
      $lookup: {
        from: COLLECTION_USERS,
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenter',
      },
    },
    { $unwind: '$commenter' },
    {
      $match: {
        'commenter.isDeleted': { $ne: true },
      },
    },
    {
      $count: 'total',
    },
  ]);
  const totalComments = totalCommentsAgg[0]?.total || 0;

  const totalTopLevelAgg = await communityPostCommentModel.aggregate([
    {
      $match: {
        postId: convertToObjectId(postId),
        level: TOP_LEVEL,
      },
    },
    {
      $lookup: {
        from: COLLECTION_USERS,
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenter',
      },
    },
    { $unwind: '$commenter' },
    {
      $match: {
        'commenter.isDeleted': { $ne: true },
      },
    },
    {
      $count: 'total',
    },
  ]);

  const totalTopLevelComments = totalTopLevelAgg[0]?.total || 0;

  const totalPages = Math.ceil(totalTopLevelComments / limit);

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
  const comments = await communityPostCommentModel
    .findById(commentId)
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      { path: 'commenterProfileId', select: 'profile_dp university_name major study_year role degree isCommunityAdmin' },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          { path: 'commenterProfileId', select: 'profile_dp university_name major study_year role degree isCommunityAdmin' },
        ],
      },
    ])
    .sort({ createdAt: -1 })
    .lean();

  // Ensure comments is an array (in case findById returns a single document)
  const commentArray = Array.isArray(comments) ? comments : [comments];

  const populateNestedReplies = async (
    replies: PopulatedCommentReply[] = [],
    depth: number = 1,
    maxDepth: number = MAX_REPLY_DEPTH
  ): Promise<PopulatedRepliesResult> => {
    if (!replies || replies.length === 0 || depth > maxDepth + 1) {
      return { populatedReplies: [], totalCount: 0 };
    }

    const populatedReplies = await Promise.all(
      replies.map(async (reply: PopulatedCommentReply) => {
        const deeperReplies = await communityPostCommentModel
          .find({ _id: { $in: reply.replies || [] } })
          .populate([
            { path: 'commenterId', select: 'firstName lastName _id' },
            {
              path: 'commenterProfileId',
              select: 'profile_dp university_name study_year role degree major isCommunityAdmin',
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
    commentArray.map(async (comment: PopulatedCommentReply | null) => {
      if (!comment) return null;
      const { populatedReplies, totalCount } = await populateNestedReplies(comment.replies, 1, MAX_REPLY_DEPTH);
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

export const commentReply = async (commentId: string, userID: string, body: CommentReplyBody, level: number) => {
  const { postID: communityPostId } = body;

  const communityDetail = await getCommunityPostDetails(communityPostId);
  if (!communityDetail) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community post not found');
  }

  const { communityId, communityGroupTitle, communityName, communityGroupID } = communityDetail;

  const userProfile = await UserProfile.findOne({ users_id: userID }).select('email');
  let isCommentVerified = false;

  if (userProfile) {
    const verifiedCommunities = userProfile.email?.map((c) => c.communityId.toString()) || [];
    isCommentVerified = verifiedCommunities.includes(communityId.toString());
  }

  const { commenterProfileId } = body;

  const newReply = {
    ...body,
    communityId: communityGroupID,
    commenterId: convertToObjectId(userID),
    commenterProfileId: convertToObjectId(commenterProfileId),
    postId: convertToObjectId(communityPostId),
    isCommentVerified,
    level: level + 1,
  };

  const savedReply = await communityPostCommentModel.create(newReply);

  const parentComment = await communityPostCommentModel.findById(commentId);
  if (parentComment && userID.toString() !== parentComment.commenterId.toString()) {
    const notification = buildCommentNotificationPayload({
      sender_id: userID,
      receiverId: parentComment.commenterId.toString(),
      communityPostId,
      communityPostCommentId: commentId,
      type: notificationRoleAccess.REPLIED_TO_COMMUNITY_COMMENT,
      message: buildCommentNotificationMessage(communityName, communityGroupTitle),
      parentCommentId: commentId,
    });
    await queueSQSNotification(notification);
  }

  await communityPostCommentModel.findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } });

  const replyEnrichment = buildCommentEnrichmentStages({
    communitiesOptions: { useEmailForVerifiedMember: true, currentUserId: userID },
  });

  const replyEnrichmentWithProject = [...replyEnrichment, buildCommentResponseProjectStage()];
  const repliesPipeline = [
    { $sort: { createdAt: -1 } },
    ...replyEnrichment,
    buildCommentResponseProjectStage(),
  ];

  const [aggregatedParent] = await communityPostCommentModel.aggregate([
    { $match: { _id: convertToObjectId(commentId) } },
    ...replyEnrichmentWithProject,
    {
      $lookup: {
        from: COLLECTION_COMMENT_POSTS,
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        // Mongoose $lookup.pipeline typings are stricter than PipelineStage[]; cast needed
        pipeline: repliesPipeline as PipelineStage[] as any,
      },
    },
  ]);

  return aggregatedParent || null;
};

export const getSingleCommunityCommentByCommentId = async (commentId: string, myUserId: string = '') => {
  const myUserObjectId = myUserId ? convertToObjectId(myUserId) : null;

  const myBlockedUserIds = myUserId
    ? (await UserProfile.findOne({ users_id: myUserId }).select('blockedUsers').lean())?.blockedUsers?.map(
        (b: BlockedUserEntry) => convertToObjectId(b.userId.toString())
      ) || []
    : [];

  const singleCommentEnrichment = [
    ...buildCommenterLookupStages({ matchNotDeleted: true }),
    ...buildCommenterProfileLookupStages(true),
    ...(myUserId
      ? [
          {
            $match: {
              'commenterProfileId.blockedUsers': {
                $not: { $elemMatch: { userId: myUserObjectId } },
              },
            },
          },
        ]
      : []),
    ...(myBlockedUserIds.length ? [{ $match: { 'commenterId._id': { $nin: myBlockedUserIds } } }] : []),
    ...buildCommentCommunitiesEnrichmentStages({ useEmailForVerifiedMember: false }),
  ];
  const singleCommentEnrichmentWithProject = [
    ...singleCommentEnrichment,
    buildCommentResponseProjectStage(),
  ];
  const singleRepliesPipeline = [
    { $sort: { createdAt: -1 } },
    ...singleCommentEnrichment,
    buildCommentResponseProjectStage(),
  ];

  const result = await communityPostCommentModel.aggregate([
    { $match: { _id: convertToObjectId(commentId) } },
    ...singleCommentEnrichmentWithProject,
    {
      $lookup: {
        from: COLLECTION_COMMENT_POSTS,
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        // Mongoose $lookup.pipeline typings are stricter than PipelineStage[]; cast needed
        pipeline: singleRepliesPipeline as PipelineStage[] as any,
      },
    },
  ]);

  return result[0] || null;
};
