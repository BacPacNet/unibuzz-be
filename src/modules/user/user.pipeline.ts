import mongoose, { PipelineStage } from 'mongoose';
import { GetAllUserMatchStage, GetAllUserOrCondition } from './user.interfaces';

// ---------------------------------------------------------------------------
// getUserProfileById — filter profile.following / profile.followers
// (exclude blocked, deleted, and users who blocked the viewer)
// ---------------------------------------------------------------------------

export interface FilterFollowListConditionOptions {
  /** $lookup alias for users (e.g. 'followingUsers' or 'followersUsers'). */
  usersArrayField: string;
  /** $lookup alias for userprofiles (e.g. 'followingProfiles' or 'followersProfiles'). */
  profilesArrayField: string;
  myBlockedUserIds: mongoose.Types.ObjectId[];
  myUserObjectId: mongoose.Types.ObjectId;
}

/**
 * Builds the $filter condition for one follow list (following or followers).
 * Keeps only entries where: user exists and is not deleted, not in my blocked list,
 * and has not blocked the viewer.
 */
function buildFilterFollowListCondition(options: FilterFollowListConditionOptions): Record<string, unknown> {
  const { usersArrayField, profilesArrayField, myBlockedUserIds, myUserObjectId } = options;
  const usersPath = `$${usersArrayField}`;
  const profilesPath = `$${profilesArrayField}`;

  return {
    $and: [
      {
        $gt: [
          {
            $size: {
              $filter: {
                input: usersPath,
                as: 'u',
                cond: {
                  $and: [
                    { $eq: ['$$u._id', '$$f.userId'] },
                    { $ne: ['$$u.isDeleted', true] },
                  ],
                },
              },
            },
          },
          0,
        ],
      },
      { $not: { $in: ['$$f.userId', myBlockedUserIds] } },
      {
        $not: {
          $anyElementTrue: {
            $map: {
              input: {
                $ifNull: [
                  {
                    $filter: {
                      input: profilesPath,
                      as: 'fp',
                      cond: { $eq: ['$$fp.users_id', '$$f.userId'] },
                    },
                  },
                  [],
                ],
              },
              as: 'fp',
              in: {
                $anyElementTrue: {
                  $map: {
                    input: { $ifNull: ['$$fp.blockedUsers', []] },
                    as: 'b',
                    in: { $eq: ['$$b.userId', myUserObjectId] },
                  },
                },
              },
            },
          },
        },
      },
    ],
  };
}

/** Options for the $addFields stage that filters both profile.following and profile.followers. */
export interface GetProfileFollowListsFilterStageOptions {
  myBlockedUserIds: mongoose.Types.ObjectId[];
  myUserObjectId: mongoose.Types.ObjectId;
}

/**
 * Returns the $addFields pipeline stage that filters profile.following and profile.followers
 * by: existing non-deleted user, not in viewer's blocked list, and not blocking the viewer.
 * Use after $lookup for followingUsers, followersUsers, followingProfiles, followersProfiles.
 */
export function getProfileFollowListsFilterStage(
  options: GetProfileFollowListsFilterStageOptions
): PipelineStage {
  const { myBlockedUserIds, myUserObjectId } = options;

  const followingCond = buildFilterFollowListCondition({
    usersArrayField: 'followingUsers',
    profilesArrayField: 'followingProfiles',
    myBlockedUserIds,
    myUserObjectId,
  });

  const followersCond = buildFilterFollowListCondition({
    usersArrayField: 'followersUsers',
    profilesArrayField: 'followersProfiles',
    myBlockedUserIds,
    myUserObjectId,
  });

  return {
    $addFields: {
      'profile.following': {
        $filter: {
          input: '$profile.following',
          as: 'f',
          cond: followingCond,
        },
      },
      'profile.followers': {
        $filter: {
          input: '$profile.followers',
          as: 'f',
          cond: followersCond,
        },
      },
    },
  };
}

/**
 * Returns $project stage to remove temporary lookup arrays (followingUsers, followersUsers).
 */
export function getProfileFollowListsProjectStage(): PipelineStage {
  return {
    $project: {
      followingUsers: 0,
      followersUsers: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// getUserProfileById — profile.communities lookup and reshape
// ---------------------------------------------------------------------------

/**
 * Returns the $lookup stage that populates profile.communities with community data.
 * Use when the document has profile.communities[].communityId.
 */
export function getProfileCommunitiesLookupStage(): PipelineStage {
  return {
    $lookup: {
      from: 'communities',
      localField: 'profile.communities.communityId',
      foreignField: '_id',
      as: 'profile.communitiesData',
    },
  };
}

/**
 * Returns the $addFields stage that maps profile.communities to include
 * populated community fields (name, logo, isVerifiedMember, isCommunityAdmin).
 * Depends on profile.communitiesData from getProfileCommunitiesLookupStage.
 * Uses root document _id for isVerifiedMember check.
 */
export function getProfileCommunitiesAddFieldsStage(): PipelineStage {
  return {
    $addFields: {
      'profile.communities': {
        $map: {
          input: { $ifNull: ['$profile.communities', []] },
          as: 'comm',
          in: {
            $let: {
              vars: {
                populated: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$profile.communitiesData', []] },
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
                                  { $eq: ['$$usr._id', '$_id'] },
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
                      $in: ['$_id', { $ifNull: ['$$populated.adminId', []] }],
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
  };
}

/**
 * Returns $project stage to remove temporary profile.communitiesData after reshape.
 */
export function getProfileCommunitiesProjectStage(): PipelineStage {
  return {
    $project: {
      'profile.communitiesData': 0,
    },
  };
}

// ---------------------------------------------------------------------------
// getUserProfileById — full pipeline builder
// ---------------------------------------------------------------------------

export interface GetProfileByIdPipelineOptions {
  id: mongoose.Types.ObjectId;
  myUserId: string;
  myBlockedUserIds: mongoose.Types.ObjectId[];
  myUserObjectId: mongoose.Types.ObjectId;
}

/** Initial $match stages: by id and exclude viewer's blocked users. */
function getProfileByIdInitialMatchStages(id: mongoose.Types.ObjectId, myBlockedUserIds: mongoose.Types.ObjectId[]): PipelineStage[] {
  return [
    { $match: { _id: id } },
    { $match: { _id: { $nin: myBlockedUserIds } } },
  ];
}

/** $lookup userprofiles + $unwind profile. */
function getProfileByIdProfileLookupStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    {
      $unwind: {
        path: '$profile',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];
}

/** $lookup stages for following/followers users and profiles. */
function getProfileByIdFollowLookupStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'profile.following.userId',
        foreignField: '_id',
        as: 'followingUsers',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'profile.followers.userId',
        foreignField: '_id',
        as: 'followersUsers',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'profile.following.userId',
        foreignField: 'users_id',
        as: 'followingProfiles',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'profile.followers.userId',
        foreignField: 'users_id',
        as: 'followersProfiles',
      },
    },
  ];
}

/** $match stages after communities reshape: exclude users who blocked viewer, exclude deleted. */
function getProfileByIdPostFilterStages(myUserId: string): PipelineStage[] {
  return [
    {
      $match: {
        'profile.blockedUsers.userId': { $ne: new mongoose.Types.ObjectId(myUserId) },
      },
    },
    {
      $match: {
        isDeleted: { $ne: true },
      },
    },
  ];
}

/** $lookup communities as communityDetails. */
function getProfileByIdCommunityDetailsLookupStage(): PipelineStage {
  return {
    $lookup: {
      from: 'communities',
      localField: 'profile.communities.communityId',
      foreignField: '_id',
      as: 'communityDetails',
    },
  };
}

/** Final $project to exclude password. */
function getProfileByIdFinalProjectStage(): PipelineStage {
  return {
    $project: {
      password: 0,
      'profile.blockedUsers': 0,
      'profile.statusChangeHistory': 0,
      followingProfiles: 0,
      followersProfiles: 0,
     
    },
  };
}

/**
 * Returns the full aggregation pipeline for getUserProfileById.
 * Use with User.aggregate(getProfileByIdPipeline(options)).
 */
export function getProfileByIdPipeline(options: GetProfileByIdPipelineOptions): PipelineStage[] {
  const { id, myUserId, myBlockedUserIds, myUserObjectId } = options;

  return [
    ...getProfileByIdInitialMatchStages(id, myBlockedUserIds),
    ...getProfileByIdProfileLookupStages(),
    ...getProfileByIdFollowLookupStages(),
    getProfileFollowListsFilterStage({ myBlockedUserIds, myUserObjectId }),
    getProfileFollowListsProjectStage(),
    getProfileCommunitiesLookupStage(),
    getProfileCommunitiesAddFieldsStage(),
    getProfileCommunitiesProjectStage(),
    ...getProfileByIdPostFilterStages(myUserId),
    getProfileByIdCommunityDetailsLookupStage(),
    getProfileByIdFinalProjectStage(),
  ];
}

// ---------------------------------------------------------------------------
// getAllUser — list users with profile, filters, pagination, isFollowing
// ---------------------------------------------------------------------------

/**
 * Build $or conditions for study year, major, occupation, and affiliation filters in getAllUser.
 */
export function buildGetAllUserOrConditions(
  studyYear: string[],
  major: string[],
  occupation: string[],
  affiliation: string[]
): GetAllUserOrCondition[] {
  const orConditions: GetAllUserOrCondition[] = [];

  if (studyYear.length && major.length) {
    orConditions.push({
      $and: [{ 'profile.study_year': { $in: studyYear } }, { 'profile.major': { $in: major } }],
    });
  } else if (studyYear.length) {
    orConditions.push({ 'profile.study_year': { $in: studyYear } });
  } else if (major.length) {
    orConditions.push({ 'profile.major': { $in: major } });
  }

  if (occupation.length && affiliation.length) {
    orConditions.push({
      $and: [{ 'profile.occupation': { $in: occupation } }, { 'profile.affiliation': { $in: affiliation } }],
    });
  } else if (occupation.length) {
    orConditions.push({ 'profile.occupation': { $in: occupation } });
  } else if (affiliation.length) {
    orConditions.push({ 'profile.affiliation': { $in: affiliation } });
  }

  return orConditions;
}

/** Options for building the $match stage used in getAllUser aggregation. */
export interface BuildGetAllUserMatchStageOptions {
  userId: string;
  myBlockedUserIds: mongoose.Types.ObjectId[];
  firstName: string;
  lastName: string;
  universityName: string;
  orConditions: GetAllUserOrCondition[];
}

/**
 * Build the $match stage for getAllUser aggregation (excluding chatId-based exclusion).
 */
export function buildGetAllUserMatchStage(options: BuildGetAllUserMatchStageOptions): GetAllUserMatchStage {
  const { userId, myBlockedUserIds, firstName, lastName, universityName, orConditions } = options;

  const matchStage: GetAllUserMatchStage = {
    _id: {
      $ne: new mongoose.Types.ObjectId(userId),
      $nin: myBlockedUserIds,
    },
    isDeleted: { $ne: true },
    'profile.blockedUsers': {
      $not: {
        $elemMatch: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
    },
  };

  if (firstName) {
    matchStage.firstName = { $regex: new RegExp(firstName, 'i') };
  }
  if (lastName) {
    matchStage.lastName = { $regex: new RegExp(lastName, 'i') };
  }
  if (universityName.trim() !== '') {
    matchStage['profile.university_name'] = { $regex: new RegExp(universityName, 'i') };
  }
  if (orConditions.length) {
    matchStage.$or = orConditions;
  }

  return matchStage;
}

export interface GetAllUserPipelineOptions {
  matchStage: GetAllUserMatchStage;
  followingIds: string[];
  skip: number;
  limit: number;
}

/**
 * Returns the full aggregation pipeline for getAllUser.
 * Use with User.aggregate(getAllUserPipeline(options)).
 */
export function getAllUserPipeline(options: GetAllUserPipelineOptions): PipelineStage[] {
  const { matchStage, followingIds, skip, limit } = options;
  const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));

  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    { $match: matchStage },
    {
      $facet: {
        users: [
          {
            $addFields: {
              isFollowing: {
                $in: ['$_id', followingObjectIds],
              },
            },
          },
          {
            $project: {
              password: 0,
              'profile.following': 0,
              'profile.followers': 0,
              'profile.blockedUsers': 0,
              'profile.statusChangeHistory': 0,
              'profile.communities': 0,
            },
          },
          { $skip: skip },
          { $limit: limit },
        ],
        totalCount: [{ $count: 'total' }],
      },
    },
    {
      $project: {
        users: 1,
        totalCount: 1,
      },
    },
  ];
}
