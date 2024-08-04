import { Schema, model } from 'mongoose';
import { messageInterface } from './message.interface';

const messageSchema = new Schema<messageInterface>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    senderProfile: { type: Schema.Types.ObjectId, ref: 'UserProfile' },
    content: { type: String, trim: true },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
    readByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    media: [{ imageUrl: String, publicId: String }],
  },
  { timestamps: true }
);

const messageModel = model<messageInterface>('Message', messageSchema);

export default messageModel;
