import { Schema, model } from 'mongoose';
import { notificationInterface, notificationRole, notificationStatus } from './notification.interface';

const notificationSchema = new Schema<notificationInterface>(
  {
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      //   required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    communityGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'communityGroup',
    },
    communityPostId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPost',
    },
    userPostId: {
      type: Schema.Types.ObjectId,
      ref: 'userPost',
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'userPostComments',
    },
    parentCommunityCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'communityPostComments',
    },

    type: { type: String, enum: notificationRole, required: true },

    message: { type: String, required: true },
    isRead: {
      type: Boolean,
      default: false,
    },
    likedBy: {
      totalCount: { type: Number },
      newFiveUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
    commentedBy: {
      totalCount: { type: Number },
      newFiveUsers: [
        {
          _id: { type: Schema.Types.ObjectId, ref: 'User' },
          communityPostCommentId: {
            type: Schema.Types.ObjectId,
            ref: 'communityPostComments',
          },
          postCommentId: {
            type: Schema.Types.ObjectId,
            ref: 'userPostComments',
          },
        },
      ],
    },
    repliedBy: {
      newFiveUsers: [
        {
          _id: { type: Schema.Types.ObjectId, ref: 'User' },
          communityPostParentCommentId: {
            type: Schema.Types.ObjectId,
            ref: 'communityPostComments',
          },
          parentCommentId: {
            type: Schema.Types.ObjectId,
            ref: 'userPostComments',
          },
        },
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'rejected', 'accepted', 'default'],
      default: notificationStatus.default,
    },
    createdAt: { type: Date, immutable: false },
  },
  { timestamps: true }
);

const notificationModel = model<notificationInterface>('notification', notificationSchema);

export default notificationModel;
