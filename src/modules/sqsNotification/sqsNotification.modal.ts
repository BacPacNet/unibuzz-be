import mongoose from 'mongoose';

const sqsNotificationSchema = new mongoose.Schema(
  {
    sender_id: { type: String, required: true },
    receiverId: { type: String, required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const SQSNotificationModel = mongoose.model('sqsNotification', sqsNotificationSchema);

export default SQSNotificationModel;
