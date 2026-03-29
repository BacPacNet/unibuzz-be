import mongoose, { PipelineStage } from 'mongoose';
import { UserProfile } from '../userProfile';
import { BlockedUserRef } from './userPostComments.interface';

export const getCommenterLookupStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'users',
      localField: 'commenterId',
      foreignField: '_id',
      as: 'commenterId',
    },
  },
  { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },
];

export const getCommenterProfileLookupStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'userprofiles',
      localField: 'commenterProfileId',
      foreignField: '_id',
      as: 'commenterProfileId',
    },
  },
  { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },
];

export const getCommunitiesEnrichmentStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'communities',
      localField: 'commenterProfileId.communities.communityId',
      foreignField: '_id',
      as: 'commenterProfileId.communitiesData',
    },
  },
  {
    $addFields: {
      'commenterProfileId.communities': {
        $map: {
          input: { $ifNull: ['$commenterProfileId.communities', []] },
          as: 'comm',
          in: {
            $let: {
              vars: {
                populated: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$commenterProfileId.communitiesData', []] },
                        as: 'pop',
                        cond: { $eq: ['$$pop._id', '$$comm.communityId'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                _id: '$$populated._id',
                name: '$$populated.name',
                logo: '$$populated.communityLogoUrl.imageUrl',
                isVerifiedMember: {
                  $cond: [
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: { $ifNull: ['$$populated.users', []] },
                              as: 'usr',
                              cond: {
                                $and: [
                                  { $eq: ['$$usr._id', '$commenterId._id'] },
                                  { $eq: ['$$usr.isVerified', true] },
                                ],
                              },
                            },
                          },
                        },
                        0,
                      ],
                    },
                    true,
                    false,
                  ],
                },
                isCommunityAdmin: {
                  $cond: [
                    {
                      $in: ['$commenterId._id', { $ifNull: ['$$populated.adminId', []] }],
                    },
                    true,
                    false,
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  { $project: { 'commenterProfileId.communitiesData': 0 } },
];

/**
 * Single $project that returns only API-needed fields (CommentType).
 * Builds trimmed commenterId and commenterProfileId with expressions so no
 * password, email, following, followers, etc. are ever returned.
 */
export const getCommentResponseProjectStage = (includeUserPostId = false): PipelineStage => ({
  $project: {
    _id: 1,
    content: 1,
    replies: 1,
    level: 1,
    likeCount: 1,
    imageUrl: 1,
    createdAt: 1,
    updatedAt: 1,
    commenterId: {
      _id: '$commenterId._id',
      firstName: '$commenterId.firstName',
      lastName: '$commenterId.lastName',
    },
    commenterProfileId: {
      profile_dp: '$commenterProfileId.profile_dp',
      major: '$commenterProfileId.major',
      university_name: '$commenterProfileId.university_name',
      study_year: '$commenterProfileId.study_year',
      degree: '$commenterProfileId.degree',
      role: '$commenterProfileId.role',
      affiliation: '$commenterProfileId.affiliation',
      occupation: '$commenterProfileId.occupation',
      isCommunityAdmin: '$commenterProfileId.isCommunityAdmin',
      communities: '$commenterProfileId.communities',
    },
    ...(includeUserPostId ? { userPostId: 1 } : {}),
  },
});

/** Match stage to exclude comments whose commenter (user) is deleted. Use after commenter lookup. */
export const MATCH_COMMENTER_NOT_DELETED_STAGES: PipelineStage[] = [
  { $match: { 'commenterId.isDeleted': { $ne: true } } },
];

/** Lookup and unwind userPost for comment pipelines. */
export const getUserPostLookupStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'userposts',
      localField: 'userPostId',
      foreignField: '_id',
      as: 'userPostId',
    },
  },
  { $unwind: { path: '$userPostId', preserveNullAndEmptyArrays: true } },
];

/** Project comment + userPost fields. Use includeLevelAndPostId for create-comment response (level + userPostId._id). */
export const getCommentWithUserPostProjectStage = (includeLevelAndPostId = false): PipelineStage => {
  const project: Record<string, 1> = {
    'userPostId.user_id': 1,
    commenterId: 1,
    commenterProfileId: 1,
    replies: 1,
    content: 1,
    imageUrl: 1,
    likeCount: 1,
    createdAt: 1,
    updatedAt: 1,
  };
  if (includeLevelAndPostId) {
    project['userPostId._id'] = 1;
    project['level'] = 1;
  }
  return { $project: project };
};

/** Builds the $lookup stage for replies with optional match stages after commenter and after profile lookup (e.g. isDeleted, blocked users). */
export const getRepliesLookupStage = (
  extraStagesAfterCommenter: PipelineStage[] = [],
  extraStagesAfterProfile: PipelineStage[] = []
): PipelineStage => ({
  $lookup: {
    from: 'userpostcomments',
    localField: 'replies',
    foreignField: '_id',
    as: 'replies',
    pipeline: [
      { $sort: { createdAt: -1 } },
      ...getCommenterLookupStages(),
      ...extraStagesAfterCommenter,
      ...getCommenterProfileLookupStages(),
      ...extraStagesAfterProfile,
      ...getCommunitiesEnrichmentStages(),
      getCommentResponseProjectStage(false),
    ] as any,
  },
});

/** Options for building the shared comment enrichment pipeline (commenter → profile → communities, then optional userPost, project, replies). */
export interface CommentEnrichmentOptions {
  /** Match stages to run after commenter lookup (e.g. filter deleted commenters). */
  matchAfterCommenter?: PipelineStage[];
  /** Match stages to run after commenter profile lookup (e.g. blocked users filter). */
  matchAfterProfile?: PipelineStage[];
  /** Include userPost lookup and unwind. */
  includeUserPost?: boolean;
  /** When includeUserPost is true: true = project with level and post id, false = minimal project, undefined = no $project stage. */
  commentWithUserPostProject?: boolean;
  /** Final stage (e.g. getRepliesLookupStage(...)). */
  repliesStage?: PipelineStage;
}

/** Shared comment enrichment pipeline: commenter lookup → optional match → profile lookup → optional match → communities → optional userPost → optional project → optional replies → response project (trim commenter/profile). */
export const getCommentEnrichmentStages = (options: CommentEnrichmentOptions = {}): PipelineStage[] => [
  ...getCommenterLookupStages(),
  ...(options.matchAfterCommenter ?? []),
  ...getCommenterProfileLookupStages(),
  ...(options.matchAfterProfile ?? []),
  ...getCommunitiesEnrichmentStages(),
  ...(options.includeUserPost ? getUserPostLookupStages() : []),
  ...(options.includeUserPost && options.commentWithUserPostProject !== undefined
    ? [getCommentWithUserPostProjectStage(options.commentWithUserPostProject)]
    : []),
  ...(options.repliesStage ? [options.repliesStage] : []),
  getCommentResponseProjectStage(!!options.includeUserPost),
];



/** Resolve current user's blocked user IDs from profile. Returns [] when myUserId is falsy. */
export const getMyBlockedUserIds = async (myUserId: string): Promise<mongoose.Types.ObjectId[]> => {
  if (!myUserId) return [];
  const profile = await UserProfile.findOne({ users_id: myUserId }).select('blockedUsers').lean();
  return (profile?.blockedUsers || []).map((b: BlockedUserRef) =>
    new mongoose.Types.ObjectId(String(b.userId))
  );
};

/** Pipeline stages to exclude commenters who blocked me and commenters I blocked. */
export const getBlockedUserFilterStages = (
  myUserId: string,
  myBlockedUserIds: mongoose.Types.ObjectId[]
): PipelineStage[] => {
  const stages: PipelineStage[] = [];
  if (myUserId) {
    stages.push({
      $match: {
        'commenterProfileId.blockedUsers': {
          $not: { $elemMatch: { userId: new mongoose.Types.ObjectId(myUserId) } },
        },
      },
    });
  }
  if (myBlockedUserIds.length) {
    stages.push({ $match: { 'commenterId._id': { $nin: myBlockedUserIds } } });
  }
  return stages;
};

/** Pipeline to count comments on a post (optionally top-level only), excluding deleted commenters. */
export const getCommentCountPipeline = (
  postId: string,
  topLevelOnly: boolean
): PipelineStage[] => [
  {
    $match: {
      userPostId: new mongoose.Types.ObjectId(postId),
      ...(topLevelOnly ? { level: 0 } : {}),
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'commenterId',
      foreignField: '_id',
      as: 'commenter',
    },
  },
  { $unwind: '$commenter' },
  { $match: { 'commenter.isDeleted': { $ne: true } } },
  { $count: 'total' },
];


