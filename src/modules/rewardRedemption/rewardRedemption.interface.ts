import { Schema } from 'mongoose';

export enum RewardRedemptionStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export const REWARD_REDEMPTION_STATUS_VALUES = Object.values(RewardRedemptionStatus);

export interface IRewardRedemption {
  userId: Schema.Types.ObjectId;
  upiId?: string;
  /**
   * Month the reward corresponds to, normalized to the first day of the month in UTC.
   */
  rewardMonth: Date;
  status: RewardRedemptionStatus;
  amount: number;
  totalInvites: number;
  leftoverInvites: number;
}
