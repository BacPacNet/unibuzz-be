import { Schema, model } from 'mongoose';
import { chatInterface } from './chat.interface';

const chatSchema = new Schema<chatInterface>(
  {
    chatName: { type: String, trim: true },
    isGroupChat: { type: Boolean, default: false },
    groupLogo: { imageUrl: String, publicId: String },
    groupDescription: { type: String },
    users: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        isRequestAccepted: { type: Boolean, default: null },
        isStarred: { type: Boolean, default: false },
      },
    ],
    isBlock: { type: Boolean, default: false },
    blockedBy:[Schema.Types.ObjectId],
    isRequestAccepted: { type: Boolean, default: false || null },
    latestMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    groupAdmin: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const chatModel = model<chatInterface>('Chat', chatSchema);

export default chatModel;
