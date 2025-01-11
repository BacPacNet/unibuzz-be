import mongoose, { Schema, Document, model } from 'mongoose';

export interface IEndorse extends Document {
  userId: mongoose.Types.ObjectId;
  totalGoal: number;
  numberOfUsersEndorsed: number;
  communityId: mongoose.Types.ObjectId;
  percentage: number;
}

const EndorseSchema: Schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    totalGoal: { type: Number, required: false, default: 100 },
    communityId: { type: Schema.Types.ObjectId, required: true, ref: 'Community' },
  },
  { timestamps: true }
);

const EndorseAIModel = model<IEndorse>('Endorse', EndorseSchema);

export default EndorseAIModel;
