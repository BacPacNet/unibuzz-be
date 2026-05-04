import { Types, PipelineStage } from 'mongoose';

/**
 * Base stages shared between members data and count pipelines:
 * match group, unwind users, filter by status, lookup users, filter deleted.
 */
export function buildCommunityGroupMembersBaseStages(
  groupId: Types.ObjectId,
  targetStatus: string
): PipelineStage[] {
  return [
    { $match: { _id: groupId } },
    { $unwind: '$users' },
    { $match: { 'users.status': targetStatus } },
    {
      $lookup: {
        from: 'users',
        localField: 'users._id',
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    { $match: { 'userDoc.isDeleted': { $ne: true } } },
  ];
}

/**
 * Builds the pipeline for counting community group members (after base stages).
 */
export function buildCommunityGroupMembersCountPipeline(
  groupId: Types.ObjectId,
  targetStatus: string
): PipelineStage[] {
  return [...buildCommunityGroupMembersBaseStages(groupId, targetStatus), { $count: 'total' }];
}

/**
 * Builds the full pipeline for fetching paginated community group members with
 * blocked-user filtering, verification lookup, and sort.
 */
export function buildCommunityGroupMembersDataPipeline(
  groupId: Types.ObjectId,
  targetStatus: string,
  blockedUserIds: Types.ObjectId[],
  userId: string,
  adminId: string,
  communityId: string | Types.ObjectId,
  page: number,
  limit: number
): PipelineStage[] {
  const communityObjectId =
    typeof communityId === 'string' ? new Types.ObjectId(communityId) : communityId;

  return [
    ...buildCommunityGroupMembersBaseStages(groupId, targetStatus),
    {
      $lookup: {
        from: 'userprofiles',
        let: { memberUserId: '$userDoc._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$users_id', '$$memberUserId'],
              },
            },
          },
          {
            $project: {
              blockedUsers: 1,
            },
          },
        ],
        as: 'memberProfile',
      },
    },
    {
      $unwind: {
        path: '$memberProfile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        'userDoc._id': { $nin: blockedUserIds },
        'memberProfile.blockedUsers': {
          $not: {
            $elemMatch: {
              userId: new Types.ObjectId(userId),
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'communities',
        let: { userId: '$users._id' },
        pipeline: [
          { $match: { _id: communityObjectId } },
          { $unwind: '$users' },
          {
            $match: {
              $expr: {
                $eq: [{ $toString: '$users._id' }, { $toString: '$$userId' }],
              },
            },
          },
          { $project: { 'users.isVerified': 1 } },
        ],
        as: 'communityUser',
      },
    },
    { $unwind: { path: '$communityUser', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        'users.isAdmin': {
          $eq: ['$users._id', new Types.ObjectId(adminId)],
        },
        'users.isVerified': '$communityUser.users.isVerified',
      },
    },
    {
      $sort: {
        'users.isAdmin': -1,
        'users.firstName': 1,
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $group: {
        _id: '$_id',
        users: { $push: '$users' },
      },
    },
  ];
}


export function buildCommunityGroupMembersDataPipelineForSuperAdmin(
  groupId: Types.ObjectId,
  targetStatus: string,
  adminId: string,
  communityId: string | Types.ObjectId,
  page: number,
  limit: number
): PipelineStage[] {
  const communityObjectId =
    typeof communityId === 'string' ? new Types.ObjectId(communityId) : communityId;

  return [
    ...buildCommunityGroupMembersBaseStages(groupId, targetStatus),
    {
      $lookup: {
        from: 'communities',
        let: { userId: '$users._id' },
        pipeline: [
          { $match: { _id: communityObjectId } },
          { $unwind: '$users' },
          {
            $match: {
              $expr: {
                $eq: [{ $toString: '$users._id' }, { $toString: '$$userId' }],
              },
            },
          },
          { $project: { 'users.isVerified': 1 } },
        ],
        as: 'communityUser',
      },
    },
    { $unwind: { path: '$communityUser', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        'users.isAdmin': {
          $eq: ['$users._id', new Types.ObjectId(adminId)],
        },
        'users.isVerified': '$communityUser.users.isVerified',
      },
    },
    {
      $sort: {
        'users.isAdmin': -1,
        'users.firstName': 1,
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $group: {
        _id: '$_id',
        users: { $push: '$users' },
      },
    },
  ];
}
