import mongoose from 'mongoose';

export const notificationRoleAccess = {
  GROUP_INVITE: 'GROUP_INVITE',
  REPLY: 'REPLY',
  FOLLOW: 'FOLLOW',
  ASSIGN: 'ASSIGN',
  COMMENT: 'COMMENT',
};

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
}

export { notificationInterface };
