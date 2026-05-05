import mongoose from 'mongoose';
import RewardRedemptionModel from './rewardRedemption.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { RewardRedemptionStatus } from './rewardRedemption.interface';
import { buildPaginationResponse, getPaginationSkip } from '../../utils/common';
import User from '../user/user.model';
import { UserProfile } from '../userProfile';
import config from '../../config/config';
import {
  calculateRewardProgress,
  getUtcMonthBoundaries,
  parseAllowedCommunityIds,
  RewardProgress,
  startOfUtcMonthAfter,
} from '../user/rewardProgress.helpers';

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

/**
 * Upsert the referrer's reward redemption row for the current UTC month, using the same
 * carry + eligible-referral rules as getRewardsDetails in user.service.
 * Does not modify completed redemption rows for that month.
 */
export const syncReferrerRewardRedemptionForCurrentMonth = async (
  referrerUserId: mongoose.Types.ObjectId | null | undefined,
  referenceDate: Date = new Date()
) => {
  if (!referrerUserId) {
    return null;
  }

  const referrerExists = await User.exists({ _id: referrerUserId });
  if (!referrerExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const allowedCommunityIds = parseAllowedCommunityIds(config.ALLOWED_COMMUNITY_IDS_FOR_REWARD_ELIGIBILITY);
  const { startOfThisMonth, startOfNextMonth, startOfPreviousMonth } = getUtcMonthBoundaries(referenceDate);

  const baseFilter = {
    referredBy: referrerUserId,
    isDeleted: { $ne: true },
  };

  const getEligibleReferralCount = async (startDate: Date, endExclusive: Date): Promise<number> => {
    if (!allowedCommunityIds.length) {
      return 0;
    }

    const [result] = await User.aggregate<{ count: number }>([
      {
        $match: {
          ...baseFilter,
          createdAt: {
            $gte: startDate,
            $lt: endExclusive,
          },
        },
      },
      {
        $lookup: {
          from: UserProfile.collection.name,
          localField: '_id',
          foreignField: 'users_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      { $unwind: '$profile.email' },
      {
        $match: {
          'profile.email.communityId': { $in: allowedCommunityIds },
        },
      },
      {
        $project: {
          normalizedUniversityEmail: {
            $toLower: {
              $trim: {
                input: { $ifNull: ['$profile.email.UniversityEmail', ''] },
              },
            },
          },
        },
      },
      { $match: { normalizedUniversityEmail: { $ne: '' } } },
      { $group: { _id: '$normalizedUniversityEmail' } },
      { $count: 'count' },
    ]);
    return result?.count ?? 0;
  };

  const [thisMonthNewReferrals, previousMonthRedemption, anchorBeforePreviousMonth] = await Promise.all([
    getEligibleReferralCount(startOfThisMonth, startOfNextMonth),
    getRewardRedemptionForMonth(referrerUserId, startOfPreviousMonth),
    getLatestRewardRedemptionBeforeMonth(referrerUserId, startOfPreviousMonth),
  ]);

  let previousMonthComputedTotalInvites: number;
  let previousMonthComputed: RewardProgress;

  if (previousMonthRedemption) {
    previousMonthComputedTotalInvites = previousMonthRedemption.totalInvites ?? 0;
    previousMonthComputed = calculateRewardProgress(previousMonthComputedTotalInvites);
  } else {
    const previousMonthCountStart = anchorBeforePreviousMonth
      ? startOfUtcMonthAfter(anchorBeforePreviousMonth.rewardMonth as Date)
      : new Date(0);
    const previousMonthReferralsAfterAnchor = await getEligibleReferralCount(
      previousMonthCountStart,
      startOfThisMonth
    );
    const previousMonthCarryFromAnchor = anchorBeforePreviousMonth?.totalInvites ?? 0;
    previousMonthComputedTotalInvites = previousMonthCarryFromAnchor + previousMonthReferralsAfterAnchor;
    previousMonthComputed = calculateRewardProgress(previousMonthComputedTotalInvites);
  }

  if (!previousMonthRedemption) {
    await upsertRewardRedemptionForMonth({
      userId: referrerUserId,
      rewardMonth: startOfPreviousMonth,
      status: RewardRedemptionStatus.Processing,
      amount: previousMonthComputed.reward || 0,
      totalInvites: previousMonthComputedTotalInvites,
      leftoverInvites: previousMonthComputed.leftoverInvites,
    });
  }

  const carryIntoThisMonth = previousMonthComputed.leftoverInvites;
  const thisMonthProgress = carryIntoThisMonth + thisMonthNewReferrals;
  const thisMonthCalculated = calculateRewardProgress(thisMonthProgress);

  const existingThisMonth = await getRewardRedemptionForMonth(referrerUserId, startOfThisMonth);

  if (existingThisMonth?.status === RewardRedemptionStatus.Completed) {
    return existingThisMonth;
  }

  const redemptionsBeforeThisMonth = await getRewardRedemptionsBeforeMonth(referrerUserId, startOfThisMonth);
  const latestPreviousWithUpi = [...redemptionsBeforeThisMonth]
    .filter((r) => r.upiId && String(r.upiId).trim().length > 0)
    .sort(
      (a, b) => new Date(b.rewardMonth as Date).getTime() - new Date(a.rewardMonth as Date).getTime()
    )[0];
  const inheritedUpi =
    (existingThisMonth?.upiId && String(existingThisMonth.upiId).trim()) ||
    (latestPreviousWithUpi?.upiId ? String(latestPreviousWithUpi.upiId).trim() : undefined);

  const status = existingThisMonth?.status ?? RewardRedemptionStatus.Pending;

  return upsertRewardRedemptionForMonth({
    userId: referrerUserId,
    rewardMonth: startOfThisMonth,
    status,
    amount: thisMonthCalculated.reward || 0,
    totalInvites: thisMonthProgress,
    leftoverInvites: thisMonthCalculated.leftoverInvites,
    ...(inheritedUpi ? { upiId: inheritedUpi } : {}),
  });
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

export const getRewardRedemptionsBeforeMonth = async (
  userId: mongoose.Types.ObjectId,
  beforeMonth: Date
) => {
  const monthStart = getMonthStartUTC(beforeMonth);
  return RewardRedemptionModel.find({
    userId,
    rewardMonth: { $lt: monthStart },
  })
    .sort({ rewardMonth: 1 })
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

