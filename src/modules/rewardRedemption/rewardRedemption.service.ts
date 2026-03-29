import mongoose from 'mongoose';
import RewardRedemptionModel from './rewardRedemption.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { RewardRedemptionStatus } from './rewardRedemption.interface';
import { buildPaginationResponse, getPaginationSkip } from '../../utils/common';

/**
 * Normalize a date to the first day of that month in UTC.
 */
export const getMonthStartUTC = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const getNextMonthStartUTC = (monthStart: Date): Date => {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
};

type UpsertRewardRedemptionParams = {
  userId: mongoose.Types.ObjectId;
  rewardMonth: Date;
  amount: number;
  totalInvites: number;
  leftoverInvites: number;
  status: RewardRedemptionStatus;
  upiId?: string;
};

/**
 * Upsert a reward redemption row for a month (useful for testing/backfills).
 * Note: `rewardMonth` is normalized to month start in UTC.
 */
export const upsertRewardRedemptionForMonth = async ({
  userId,
  rewardMonth,
  amount,
  totalInvites,
  leftoverInvites,
  status,
  upiId,
}: UpsertRewardRedemptionParams) => {
  const monthStart = getMonthStartUTC(rewardMonth);
  const nextMonthStart = getNextMonthStartUTC(monthStart);

  const doc = await RewardRedemptionModel.findOneAndUpdate(
    {
      userId,
      rewardMonth: {
        $gte: monthStart,
        $lt: nextMonthStart,
      },
    },
    {
      $set: {
        rewardMonth: monthStart,
        upiId,
        amount,
        totalInvites,
        leftoverInvites,
        status,
      },
    },
    { new: true, upsert: true }
  );

  if (!doc) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Unable to upsert reward redemption');
  }

  return doc;
};



export const getRewardRedemptionForMonth = async (
  userId: mongoose.Types.ObjectId,
  rewardMonth: Date
) => {
  const monthStart = getMonthStartUTC(rewardMonth);
  const nextMonthStart = getNextMonthStartUTC(monthStart);
  return RewardRedemptionModel.findOne({
    userId,
    rewardMonth: {
      $gte: monthStart,
      $lt: nextMonthStart,
    },
  }).lean();
};

export const getLatestRewardRedemptionBeforeMonth = async (
  userId: mongoose.Types.ObjectId,
  beforeMonth: Date
) => {
  const monthStart = getMonthStartUTC(beforeMonth);
  return RewardRedemptionModel.findOne({
    userId,
    rewardMonth: { $lt: monthStart },
  })
    .sort({ rewardMonth: -1 })
    .lean();
};

/** Most recent redemption row for the user (any month), by rewardMonth. */
export const getLatestRewardRedemption = async (userId: mongoose.Types.ObjectId) => {
  return RewardRedemptionModel.findOne({ userId }).sort({ rewardMonth: -1 }).lean();
};

export const updateLatestRewardRedemptionUpiId = async (
  userId: mongoose.Types.ObjectId,
  upiId: string
) => {
  const updated = await RewardRedemptionModel.findOneAndUpdate(
    { userId },
    { $set: { upiId: upiId.trim() } },
    {
      sort: { rewardMonth: -1, createdAt: -1 },
      new: true,
    }
  );

  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No reward redemption document found for user');
  }

  return updated;
};

export const updatePendingRewardRedemptionTotals = async (
  redemptionId: mongoose.Types.ObjectId,
  amount: number,
  totalInvites: number,
  leftoverInvites: number
) => {
  return RewardRedemptionModel.updateOne(
    { _id: redemptionId, status: RewardRedemptionStatus.Pending },
    { $set: { amount, totalInvites, leftoverInvites } }
  );
};

export const markRewardRedemptionCompleted = async (
  redemptionId: mongoose.Types.ObjectId
) => {
  const updated = await RewardRedemptionModel.findOneAndUpdate(
    { _id: redemptionId, status: RewardRedemptionStatus.Pending },
    { $set: { status: RewardRedemptionStatus.Completed } },
    { new: true }
  );

  if (!updated) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Reward redemption not found in pending status'
    );
  }

  return updated;
};

export const getAllRewardRedemptions = async (
  page: number,
  limit: number,
  status?: RewardRedemptionStatus
) => {
  const filter = status ? { status } : {};
  const skip = getPaginationSkip(page, limit);

  const [docs, total] = await Promise.all([
    RewardRedemptionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RewardRedemptionModel.countDocuments(filter),
  ]);

  return {
    ...buildPaginationResponse(total, page, limit),
    docs,
  };
};



export const hasRedeemedRewardForMonth = async (
  userId: mongoose.Types.ObjectId,
  rewardMonth: Date
): Promise<boolean> => {
  const monthStart = getMonthStartUTC(rewardMonth);
  const nextMonthStart = getNextMonthStartUTC(monthStart);
  const exists = await RewardRedemptionModel.exists({
    userId,
    rewardMonth: {
      $gte: monthStart,
      $lt: nextMonthStart,
    },
    amount: { $gt: 0 },
  });
  return !!exists;
};

