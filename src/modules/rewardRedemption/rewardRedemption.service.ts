import mongoose from 'mongoose';
import RewardRedemptionModel from './rewardRedemption.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

/**
 * Normalize a date to the first day of that month in UTC.
 */
export const getMonthStartUTC = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

export const markRewardPendingForMonth = async (
  userId: mongoose.Types.ObjectId,
  awsEmail: string,
  rewardMonth: Date,
  amount: number
) => {
  const monthStart = getMonthStartUTC(rewardMonth);

  const existing = await RewardRedemptionModel.findOne({
    userId,
    rewardMonth: monthStart
  });

  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Reward already pending for previous month');
  }

  const doc = await RewardRedemptionModel.create({
    userId,
    awsEmail,
    rewardMonth: monthStart,
    amount,
    status: "pending"
  });

  return doc;
};



export const hasRedeemedRewardForMonth = async (
  userId: mongoose.Types.ObjectId,
  rewardMonth: Date
): Promise<boolean> => {
  const monthStart = getMonthStartUTC(rewardMonth);
  const exists = await RewardRedemptionModel.exists({
    userId,
    rewardMonth: monthStart,
  });
  return !!exists;
};

