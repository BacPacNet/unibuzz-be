import { Schema, model } from 'mongoose';
import { chatInterface } from './chat.interface';

const chatSchema = new Schema<chatInterface>(
  {
    chatName: { type: String, trim: true },
    isGroupChat: { type: Boolean, default: false },
    groupLogo: { imageUrl: String, publicId: String },
    groupDescription: { type: String },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isBlock: { type: Boolean, default: false },
    isRequestAccepted: { type: Boolean, default: false },
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
