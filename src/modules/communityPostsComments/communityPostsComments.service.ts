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
        _id: 0,
        communityId: 1,
        communityName: { $arrayElemAt: ['$community.name', 0] },
        communityGroupTitle: { $arrayElemAt: ['$communityGroup.title', 0] },
      },
    },
  ]);

  const { communityName, communityGroupTitle, communityId } = communityDetail[0];

  const getUserProfile = await UserProfile.findOne({ users_id: userID }).select('email');

  let isCommentVerified: boolean = false;

  if (getUserProfile) {
    const email = getUserProfile.email;
    isCommentVerified = email.some((community) => community.communityId.toString() === communityId.toString());
  }

  const comment = await communityPostCommentModel.create({
    ...body,
    postId: convertToObjectId(communityPostId),
    commenterId: convertToObjectId(userID),
    commenterProfileId: convertToObjectId(commenterProfileId),
    isCommentVerified,
    level: 0,
  });

  if (userID !== adminId) {
    const message = communityGroupTitle
      ? `commented on your community post in ${communityName} at ${communityGroupTitle}`
      : `commented on your community post in ${communityName}`;
    // await notificationQueue.add(NotificationIdentifier.community_post_comment_notification, {
    //   sender_id: userID,
    //   receiverId: adminId,
    //   communityPostId,
    //   communityPostCommentId: comment._id,
    //   type: notificationRoleAccess.COMMUNITY_COMMENT,
    //   message
    // });

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

  await comment.populate([
    { path: 'commenterId', select: 'firstName lastName _id' },
    {
      path: 'commenterProfileId',
      select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
    },
    {
      path: 'replies',
      options: { sort: { createdAt: -1 } },
      populate: [
        { path: 'commenterId', select: 'firstName lastName _id' },
        {
          path: 'commenterProfileId',
          select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
        },
      ],
    },
    { path: 'postId', select: 'user_id' },
  ]);

  return comment;
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
  // Fetch the main comments on the post
  const comments =
    (await communityPostCommentModel
      .find({ postId: postId, level: 0 })
      .populate([
        { path: 'commenterId', select: 'firstName lastName _id' },
        {
          path: 'commenterProfileId',
          select: 'profile_dp university_name study_year degree major affiliation occupation isCommunityAdmin',
        },
        {
          path: 'replies',
          options: { sort: { createdAt: -1 } },
          populate: [
            { path: 'commenterId', select: 'firstName lastName _id' },
            {
              path: 'commenterProfileId',
              select: 'profile_dp university_name study_year degree major affiliation occupation isCommunityAdmin',
            },
          ],
        },
      ])
      .sort({ createdAt: mainSortOrder })
      .skip(skip)
      .limit(limit)
      .lean()) || [];

  // Helper function to recursively populate replies and calculate total count
  const populateNestedReplies = async (replies: any[] = []): Promise<{ populatedReplies: any[]; totalCount: number }> => {
    if (!replies || replies.length === 0) return { populatedReplies: [], totalCount: 0 };

    // Fetch replies by IDs, sorted by createdAt ascending (oldest first)
    const replyIds = replies.map((r) => r._id); // in case you get replies as populated subdocs, else use reply.replies
    const fetchedReplies = await communityPostCommentModel
      .find({ _id: { $in: replyIds } })
      .populate([
        { path: 'commenterId', select: 'firstName lastName _id' },
        { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree isCommunityAdmin' },
      ])
      .sort({ createdAt: 1 })
      .lean();

    // Recursively populate nested replies for each fetched reply
    const populatedReplies = await Promise.all(
      fetchedReplies.map(async (reply: any) => {
        const { populatedReplies: nestedReplies, totalCount: nestedCount } = await populateNestedReplies(
          reply.replies || []
        );
        return {
          ...reply,
          replies: nestedReplies,
          totalCount: nestedCount,
        };
      })
    );

    // Finally, sort them again by createdAt (just in case)
    populatedReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      populatedReplies,
      totalCount: populatedReplies.length,
    };
  };

  // Populate the nested replies for each comment and calculate the total count
  const finalComments = await Promise.all(
    comments.map(async (comment: any) => {
      const { populatedReplies, totalCount } = await populateNestedReplies(comment.replies);
      return {
        ...comment,
        replies: populatedReplies,
        totalCount: totalCount, // Include immediate replies
      };
    })
  );

  const totalComments = await communityPostCommentModel.countDocuments({ postId: postId });

  const totalPages = Math.ceil(totalComments / limit);

  return {
    finalComments,
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
      { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree isCommunityAdmin' },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree isCommunityAdmin' },
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
            { path: 'commenterProfileId', select: 'profile_dp university_name study_year degree isCommunityAdmin' },
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
        _id: 0,
        communityId: 1,
        communityName: { $arrayElemAt: ['$community.name', 0] },
        communityGroupTitle: { $arrayElemAt: ['$communityGroup.title', 0] },
        communityGroupID: { $arrayElemAt: ['$communityGroup._id', 0] },
      },
    },
  ]);

  const { communityId, communityGroupTitle, communityName, communityGroupID } = communityDetail[0];

  const getUserProfile = await UserProfile.findOne({ users_id: userID }).select('email');

  let isCommentVerified: boolean = false;

  if (getUserProfile) {
    const email = getUserProfile.email;
    isCommentVerified = email.some((community) => community.communityId.toString() === communityId.toString());
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

  const adminDetails = await communityPostCommentModel.findOne({ _id: commentId });
  if (userID.toString() !== adminDetails?.commenterId.toString()) {
    const message = communityGroupTitle
      ? `commented on your community post in ${communityName} at ${communityGroupTitle}`
      : `commented on your community post in ${communityName}`;

    const notification = {
      sender_id: userID,
      receiverId: adminDetails?.commenterId.toString(),
      parentCommentId: commentId,
      communityPostId,
      communityPostCommentId: commentId,
      type: notificationRoleAccess.REPLIED_TO_COMMUNITY_COMMENT,
      message,
    };

    await queueSQSNotification(notification);
  }

  const parentComment = await communityPostCommentModel
    .findByIdAndUpdate(commentId, { $push: { replies: savedReply._id } }, { new: true })
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
      },
      {
        path: 'replies',
        options: { sort: { createdAt: -1 } },
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year degree major affiliation occupation role isCommunityAdmin',
          },
        ],
      },
    ])
    .lean();

  return parentComment;
};

export const getSingleCommunityCommentByCommentId = async (commentId: string) => {
  const comment = await communityPostCommentModel
    .findById(new mongoose.Types.ObjectId(commentId))
    .populate([
      { path: 'commenterId', select: 'firstName lastName _id' },
      {
        path: 'commenterProfileId',
        select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
      },
      {
        path: 'replies',
        populate: [
          { path: 'commenterId', select: 'firstName lastName _id' },
          {
            path: 'commenterProfileId',
            select: 'profile_dp university_name study_year affiliation occupation degree role isCommunityAdmin',
          },
        ],
      },
    ])
    .lean();

  return comment;
};
