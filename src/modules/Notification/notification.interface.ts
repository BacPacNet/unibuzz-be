import mongoose from 'mongoose';

export const notificationRoleAccess = {
  GROUP_INVITE: 'GROUP_INVITE',
  FOLLOW: 'FOLLOW',
  COMMENT: 'COMMENT',
  COMMUNITY_COMMENT: 'COMMUNITY_COMMENT',
  REACTED_TO_POST: 'REACTED_TO_POST',
  REACTED_TO_COMMUNITY_POST: 'REACTED_TO_COMMUNITY_POST',
  OFFICIAL_GROUP_REQUEST: 'OFFICIAL_GROUP_REQUEST',
};

export enum notificationStatus {
  pending = 'pending',
  rejected = 'rejected',
  accepted = 'accepted',
  default = 'default',
}

export const notificationRole = Object.keys(notificationRoleAccess);

interface notificationInterface {
  sender_id: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  communityGroupId: mongoose.Types.ObjectId;
  communityPostId: mongoose.Types.ObjectId;
  userPostId: mongoose.Types.ObjectId;
  message: string;
  type: string;
  isRead: boolean;
  status: notificationStatus;
}

export { notificationInterface };
