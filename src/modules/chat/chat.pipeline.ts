import { PipelineStage, Types } from 'mongoose';

/**
 * Builds the aggregation pipeline for getGroupChatMembers:
 * match chat + caller is member, unwind users, lookup users (exclude deleted),
 * lookup userprofiles, filter out users who blocked caller or are blocked by caller, add fields, group.
 */
export function getGroupChatMembersPipeline(
  chatObjectId: Types.ObjectId,
  myObjectId: Types.ObjectId,
  myBlockedUserIds: Types.ObjectId[]
): PipelineStage[] {
  return [
    {
      $match: {
        _id: chatObjectId,
        users: {
          $elemMatch: { userId: myObjectId },
        },
      },
    },
    { $unwind: '$users' },
    {
      $lookup: {
        from: 'users',
        localField: 'users.userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isDeleted': { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'user._id',
        foreignField: 'users_id',
        as: 'userProfile',
      },
    },
    {
      $unwind: {
        path: '$userProfile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        'userProfile.blockedUsers': {
          $not: {
            $elemMatch: {
              userId: myObjectId,
            },
          },
        },
      },
    },
    {
      $match: {
        'user._id': {
          $nin: myBlockedUserIds,
        },
      },
    },
    {
      $addFields: {
        'users.userId': {
          _id: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          profileDp: '$userProfile.profile_dp.imageUrl',
          universityName: '$userProfile.university_name',
          studyYear: '$userProfile.study_year',
          degree: '$userProfile.degree',
          major: '$userProfile.major',
          occupation: '$userProfile.occupation',
          affiliation: '$userProfile.affiliation',
          role: '$userProfile.role',
        },
      },
    },
    {
      $group: {
        _id: '$_id',
        chatName: { $first: '$chatName' },
        groupDescription: { $first: '$groupDescription' },
        community: { $first: '$community' },
        isGroupChat: { $first: '$isGroupChat' },
        groupAdmin: { $first: '$groupAdmin' },
        users: { $push: '$users' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
      },
    },
  ];
}
