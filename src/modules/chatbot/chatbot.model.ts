import { Schema, model } from 'mongoose';
//import { communityInterface } from './community.interface';

const chatbotSchema = new Schema<any>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'community',
      required: true,
    },
    collegeID: { type: Schema.Types.ObjectId, ref: 'colleges', required: true },
    prompt: { type: String, required: true },
    threadId: { type: String, required: true },
    response: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const chatbotModel = model<any>('chatbot', chatbotSchema);

export default chatbotModel;
