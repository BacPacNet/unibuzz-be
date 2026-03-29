import { Schema, model } from 'mongoose';
import {
  IRewardRedemption,
  RewardRedemptionStatus,
  REWARD_REDEMPTION_STATUS_VALUES,
} from './rewardRedemption.interface';

const rewardRedemptionSchema = new Schema<IRewardRedemption>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    upiId: {
      type: String,
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
    totalInvites: {
      type: Number,
      required: true,
      min: 0,
    },
    leftoverInvites: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: REWARD_REDEMPTION_STATUS_VALUES,
      required: true,
      default: RewardRedemptionStatus.Pending,
      index: true,
    },
  },
  { timestamps: true }
);

rewardRedemptionSchema.index({ userId: 1, rewardMonth: 1 }, { unique: true });

const RewardRedemptionModel = model<IRewardRedemption>(
  'rewardRedemption',
  rewardRedemptionSchema
);

export default RewardRedemptionModel;

