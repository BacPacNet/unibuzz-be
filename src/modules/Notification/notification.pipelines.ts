import mongoose, { PipelineStage } from 'mongoose';
import { BuildDedupePaginatePipelineOptions, notificationRoleAccess } from './notification.interface';

export const buildReceiverMatchStage = (
  userID: string,
  additionalMatch: Record<string, any> = {}
): PipelineStage.Match => ({
  $match: {
    receiverId: new mongoose.Types.ObjectId(userID),
    ...additionalMatch,
  },
});

export const buildUserNotificationTotalPipeline = (userID: string): PipelineStage[] => [
  buildReceiverMatchStage(userID, { isRead: false }),
  {
    $group: {
      _id: {
        type: '$type',
        senderId: '$sender_id',
        receiverId: '$receiverId',
      },
    },
  },
  {
    $count: 'total',
  },
];

export const buildUserNotificationCountPipeline = (userID: string): PipelineStage[] => [
  buildReceiverMatchStage(userID, { isRead: false }),
  {
    $group: {
      _id: {
        type: '$type',
        status: {
          $cond: [{ $eq: ['$type', 'GROUP_INVITE'] }, '$status', '$_id'],
        },
        senderId: {
          $cond: [{ $eq: ['$type', 'GROUP_INVITE'] }, '$sender_id', '$_id'],
        },
        receiverId: {
          $cond: [{ $eq: ['$type', 'GROUP_INVITE'] }, '$receiverId', '$_id'],
        },
        communityGroupId: {
          $cond: [{ $eq: ['$type', 'GROUP_INVITE'] }, '$communityGroupId', '$_id'],
        },
      },
    },
  },
  {
    $count: 'unreadCount',
  },
];

export const buildUserNotificationMainTotalPipeline = (userID: string): PipelineStage[] => [
  buildReceiverMatchStage(userID),
  {
    $group: {
      _id: {
        type: '$type',
        senderId: '$sender_id',
        receiverId: '$receiverId',
        userPostId: '$userPostId',
        communityPostId: '$communityPostId',
        communityGroupId: '$communityGroupId',
      },
    },
  },
  {
    $count: 'total',
  },
];

export const buildSenderAndProfileLookupStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'users',
      localField: 'sender_id',
      foreignField: '_id',
      as: 'senderDetails',
    },
  },
  {
    $unwind: {
      path: '$senderDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'userprofiles',
      localField: 'sender_id',
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
];

export const buildUserNotificationMainDetailLookupStages = (): PipelineStage[] => [
  {
    $lookup: {
      from: 'communities',
      localField: 'communityId',
      foreignField: '_id',
      as: 'directCommunityDetails',
    },
  },
  {
    $unwind: {
      path: '$directCommunityDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'communitygroups',
      localField: 'communityGroupId',
      foreignField: '_id',
      as: 'communityGroupDetails',
    },
  },
  {
    $unwind: {
      path: '$communityGroupDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'communities',
      localField: 'communityGroupDetails.communityId',
      foreignField: '_id',
      as: 'communityDetails',
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'likedBy.newFiveUsers',
      foreignField: '_id',
      as: 'likedUsersDetails',
    },
  },
  {
    $lookup: {
      from: 'userprofiles',
      localField: 'likedBy.newFiveUsers',
      foreignField: 'users_id',
      as: 'likedUsersProfiles',
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'commentedBy.newFiveUsers._id',
      foreignField: '_id',
      as: 'commentedUsersDetails',
    },
  },
  {
    $lookup: {
      from: 'userprofiles',
      localField: 'commentedBy.newFiveUsers._id',
      foreignField: 'users_id',
      as: 'commentedUsersProfiles',
    },
  },
  {
    $unwind: {
      path: '$communityDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'userposts',
      localField: 'userPostId',
      foreignField: '_id',
      as: 'userPostDetails',
    },
  },
  {
    $lookup: {
      from: 'userpostcomments',
      localField: 'userPostId',
      foreignField: 'userPostId',
      as: 'userPostComments',
    },
  },
  {
    $lookup: {
      from: 'communityposts',
      localField: 'communityPostId',
      foreignField: '_id',
      as: 'communityPostDetails',
    },
  },
  {
    $lookup: {
      from: 'communitypostcomments',
      localField: 'communityPostId',
      foreignField: 'postId',
      as: 'communityPostComments',
    },
  },
  {
    $unwind: {
      path: '$userPostDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $unwind: {
      path: '$communityPostDetails',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'communitypostcomments',
      localField: 'repliedBy.newFiveUsers.communityPostParentCommentId',
      foreignField: '_id',
      as: 'communityParentComments',
    },
  },
  {
    $lookup: {
      from: 'communitypostcomments',
      localField: 'communityParentComments.replies',
      foreignField: '_id',
      as: 'communityReplyComments',
    },
  },
  {
    $addFields: {
      communityParentCommentReplies: {
        $map: {
          input: '$communityParentComments',
          as: 'parent',
          in: {
            parentId: '$$parent._id',
            totalReplies: {
              $size: {
                $setDifference: [
                  {
                    $setUnion: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: '$communityReplyComments',
                              as: 'reply',
                              cond: { $in: ['$$reply._id', '$$parent.replies'] },
                            },
                          },
                          as: 'replyDoc',
                          in: '$$replyDoc.commenterId',
                        },
                      },
                      [],
                    ],
                  },
                  ['$$parent.commenterId'],
                ],
              },
            },
          },
        },
      },
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'repliedBy.newFiveUsers._id',
      foreignField: '_id',
      as: 'repliedUsersDetails',
    },
  },
  {
    $lookup: {
      from: 'userprofiles',
      localField: 'repliedBy.newFiveUsers._id',
      foreignField: 'users_id',
      as: 'repliedUsersProfiles',
    },
  },
  {
    $lookup: {
      from: 'userpostcomments',
      localField: 'repliedBy.newFiveUsers.parentCommentId',
      foreignField: '_id',
      as: 'parentComments',
    },
  },
  {
    $lookup: {
      from: 'userpostcomments',
      localField: 'parentComments.replies',
      foreignField: '_id',
      as: 'replyComments',
    },
  },
  {
    $addFields: {
      parentCommentReplies: {
        $map: {
          input: '$parentComments',
          as: 'parent',
          in: {
            parentId: '$$parent._id',
            totalReplies: {
              $size: {
                $setDifference: [
                  {
                    $setUnion: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: '$replyComments',
                              as: 'reply',
                              cond: { $in: ['$$reply._id', '$$parent.replies'] },
                            },
                          },
                          as: 'replyDoc',
                          in: '$$replyDoc.commenterId',
                        },
                      },
                      [],
                    ],
                  },
                  ['$$parent.commenterId'],
                ],
              },
            },
          },
        },
      },
    },
  },
];

export const buildUserNotificationMainProjectStage = (): PipelineStage.Project => ({
  $project: {
    _id: 1,
    createdAt: 1,
    isRead: 1,
    receiverId: 1,
    type: 1,
    message: 1,
    userPostId: 1,
    communityPostId: 1,
    communityPostCommentId: 1,
    status: 1,
    'sender_id._id': '$senderDetails._id',
    'sender_id.firstName': '$senderDetails.firstName',
    'sender_id.lastName': '$senderDetails.lastName',
    'sender_id.profileDp': '$userProfile.profile_dp.imageUrl',
    'communityGroupId._id': '$communityGroupDetails._id',
    'communityGroupId.title': '$communityGroupDetails.title',
    'communityGroupId.communityGroupLogoUrl': '$communityGroupDetails.communityGroupLogoUrl.imageUrl',
    'communityGroupId.communityId': '$communityGroupDetails.communityId',
    'communityDetails.name': '$communityDetails.name',
    'directCommunityDetails._id': 1,
    'directCommunityDetails.name': 1,
    'directCommunityDetails.communityLogoUrl': 1,
    parentCommentReplies: 1,
    communityParentCommentReplies: 1,
    'userPost.likeCount': {
      $size: {
        $filter: {
          input: { $ifNull: ['$userPostDetails.likeCount', []] },
          as: 'like',
          cond: { $ne: ['$$like.userId', { $toString: '$userPostDetails.user_id' }] },
        },
      },
    },
    'communityPost.likeCount': {
      $size: {
        $filter: {
          input: { $ifNull: ['$communityPostDetails.likeCount', []] },
          as: 'like',
          cond: { $ne: ['$$like.userId', { $toString: '$communityPostDetails.user_id' }] },
        },
      },
    },
    'likedBy.totalCount': 1,
    'likedBy.newFiveUsers': {
      $map: {
        input: '$likedBy.newFiveUsers',
        as: 'userId',
        in: {
          _id: '$$userId',
          name: {
            $let: {
              vars: {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$likedUsersDetails',
                        as: 'u',
                        cond: { $eq: ['$$u._id', '$$userId'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $concat: ['$$user.firstName', ' ', '$$user.lastName'] },
            },
          },
          profileDp: {
            $let: {
              vars: {
                profile: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$likedUsersProfiles',
                        as: 'p',
                        cond: { $eq: ['$$p.users_id', '$$userId'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$profile.profile_dp.imageUrl',
            },
          },
        },
      },
    },
    'commentedBy.totalCount': 1,
    'userPost.totalComments': {
      $size: {
        $setUnion: [
          {
            $filter: {
              input: { $ifNull: ['$userPostComments.commenterId', []] },
              as: 'commenter',
              cond: { $ne: ['$$commenter', '$userPostDetails.user_id'] },
            },
          },
          [],
        ],
      },
    },
    'communityPost.totalComments': {
      $size: {
        $setUnion: [
          {
            $filter: {
              input: { $ifNull: ['$communityPostComments.commenterId', []] },
              as: 'commenter',
              cond: { $ne: ['$$commenter', '$communityPostDetails.user_id'] },
            },
          },
          [],
        ],
      },
    },
    'commentedBy.newFiveUsers': {
      $map: {
        input: '$commentedBy.newFiveUsers',
        as: 'userEntry',
        in: {
          _id: '$$userEntry._id',
          communityPostCommentId: '$$userEntry.communityPostCommentId',
          postCommentId: '$$userEntry.postCommentId',
          name: {
            $let: {
              vars: {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$commentedUsersDetails',
                        as: 'u',
                        cond: { $eq: ['$$u._id', '$$userEntry._id'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $concat: ['$$user.firstName', ' ', '$$user.lastName'] },
            },
          },
          profileDp: {
            $let: {
              vars: {
                profile: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$commentedUsersProfiles',
                        as: 'p',
                        cond: { $eq: ['$$p.users_id', '$$userEntry._id'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$profile.profile_dp.imageUrl',
            },
          },
        },
      },
    },
    'repliedBy.newFiveUsers': {
      $map: {
        input: '$repliedBy.newFiveUsers',
        as: 'userEntry',
        in: {
          _id: '$$userEntry._id',
          communityPostCommentId: '$$userEntry.communityPostCommentId',
          postCommentId: '$$userEntry.postCommentId',
          name: {
            $let: {
              vars: {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$repliedUsersDetails',
                        as: 'u',
                        cond: { $eq: ['$$u._id', '$$userEntry._id'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $concat: ['$$user.firstName', ' ', '$$user.lastName'] },
            },
          },
          profileDp: {
            $let: {
              vars: {
                profile: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$repliedUsersProfiles',
                        as: 'p',
                        cond: { $eq: ['$$p.users_id', '$$userEntry._id'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$profile.profile_dp.imageUrl',
            },
          },
        },
      },
    },
  },
});

export const buildUserNotificationSummaryProjectStage = (): PipelineStage.Project => ({
  $project: {
    _id: 1,
    createdAt: 1,
    isRead: 1,
    receiverId: 1,
    type: 1,
    message: 1,
    userPostId: 1,
    'sender_id._id': '$senderDetails._id',
    'sender_id.firstName': '$senderDetails.firstName',
    'sender_id.lastName': '$senderDetails.lastName',
    'sender_id.profileDp': '$userProfile.profile_dp.imageUrl',
  },
});

export const buildReactedToPostWithLikesFilterStage = (): PipelineStage.Match => ({
  $match: {
    $expr: {
      $not: {
        $and: [
          { $eq: ['$type', notificationRoleAccess.REACTED_TO_POST] },
          { $eq: ['$likedBy.totalCount', 0] },
          {
            $or: [
              { $eq: [{ $size: { $ifNull: ['$likedBy.newFiveUsers', []] } }, 0] },
              { $not: ['$likedBy.newFiveUsers'] },
            ],
          },
        ],
      },
    },
  },
});



export const buildDedupePaginatePipeline = ({
  matchStage,
  groupId,
  groupAccumulators,
  skip,
  limit,
  afterDedupeBeforePaginationStages = [],
  afterPaginationStages = [],
}: BuildDedupePaginatePipelineOptions): PipelineStage[] => {
  const defaultAccumulators = { latestNotification: { $first: '$$ROOT' } };

  return [
    matchStage,
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: groupId,
        ...defaultAccumulators,
        ...(groupAccumulators ?? {}),
      },
    },
    { $replaceRoot: { newRoot: '$latestNotification' } },
    ...afterDedupeBeforePaginationStages,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    ...afterPaginationStages,
  ];
};
