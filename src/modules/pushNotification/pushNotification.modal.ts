import { model, Schema } from 'mongoose';
import { pushNotificationInterface } from './pushNotification.interface';

const pushNotificationSchema = new Schema<pushNotificationInterface>(
  {
    user_Id: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const pushNotificationModal = model<pushNotificationInterface>('pushNotification', pushNotificationSchema);

export default pushNotificationModal;
