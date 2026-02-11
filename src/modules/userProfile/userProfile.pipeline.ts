import mongoose, { PipelineStage } from 'mongoose';

// Collection names (for $lookup)
const COLLECTION_USERPROFILES = 'userprofiles';
const COLLECTION_USERS = 'users';

// Field names used in aggregations
const FIELD_USERS_ID = 'users_id';
const FIELD_BLOCKED_USERS = 'blockedUsers';

/** Lookup alias for user profile in follow-list aggregations. */
export const PROFILE_AS = 'profile';

// ---------------------------------------------------------------------------
// Follow list (getFollowing / getFollowers) — User.aggregate
// ---------------------------------------------------------------------------

export interface FollowListMatchOptions {
  userIds: mongoose.Types.ObjectId[];
  excludedUserIds: mongoose.Types.ObjectId[];
  nameFilter?: Record<string, unknown> | undefined;
}

/**
 * Returns $match stage(s) for follow list: user ids, exclude blocked, optional name filter, not deleted.
 */
export function getFollowListMatchStages(options: FollowListMatchOptions): PipelineStage[] {
  const { userIds, excludedUserIds, nameFilter = {} } = options;
  return [
    {
      $match: {
        _id: { $in: userIds, $nin: excludedUserIds },
        isDeleted: { $ne: true },
        ...nameFilter,
      },
    },
  ];
}

export interface ProfileLookupOptions {
  profileAs?: string | undefined;
}

/**
 * Returns pipeline stages to lookup userprofiles by user _id and unwind.
 */
export function getProfileLookupStages(options: ProfileLookupOptions = {}): PipelineStage[] {
  const profileAs = options.profileAs ?? PROFILE_AS;
  return [
    {
      $lookup: {
        from: COLLECTION_USERPROFILES,
        localField: '_id',
        foreignField: FIELD_USERS_ID,
        as: profileAs,
      },
    },
    {
      $unwind: { path: `$${profileAs}`, preserveNullAndEmptyArrays: true },
    },
  ];
}

export interface ProfileNotBlockingViewerOptions {
  viewerUserId: mongoose.Types.ObjectId;
  profileAs?: string | undefined;
}

/**
 * Returns $match stage: profile owner has not blocked the viewer (viewer not in profile.blockedUsers).
 */
export function getProfileNotBlockingViewerStages(
  options: ProfileNotBlockingViewerOptions
): PipelineStage[] {
  const { viewerUserId, profileAs = PROFILE_AS } = options;
  return [
    {
      $match: {
        [`${profileAs}.${FIELD_BLOCKED_USERS}`]: {
          $not: {
            $elemMatch: { userId: viewerUserId },
          },
        },
      },
    },
  ];
}

export interface FollowListAddFieldsOptions {
  isFollowing: true | mongoose.Types.ObjectId[];
}

/**
 * Returns $addFields stage for follow list: isFollowing true or $in for follower list.
 */
export function getFollowListAddFieldsStage(options: FollowListAddFieldsOptions): PipelineStage {
  const { isFollowing } = options;
  if (isFollowing === true) {
    return { $addFields: { isFollowing: true } };
  }
  return {
    $addFields: {
      isFollowing: { $in: ['$_id', isFollowing] },
    },
  };
}

/**
 * Returns $skip and $limit stages for pagination.
 */
export function getFollowListPaginationStages(skip: number, limit: number): PipelineStage[] {
  return [{ $skip: skip }, { $limit: limit }];
}

/**
 * Returns $project stage for follow list: only fields needed by the client
 * (_id, firstName, lastName, isFollowing, profile with university_name, study_year, degree, major, occupation, role, affiliation, profile_dp).
 */
export function getFollowListProjectStage(options: { profileAs?: string | undefined }): PipelineStage {
  const profileAs = options.profileAs ?? PROFILE_AS;
  return {
    $project: {
      _id: 1,
      firstName: 1,
      lastName: 1,
      isFollowing: 1,
      profile: {
        _id: `$${profileAs}._id`,
        university_name: `$${profileAs}.university_name`,
        study_year: `$${profileAs}.study_year`,
        degree: `$${profileAs}.degree`,
        major: `$${profileAs}.major`,
        occupation: `$${profileAs}.occupation`,
        role: `$${profileAs}.role`,
        affiliation: `$${profileAs}.affiliation`,
        profile_dp: `$${profileAs}.profile_dp`,
      },
    },
  };
}

export interface GetFollowListPipelineOptions {
  userIds: mongoose.Types.ObjectId[];
  myBlockedUserIds: mongoose.Types.ObjectId[];
  myUserObjectId: mongoose.Types.ObjectId;
  nameFilter?: Record<string, unknown> | undefined;
  isFollowing: true | mongoose.Types.ObjectId[];
  skip: number;
  limit: number;
  profileAs?: string | undefined;
}

/**
 * Returns full pipeline stages for getFollowing / getFollowers (User.aggregate).
 */
export function getFollowListPipelineStages(options: GetFollowListPipelineOptions): PipelineStage[] {
  const stages: PipelineStage[] = [];
  stages.push(
    ...getFollowListMatchStages({
      userIds: options.userIds,
      excludedUserIds: options.myBlockedUserIds,
      nameFilter: options.nameFilter,
    })
  );
  stages.push(...getProfileLookupStages({ profileAs: options.profileAs }));
  stages.push(
    ...getProfileNotBlockingViewerStages({
      viewerUserId: options.myUserObjectId,
      profileAs: options.profileAs,
    })
  );
  stages.push(getFollowListAddFieldsStage({ isFollowing: options.isFollowing }));
  stages.push(...getFollowListPaginationStages(options.skip, options.limit));
  stages.push(getFollowListProjectStage({ profileAs: options.profileAs }));
  return stages;
}

// ---------------------------------------------------------------------------
// Blocked users — UserProfile.aggregate
// ---------------------------------------------------------------------------

/**
 * Returns full pipeline stages for getBlockedUsers (UserProfile.aggregate).
 */
export function getBlockedUsersPipelineStages(userId: string): PipelineStage[] {
  return [
    {
      $match: {
        [FIELD_USERS_ID]: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        blockedUserIds: `$${FIELD_BLOCKED_USERS}.userId`,
      },
    },
    {
      $lookup: {
        from: COLLECTION_USERPROFILES,
        localField: 'blockedUserIds',
        foreignField: FIELD_USERS_ID,
        as: 'blockedProfiles',
      },
    },
    { $unwind: '$blockedProfiles' },
    {
      $lookup: {
        from: COLLECTION_USERS,
        localField: `blockedProfiles.${FIELD_USERS_ID}`,
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        id: '$user._id',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        university: '$blockedProfiles.university_name',
        study_year: '$blockedProfiles.study_year',
        degree: '$blockedProfiles.degree',
        major: '$blockedProfiles.major',
        occupation: '$blockedProfiles.occupation',
        affiliation: '$blockedProfiles.affiliation',
        role: '$blockedProfiles.role',
        imageUrl: '$blockedProfiles.profile_dp.imageUrl',
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Following and mutuals — User.aggregate
// ---------------------------------------------------------------------------

export interface GetFollowingAndMutualsPipelineOptions {
  mutualIds: mongoose.Types.ObjectId[];
  nameFilter?: Record<string, unknown> | undefined;
  skip: number;
  limit: number;
  profileAs?: string | undefined;
}

/**
 * Returns full pipeline stages for getFollowingAndMutuals (User.aggregate).
 */
export function getFollowingAndMutualsPipelineStages(
  options: GetFollowingAndMutualsPipelineOptions
): PipelineStage[] {
  const { mutualIds, nameFilter = {}, skip, limit, profileAs = PROFILE_AS } = options;
  return [
    {
      $match: {
        _id: { $in: mutualIds },
        isDeleted: { $ne: true },
        ...nameFilter,
      },
    },
    ...getProfileLookupStages({ profileAs }),
    {
      $addFields: {
        isFollowing: true,
      },
    },
    ...getFollowListPaginationStages(skip, limit),
    getFollowListProjectStage({ profileAs }),
  ];
}
