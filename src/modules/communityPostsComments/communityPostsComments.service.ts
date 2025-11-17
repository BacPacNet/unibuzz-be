import mongoose from 'mongoose';
import communityPostCommentModel from './communityPostsComments.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { convertToObjectId } from '../../utils/common';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import { UserProfile } from '../userProfile';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';

export const createCommunityComment = async (userID: string, communityPostId: string, body: any) => {
  const { commenterProfileId, adminId } = body;

  const comment = await communityPostCommentModel.create({
    ...body,
    postId: convertToObjectId(communityPostId),
    commenterId: convertToObjectId(userID),
    commenterProfileId: convertToObjectId(commenterProfileId),
    level: 0,
  });

  const communityDetail = await CommunityPostModel.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(communityPostId) },
    },
    {
      $lookup: {
        from: 'communities',
        localField: 'communityId',
        foreignField: '_id',
        as: 'community',
      },
    },
    {
      $lookup: {
        from: 'communitygroups',
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
      },
    },
  ]);

  const { communityName, communityGroupTitle } = communityDetail[0];

  if (userID !== adminId) {
    const message = communityGroupTitle
      ? `commented on your community post in ${communityName} at ${communityGroupTitle}`
      : `commented on your community post in ${communityName}`;

    const notification = {
      sender_id: userID,
      receiverId: adminId,
      communityPostId,
      communityPostCommentId: comment._id,
      type: notificationRoleAccess.COMMUNITY_COMMENT,
      message,
    };

    await queueSQSNotification(notification);
  }

  const [result] = await communityPostCommentModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(comment._id),
      },
    },

    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenterId',
      },
    },
    { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenterProfileId',
        foreignField: '_id',
        as: 'commenterProfileId',
      },
    },
    { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
                    $in: [new mongoose.Types.ObjectId(userID), { $ifNull: ['$$populated.adminId', []] }],
                  },
                },
              },
            },
          },
        },
      },
    },
    { $project: { 'commenterProfileId.communitiesData': 0 } },

    {
      $lookup: {
        from: 'communitypostcomments',
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        pipeline: [
          { $sort: { createdAt: -1 } },
          {
            $lookup: {
              from: 'users',
              localField: 'commenterId',
              foreignField: '_id',
              as: 'commenterId',
            },
          },
          { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'userprofiles',
              localField: 'commenterProfileId',
              foreignField: '_id',
              as: 'commenterProfileId',
            },
          },
          { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },
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
                          $in: [new mongoose.Types.ObjectId(userID), { $ifNull: ['$$populated.adminId', []] }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          { $project: { 'commenterProfileId.communitiesData': 0 } },
        ],
      },
    },
  ]);

  return result || null;
};

export const updateCommunityPostComment = async (id: mongoose.Types.ObjectId, comment: any) => {
  let communityPostCommentToUpadate;

  communityPostCommentToUpadate = await communityPostCommentModel.findById(id);

  if (!communityPostCommentToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(communityPostCommentToUpadate, {
    content: comment.content,
    imageUrl: comment.imageurl,
  });
  await communityPostCommentToUpadate.save();
  return communityPostCommentToUpadate;
};

export const deleteCommunityPostComment = async (id: mongoose.Types.ObjectId) => {
  try {
    const deletedComment = await communityPostCommentModel.findByIdAndDelete(id);
    return deletedComment;
  } catch (error) {
    throw new Error(`Failed to delete community post comment: ${error}`);
  }
};

export const getAllCommunityPostComment = async (commentPostId: string) => {
  return await communityPostCommentModel.find({ communityId: commentPostId });
};

export const likeUnlikeComment = async (id: string, userId: string) => {
  const comment = await communityPostCommentModel.findById(id);

  if (!comment?.likeCount.some((x) => x.userId === userId)) {
    return await comment?.updateOne({ $push: { likeCount: { userId } } });
  } else {
    return await comment.updateOne({ $pull: { likeCount: { userId } } });
  }
};

export const getCommunityPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = 2,
  sortOrder: 'asc' | 'desc' = 'desc'
) => {
  const skip = (page - 1) * limit;
  const mainSortOrder = sortOrder === 'asc' ? 1 : -1;

  const comments = await communityPostCommentModel.aggregate([
    {
      $match: {
        postId: new mongoose.Types.ObjectId(postId),
        level: 0,
      },
    },
    { $sort: { createdAt: mainSortOrder } },
    { $skip: skip },
    { $limit: limit },

    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenterId',
      },
    },
    { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenterProfileId',
        foreignField: '_id',
        as: 'commenterProfileId',
      },
    },
    { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
                                  $and: [{ $eq: ['$$usr._id', '$commenterId._id'] }, { $eq: ['$$usr.isVerified', true] }],
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

    {
      $lookup: {
        from: 'communitypostcomments',
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        pipeline: [
          { $sort: { createdAt: -1 } },

          {
            $lookup: {
              from: 'users',
              localField: 'commenterId',
              foreignField: '_id',
              as: 'commenterId',
            },
          },
          { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

          {
            $lookup: {
              from: 'userprofiles',
              localField: 'commenterProfileId',
              foreignField: '_id',
              as: 'commenterProfileId',
            },
          },
          { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
        ],
      },
    },
  ]);

  const totalComments = await communityPostCommentModel.countDocuments({ postId });
  const totalTopLevelComments = await communityPostCommentModel.countDocuments({
    postId,
    level: 0,
  });
  const totalPages = Math.ceil(totalTopLevelComments / limit);

  return {
    finalComments: comments,
    currentPage: page,
    totalPages,
    totalComments,
  };
};

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
    replies: any[] = [],
    depth: number = 1,
    maxDepth: number = 3
  ): Promise<{ populatedReplies: any[]; totalCount: number }> => {
    if (!replies || replies.length === 0 || depth > maxDepth + 1) {
      return { populatedReplies: [], totalCount: 0 };
    }

    const populatedReplies = await Promise.all(
      replies.map(async (reply: any) => {
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
    commentArray.map(async (comment: any) => {
      const { populatedReplies, totalCount } = await populateNestedReplies(comment.replies, 1, 3);
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

export const commentReply = async (commentId: string, userID: string, body: any, level: number) => {
  const { postID: communityPostId } = body;

  const communityDetail = await CommunityPostModel.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(communityPostId) },
    },
    {
      $lookup: {
        from: 'communities',
        localField: 'communityId',
        foreignField: '_id',
        as: 'community',
      },
    },
    {
      $lookup: {
        from: 'communitygroups',
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
        communityGroupID: { $arrayElemAt: ['$communityGroup._id', 0] },
        communityAdminId: { $arrayElemAt: ['$community.adminId', 0] },
      },
    },
  ]);

  const { communityId, communityGroupTitle, communityName, communityGroupID } = communityDetail[0];

  const userProfile = await UserProfile.findOne({ users_id: userID }).select('email');
  let isCommentVerified = false;

  if (userProfile) {
    const verifiedCommunities = userProfile.email?.map((c) => c.communityId.toString()) || [];
    isCommentVerified = verifiedCommunities.includes(communityId.toString());
  }

  const newReply = {
    communityId: communityGroupID,
    commenterId: userID,
    postId: convertToObjectId(communityPostId),
    isCommentVerified,
    level: level + 1,
    ...body,
  };

  const savedReply = await communityPostCommentModel.create(newReply);

  const parentComment = await communityPostCommentModel.findById(commentId);
  if (parentComment && userID.toString() !== parentComment.commenterId.toString()) {
    const message = communityGroupTitle
      ? `commented on your community post in ${communityName} at ${communityGroupTitle}`
      : `commented on your community post in ${communityName}`;

    const notification = {
      sender_id: userID,
      receiverId: parentComment.commenterId.toString(),
      parentCommentId: commentId,
      communityPostId,
      communityPostCommentId: commentId,
      type: notificationRoleAccess.REPLIED_TO_COMMUNITY_COMMENT,
      message,
    };

    await queueSQSNotification(notification);
  }

  await communityPostCommentModel.findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } });

  const [aggregatedParent] = await communityPostCommentModel.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(commentId) } },

    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenterId',
      },
    },
    { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenterProfileId',
        foreignField: '_id',
        as: 'commenterProfileId',
      },
    },
    { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
                  verifiedCommunities: {
                    $map: {
                      input: { $ifNull: ['$commenterProfileId.email', []] },
                      as: 'e',
                      in: { $toString: '$$e.communityId' },
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
                    $in: [new mongoose.Types.ObjectId(userID), { $ifNull: ['$$populated.adminId', []] }],
                  },
                },
              },
            },
          },
        },
      },
    },
    { $project: { 'commenterProfileId.communitiesData': 0 } },

    {
      $lookup: {
        from: 'communitypostcomments',
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        pipeline: [
          { $sort: { createdAt: -1 } },

          {
            $lookup: {
              from: 'users',
              localField: 'commenterId',
              foreignField: '_id',
              as: 'commenterId',
            },
          },
          { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'userprofiles',
              localField: 'commenterProfileId',
              foreignField: '_id',
              as: 'commenterProfileId',
            },
          },
          { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },
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
                        verifiedCommunities: {
                          $map: {
                            input: { $ifNull: ['$commenterProfileId.email', []] },
                            as: 'e',
                            in: { $toString: '$$e.communityId' },
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
                          $in: [new mongoose.Types.ObjectId(userID), { $ifNull: ['$$populated.adminId', []] }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          { $project: { 'commenterProfileId.communitiesData': 0 } },
        ],
      },
    },
  ]);

  return aggregatedParent || null;
};

export const getSingleCommunityCommentByCommentId = async (commentId: string) => {
  const result = await communityPostCommentModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(commentId),
      },
    },

    {
      $lookup: {
        from: 'users',
        localField: 'commenterId',
        foreignField: '_id',
        as: 'commenterId',
      },
    },
    { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: 'userprofiles',
        localField: 'commenterProfileId',
        foreignField: '_id',
        as: 'commenterProfileId',
      },
    },
    { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
                                  $and: [{ $eq: ['$$usr._id', '$commenterId._id'] }, { $eq: ['$$usr.isVerified', true] }],
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

    {
      $lookup: {
        from: 'communitypostcomments',
        localField: 'replies',
        foreignField: '_id',
        as: 'replies',
        pipeline: [
          { $sort: { createdAt: -1 } },

          {
            $lookup: {
              from: 'users',
              localField: 'commenterId',
              foreignField: '_id',
              as: 'commenterId',
            },
          },
          { $unwind: { path: '$commenterId', preserveNullAndEmptyArrays: true } },

          {
            $lookup: {
              from: 'userprofiles',
              localField: 'commenterProfileId',
              foreignField: '_id',
              as: 'commenterProfileId',
            },
          },
          { $unwind: { path: '$commenterProfileId', preserveNullAndEmptyArrays: true } },

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
        ],
      },
    },
  ]);

  return result[0] || null;
};
