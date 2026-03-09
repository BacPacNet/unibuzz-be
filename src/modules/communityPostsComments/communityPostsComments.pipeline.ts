import mongoose, { PipelineStage } from 'mongoose';

export interface CommentCommunitiesEnrichmentOptions {
  /**
   * When true: isVerifiedMember from commenterProfileId.email, isCommunityAdmin from currentUserId.
   * When false: isVerifiedMember from $$populated.users filter, isCommunityAdmin from $commenterId._id.
   */
  useEmailForVerifiedMember: boolean;
  /** Required when useEmailForVerifiedMember is true (used for isCommunityAdmin in aggregation). */
  currentUserId?: string;
}

/**
 * Lookup users by commenterId and unwind. Optional $match to exclude deleted users.
 */
export function buildCommenterLookupStages(options?: {
  matchNotDeleted?: boolean | undefined;
  preserveNullAndEmptyArrays?: boolean | undefined;
}): PipelineStage[] {
  const preserveNull = options?.preserveNullAndEmptyArrays ?? true;
  const stages: PipelineStage[] = [
    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenterId',
      },
    },
    { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: preserveNull } },
  ];
  if (options?.matchNotDeleted) {
    stages.push({ $match: { 'commenterId.isDeleted': { $ne: true } } });
  }
  return stages;
}

/**
 * Lookup userprofiles by commenterProfileId and unwind.
 */
export function buildCommenterProfileLookupStages(
  preserveNullAndEmptyArrays: boolean = true
): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenterProfileId',
        foreignField: '_id',
        as: 'commenterProfileId',
      },
    },
    { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays } },
  ];
}

/**
 * Lookup communities and enrich commenterProfileId.communities with
 * isVerifiedMember and isCommunityAdmin. Two variants: email-based (create/reply)
 * or users-array filter (list/single get).
 */
export function buildCommentCommunitiesEnrichmentStages(
  options: CommentCommunitiesEnrichmentOptions
): PipelineStage[] {
  const { useEmailForVerifiedMember, currentUserId } = options;
  const dataKey = 'commenterProfileId.communitiesData';
  const communitiesKey = 'commenterProfileId.communities';

  const addFieldsContent = useEmailForVerifiedMember
    ? {
        [communitiesKey]: {
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
                          input: { $ifNull: [`$${dataKey}`, []] },
                          as: 'pop',
                          cond: { $eq: ['$$pop._id', '$$comm.communityId'] },
                        },
                      },
                      0,
                    ],
                  },
                  verifiedCommunities: {
                    $map: {
                      input: { $ifNull: ['$commenterProfileId.email', []] },
                      as: 'emailEntry',
                      in: { $toString: '$$emailEntry.communityId' },
                    },
                  },
                },
                in: {
                  _id: '$$populated._id',
                  name: '$$populated.name',
                  logo: '$$populated.communityLogoUrl.imageUrl',
                  isVerifiedMember: {
                    $in: [{ $toString: '$$populated._id' }, '$$verifiedCommunities'],
                  },
                  isCommunityAdmin: {
                    $in: [
                      new mongoose.Types.ObjectId(currentUserId!),
                      { $ifNull: ['$$populated.adminId', []] },
                    ],
                  },
                },
              },
            },
          },
        },
      }
    : {
        [communitiesKey]: {
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
                          input: { $ifNull: [`$${dataKey}`, []] },
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
      };

  return [
    {
      $lookup: {
        from: 'communities',
        localField: 'commenterProfileId.communities.communityId',
        foreignField: '_id',
        as: dataKey,
      },
    },
    { $addFields: addFieldsContent },
    { $project: { [dataKey]: 0 } },
  ];
}

export interface CommentEnrichmentOptions {
  /** Match commenterId.isDeleted !== true. Used in getComments / getSingle. */
  matchNotDeleted?: boolean;
  /** preserveNullAndEmptyArrays for commenter unwind. Default true. */
  commenterPreserveNull?: boolean;
  /** Enrichment variant and optional currentUserId. */
  communitiesOptions: CommentCommunitiesEnrichmentOptions;
}

/**
 * Full comment enrichment: commenter lookup → commenterProfile lookup → communities enrichment.
 * Use after $match in comment aggregation or inside replies $lookup pipeline.
 */
export function buildCommentEnrichmentStages(options: CommentEnrichmentOptions): PipelineStage[] {
  return [
    ...buildCommenterLookupStages({
      matchNotDeleted: options.matchNotDeleted,
      preserveNullAndEmptyArrays: options.commenterPreserveNull ?? true,
    }),
    ...buildCommenterProfileLookupStages(true),
    ...buildCommentCommunitiesEnrichmentStages(options.communitiesOptions),
  ];
}

/**
 * Final $project for community post comments, mirroring the user post comments
 * response shape while including community-specific fields (postId, isCommentVerified).
 */
export function buildCommentResponseProjectStage(): PipelineStage {
  return {
    $project: {
      _id: 1,
      content: 1,
      replies: 1,
      level: 1,
      likeCount: 1,
      imageUrl: 1,
      isCommentVerified: 1,
      postId: 1,
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
    },
  };
}
