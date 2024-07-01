import { Schema, model } from 'mongoose';
import { notificationInterface } from './notification.interface';

const notificationSchema = new Schema<notificationInterface>(
  {
    adminId: {
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
      required: true,
    },
    isSeen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const notificationModel = model<notificationInterface>('notification', notificationSchema);

export default notificationModel;
