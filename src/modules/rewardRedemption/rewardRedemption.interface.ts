import { Schema } from 'mongoose';

export type RewardRedemptionStatus = 'pending' | 'completed';

export interface IRewardRedemption {
  userId: Schema.Types.ObjectId;
  awsEmail: string;
  /**
   * Month the reward corresponds to, normalized to the first day of the month in UTC.
   */
  rewardMonth: Date;
  status: RewardRedemptionStatus;
  amount: number;
}

