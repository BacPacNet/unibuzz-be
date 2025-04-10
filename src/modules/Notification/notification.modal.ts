import { Schema, model } from 'mongoose';
import { notificationInterface, notificationRole, notificationStatus } from './notification.interface';

const notificationSchema = new Schema<notificationInterface>(
  {
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    type: { type: String, enum: notificationRole, required: true },
    message: { type: String, required: true },
    isRead: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'rejected', 'accepted', 'default'],
      default: notificationStatus.default,
    },
  },
  { timestamps: true }
);

const notificationModel = model<notificationInterface>('notification', notificationSchema);

export default notificationModel;
