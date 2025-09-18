import mongoose from 'mongoose';

export const notificationRoleAccess = {
  GROUP_INVITE: 'GROUP_INVITE',
  FOLLOW: 'FOLLOW',
  COMMENT: 'COMMENT',
  COMMUNITY_COMMENT: 'COMMUNITY_COMMENT',
  REACTED_TO_POST: 'REACTED_TO_POST',
  REACTED_TO_COMMUNITY_POST: 'REACTED_TO_COMMUNITY_POST',
  REPLIED_TO_COMMENT: 'REPLIED_TO_COMMENT',
  REPLIED_TO_COMMUNITY_COMMENT: 'REPLIED_TO_COMMUNITY_COMMENT',
  OFFICIAL_GROUP_REQUEST: 'OFFICIAL_GROUP_REQUEST',
  REJECTED_OFFICIAL_GROUP_REQUEST: 'REJECTED_OFFICIAL_GROUP_REQUEST',
  ACCEPTED_OFFICIAL_GROUP_REQUEST: 'ACCEPTED_OFFICIAL_GROUP_REQUEST',
  PRIVATE_GROUP_REQUEST: 'PRIVATE_GROUP_REQUEST',
  ACCEPTED_PRIVATE_GROUP_REQUEST: 'ACCEPTED_PRIVATE_GROUP_REQUEST',
  REJECTED_PRIVATE_GROUP_REQUEST: 'REJECTED_PRIVATE_GROUP_REQUEST',
  DELETED_COMMUNITY_GROUP: 'DELETED_COMMUNITY_GROUP',

  community_post_live_request_notification: 'community_post_live_request_notification',
  community_post_rejected_notification: 'community_post_rejected_notification',
  community_post_accepted_notification: 'community_post_accepted_notification',
};

export enum notificationStatus {
  pending = 'pending',
  rejected = 'rejected',
  accepted = 'accepted',
  default = 'default',
}

export const notificationRole = Object.keys(notificationRoleAccess);

interface likedBy {
  totalCount: number;
  newFiveUsers: mongoose.Types.ObjectId[];
}

interface CommentedUser {
  _id: mongoose.Types.ObjectId;
  communityPostCommentId?: mongoose.Types.ObjectId;
  postCommentId?: mongoose.Types.ObjectId;
}

interface CommentedBy {
  totalCount: number;
  newFiveUsers: CommentedUser[];
}

interface notificationInterface {
  sender_id: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  communityGroupId: mongoose.Types.ObjectId;
  communityPostId: mongoose.Types.ObjectId;
  userPostId: mongoose.Types.ObjectId;
  postCommentId: mongoose.Types.ObjectId;
  communityPostCommentId: mongoose.Types.ObjectId;
  message: string;
  type: string;
  isRead: boolean;
  status: notificationStatus;
  likedBy: likedBy;
  //   commentedBy: likedBy;
  commentedBy?: CommentedBy;
  repliedBy?: CommentedBy;
  createdAt?: Date;
  updatedAt?: Date;
}

export { notificationInterface };
