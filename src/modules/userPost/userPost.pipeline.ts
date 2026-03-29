import mongoose, { PipelineStage } from 'mongoose';

/** Options for user lookup (alias 'user' or 'postOwner'). */
export type UserAlias = 'user' | 'postOwner';
/** Options for profile lookup (alias 'userProfile' or 'profile'). */
export type ProfileAlias = 'userProfile' | 'profile';

/**
 * Returns pipeline stages to lookup users by user_id and unwind.
 */
export function getUserLookupStages(
  options: { as?: UserAlias; preserveNullAndEmptyArrays?: boolean } = {}
): PipelineStage[] {
  const as = options.as ?? 'user';
  const preserveNull = options.preserveNullAndEmptyArrays ?? false;
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as,
      },
    },
    {
      $unwind: preserveNull ? { path: `$${as}`, preserveNullAndEmptyArrays: true } : `$${as}`,
    },
    { $match: { [`${as}.isDeleted`]: { $ne: true } } },
  ];
}

/**
 * Returns pipeline stages to lookup userprofiles by user reference.
 */
export function getUserProfileLookupStages(
  options: { profileAs?: ProfileAlias; userAs?: UserAlias; preserveNull?: boolean } = {}
): PipelineStage[] {
  const profileAs = options.profileAs ?? 'userProfile';
  const userAs = options.userAs ?? 'user';
  const localField = `${userAs}._id`;
  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField,
        foreignField: 'users_id',
        as: profileAs,
      },
    },
    {
      $unwind: {
        path: `$${profileAs}`,
        preserveNullAndEmptyArrays: options.preserveNull ?? true,
      },
    },
  ];
}

/**
 * Returns pipeline stages to populate profile.communities from communities collection.
 * userRefForVerified: '$user._id' or '$postOwner._id' (used in isVerifiedMember/isCommunityAdmin).
 */
export function getProfileCommunitiesStages(
  options: { profileAs?: ProfileAlias; userRefForVerified?: string } = {}
): PipelineStage[] {
  const profileAs = options.profileAs ?? 'userProfile';
  const userRef = options.userRefForVerified ?? '$user._id';
  const communitiesDataKey = `${profileAs}.communitiesData`;
  const communitiesKey = `${profileAs}.communities`;
  return [
    {
      $lookup: {
        from: 'communities',
        localField: `${profileAs}.communities.communityId`,
        foreignField: '_id',
        as: communitiesDataKey,
      },
    },
    {
      $addFields: {
        [communitiesKey]: {
          $map: {
            input: { $ifNull: [`$${profileAs}.communities`, []] },
            as: 'comm',
            in: {
              $let: {
                vars: {
                  populated: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: [`$${communitiesDataKey}`, []] },
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
                                    { $eq: ['$$usr._id', userRef] },
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
                    $in: [userRef, { $ifNull: ['$$populated.adminId', []] }],
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $project: { [communitiesDataKey]: 0 },
    },
  ];
}

/**
 * Options for "author not blocking viewer" $match stage.
 * Post author's profile.blockedUsers must not contain viewerUserId.
 */
export interface AuthorNotBlockingViewerOptions {
  profileAs?: ProfileAlias;
  viewerUserId: string | null | undefined;
}

/**
 * Returns $match stage(s): post author (profile owner) has not blocked the viewer.
 * Returns empty array if viewerUserId is null/undefined.
 */
export function getAuthorNotBlockingViewerStages(
  options: AuthorNotBlockingViewerOptions
): PipelineStage[] {
  const { profileAs = 'userProfile', viewerUserId } = options;
  if (viewerUserId == null) return [];
  return [
    {
      $match: {
        [`${profileAs}.blockedUsers`]: {
          $not: {
            $elemMatch: { userId: new mongoose.Types.ObjectId(viewerUserId) },
          },
        },
      },
    },
  ];
}

/**
 * Options for "viewer not blocking author" $match stage.
 */
export interface ViewerNotBlockingAuthorOptions {
  userAs?: UserAlias;
  blockedUserIds: mongoose.Types.ObjectId[];
}

/**
 * Returns $match stage: viewer has not blocked the post author (author's user._id not in viewer's blocked list).
 */
export function getViewerNotBlockingAuthorStages(
  options: ViewerNotBlockingAuthorOptions
): PipelineStage[] {
  const { userAs = 'user', blockedUserIds } = options;
  return [
    {
      $match: {
        [`${userAs}._id`]: { $nin: blockedUserIds },
      },
    },
  ];
}

export interface UserPostCommentSubpipelineOptions {
  myUserId?: string;
  myBlockedUserIds?: mongoose.Types.ObjectId[];
}

/**
 * Returns pipeline stages: lookup userpostcomments (subpipeline with commenter/commenterProfile),
 * then addFields commentCount from $size of allComments.
 */
export function getUserPostCommentCountBySubpipelineStages(
  options: UserPostCommentSubpipelineOptions = {}
): PipelineStage[] {
  const { myUserId, myBlockedUserIds = [] } = options;
  const lookupPipeline: Record<string, unknown>[] = [
    { $match: { $expr: { $eq: ['$userPostId', '$$postId'] } } },
    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenter',
      },
    },
    { $unwind: { path: '$commenter', preserveNullAndEmptyArrays: false } },
    { $match: { 'commenter.isDeleted': { $ne: true } } },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenter._id',
        foreignField: 'users_id',
        as: 'commenterProfile',
      },
    },
    { $unwind: { path: '$commenterProfile', preserveNullAndEmptyArrays: false } },
  ];
  if (myUserId) {
    lookupPipeline.push({
      $match: {
        'commenterProfile.blockedUsers': {
          $not: {
            $elemMatch: { userId: new mongoose.Types.ObjectId(myUserId) },
          },
        },
      },
    });
  }
  if (myBlockedUserIds.length) {
    lookupPipeline.push({
      $match: { 'commenter._id': { $nin: myBlockedUserIds } },
    });
  }
  lookupPipeline.push({ $project: { _id: 1 } });

  return [
    {
      $lookup: {
        from: 'userpostcomments',
        let: { postId: '$_id' },
        pipeline: lookupPipeline as any,
        as: 'allComments',
      },
    },
    {
      $addFields: {
        commentCount: { $size: '$allComments' },
      },
    },
  ];
}

export interface CommunityPostCommentSubpipelineOptions {
  viewerUserId?: string;
  myBlockedUserIds?: mongoose.Types.ObjectId[];
}

/**
 * Returns pipeline stages: lookup communitypostcomments (subpipeline with commenter/commenterProfile),
 * then addFields commentCount from $size of allComments.
 * Used for community posts in timeline aggregation.
 */
export function getCommunityPostCommentCountBySubpipelineStages(
  options: CommunityPostCommentSubpipelineOptions = {}
): PipelineStage[] {
  const { viewerUserId, myBlockedUserIds = [] } = options;
  const lookupPipeline: PipelineStage[] = [
    { $match: { $expr: { $eq: ['$postId', '$$postId'] } } },
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
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenter._id',
        foreignField: 'users_id',
        as: 'commenterProfile',
      },
    },
    { $unwind: { path: '$commenterProfile', preserveNullAndEmptyArrays: true } },
  ];
  if (viewerUserId) {
    lookupPipeline.push({
      $match: {
        'commenterProfile.blockedUsers': {
          $not: {
            $elemMatch: { userId: new mongoose.Types.ObjectId(viewerUserId) },
          },
        },
      },
    });
  }
  if (myBlockedUserIds.length) {
    lookupPipeline.push({
      $match: { 'commenter._id': { $nin: myBlockedUserIds } },
    });
  }
  lookupPipeline.push({ $project: { _id: 1 } });

  return [
    {
      $lookup: {
        from: 'communitypostcomments',
        let: { postId: '$_id' },
        pipeline: lookupPipeline as any,
        as: 'allComments',
      },
    },
    {
      $addFields: {
        commentCount: { $size: '$allComments' },
      },
    },
  ];
}

export interface UserPostProjectOptions {
  includeEmail?: boolean;
  includeCommunities?: boolean;
  userFrom?: UserAlias;
  profileFrom?: ProfileAlias;
}

const BASE_USER_PROJECT = {
  _id: 1,
  content: 1,
  createdAt: 1,
  updatedAt: 1,
  imageUrl: 1,
  likeCount: 1,
  commentCount: 1,
  PostType: 1,
  postType: 1,
};

/**
 * Returns $project stage for user posts (user + userProfile).
 */
export function getUserPostProjectStage(options: UserPostProjectOptions = {}): PipelineStage {
  const {
    includeEmail = false,
    includeCommunities = false,
    userFrom = 'user',
    profileFrom = 'userProfile',
  } = options;
  const userFields: Record<string, number> = {
    _id: 1,
    firstName: 1,
    lastName: 1,
    ...(includeEmail ? { email: 1 } : {}),
  };
  const profileFields: Record<string, number> = {
    profile_dp: 1,
    university_name: 1,
    study_year: 1,
    degree: 1,
    major: 1,
    affiliation: 1,
    occupation: 1,
    role: 1,
    isCommunityAdmin: 1,
    adminCommunityId: 1,
    ...(includeCommunities ? { communities: 1 } : {}),
  };
  return {
    $project: {
      ...BASE_USER_PROJECT,
      [userFrom]: userFields,
      [profileFrom]: profileFields,
    },
  };
}

/**
 * Returns $project stage for single user post detail (getUserPost).
 * Uses postOwner and profile aliases, outputs as user and profile.
 */
export function getUserPostDetailProjectStage(options: {
  userFrom?: UserAlias;
  profileFrom?: ProfileAlias;
} = {}): PipelineStage {
  const userFrom = options.userFrom ?? 'postOwner';
  const profileFrom = options.profileFrom ?? 'profile';
  return {
    $project: {
      _id: 1,
      user_id: 1,
      PostType: 1,
      content: 1,
      imageUrl: 1,
      likeCount: 1,
      createdAt: 1,
      updatedAt: 1,
      user: {
        firstName: `$${userFrom}.firstName`,
        lastName: `$${userFrom}.lastName`,
      },
      [profileFrom]: {
        profile_dp: 1,
        university_name: 1,
        study_year: 1,
        degree: 1,
        major: 1,
        affiliation: 1,
        occupation: 1,
        role: 1,
        isCommunityAdmin: 1,
        adminCommunityId: 1,
        communities: 1,
      },
      commentCount: 1,
    },
  };
}

/**
 * $project shape for timeline community posts (user + userProfile + community).
 */
export const TIMELINE_COMMUNITY_POST_PROJECT = {
  _id: 1,
  content: 1,
  createdAt: 1,
  updatedAt: 1,
  imageUrl: 1,
  likeCount: 1,
  commentCount: 1,
  communityPostsType: 1,
  isPostVerified: 1,
  postType: 1,
  communityName: 1,
  communityGroupName: 1,
  communityGroupId: 1,
  user: { _id: 1, firstName: 1, lastName: 1, email: 1 },
  userProfile: {
    profile_dp: 1,
    university_name: 1,
    study_year: 1,
    degree: 1,
    major: 1,
    affiliation: 1,
    occupation: 1,
    role: 1,
    isCommunityAdmin: 1,
    adminCommunityId: 1,
    communities: 1,
  },
  community: { _id: 1, name: 1, logo: 1, description: 1 },
} as const;

/**
 * Returns $project stage for timeline community posts aggregation.
 */
export function getTimelineCommunityPostProjectStage(): PipelineStage {
  return { $project: { ...TIMELINE_COMMUNITY_POST_PROJECT } };
}

/**
 * Returns $project stage for user posts list (minimal: no updatedAt, no PostType/postType, no email).
 */
export function getUserPostListProjectStage(options: { profileAs?: ProfileAlias } = {}): PipelineStage {
  const profileAs = options.profileAs ?? 'userProfile';
  return {
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
      [profileAs]: {
        profile_dp: 1,
        university_name: 1,
        study_year: 1,
        degree: 1,
        major: 1,
        affiliation: 1,
        occupation: 1,
        role: 1,
        isCommunityAdmin: 1,
        adminCommunityId: 1,
        ...(profileAs === 'userProfile' ? { communities: 1 } : {}),
      },
    },
  };
}
