import { Schema, model } from 'mongoose';
import { IReportContent, ContentType, ReportStatus } from './reportContent.interface';

const ReportContentSchema = new Schema<IReportContent>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userPostId: {
      type: Schema.Types.ObjectId,
      ref: 'UserPost',
    },
    communityPostId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPost',
    },
    userPostCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'UserPostComments',
    },
    userPostReplyId: {
      type: Schema.Types.ObjectId,
      ref: 'UserPostReplies',
    },
    communityPostCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPostComments',
    },
    communityPostReplyId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPostReplies',
    },
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
    },

    description: {
      type: String,
      maxlength: 480,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
    },
  },
  {
    timestamps: true,
  }
);

const ReportContentModel = model<IReportContent>('ReportContent', ReportContentSchema);

export default ReportContentModel;
