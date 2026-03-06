import { Schema, model } from 'mongoose';
import { IRewardRedemption } from './rewardRedemption.interface';

const rewardRedemptionSchema = new Schema<IRewardRedemption>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    awsEmail: {
      type: String,
      required: true,
      trim: true,
    },
    rewardMonth: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      required: true,
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

const RewardRedemptionModel = model<IRewardRedemption>(
  'rewardRedemption',
  rewardRedemptionSchema
);

export default RewardRedemptionModel;

