import { Document, Schema } from 'mongoose';

export enum ContentType {
  USER_POST = 'USER_POST',
  COMMUNITY_POST = 'COMMUNITY_POST',
  COMMUNITY_GROUP_POST = 'COMMUNITY_GROUP_POST',
  USER_COMMENT = 'USER_COMMENT',
  COMMUNITY_COMMENT = 'COMMUNITY_COMMENT',
  COMMUNITY_GROUP_COMMENT = 'COMMUNITY_GROUP_COMMENT',
  USER_REPLY = 'USER_REPLY',
  COMMUNITY_REPLY = 'COMMUNITY_REPLY',
  COMMUNITY_GROUP_REPLY = 'COMMUNITY_GROUP_REPLY',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export interface IReportContent extends Document {
  reporterId: Schema.Types.ObjectId;
  userPostId?: Schema.Types.ObjectId;
  communityPostId?: Schema.Types.ObjectId;
  userPostCommentId?: Schema.Types.ObjectId;
  userPostReplyId?: Schema.Types.ObjectId;
  communityPostCommentId?: Schema.Types.ObjectId;
  communityPostReplyId?: Schema.Types.ObjectId;
  contentType: ContentType;
  description: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportContentDTO {
  reporterId: string;
  contentType: ContentType;
  description: string;
  userPostId?: string;
  communityPostId?: string;
  userPostCommentId?: string;
  userPostReplyId?: string;
  communityPostCommentId?: string;
  communityPostReplyId?: string;
}

export interface SendReportContentEmailDTO {
  reporterId: string;
  contentType: ContentType;
  description: string;
  status: ReportStatus;
  userPostId?: string;
  communityPostId?: string;
  userPostCommentId?: string;
  userPostReplyId?: string;
  communityPostCommentId?: string;
  communityPostReplyId?: string;
}
