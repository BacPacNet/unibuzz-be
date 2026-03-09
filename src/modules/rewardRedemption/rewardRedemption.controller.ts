import httpStatus from 'http-status';
import { Response } from 'express';
import ApiError from '../errors/ApiError';
import catchAsync from '../utils/catchAsync';
import { parseUserIdOrThrow } from '../../utils/common';
import { userIdExtend } from '../../config/userIDType';
import * as rewardRedemptionService from './rewardRedemption.service';
import { userService } from '../user';


export const createPreviousMonthRewardRequest = catchAsync(
  async (req: userIdExtend, res: Response): Promise<void> => {
    const userId = parseUserIdOrThrow(req.userId);
    const { awsEmail } = req.body as { awsEmail?: string };
    if (!awsEmail || typeof awsEmail !== 'string' || !awsEmail.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'awsEmail is required');
    }
    const now = new Date();
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const summary = await userService.getRewardsDetails(userId);
    if (!summary.previousMonthReward || summary.previousMonthReward <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No reward available for previous month');
    }
    const doc = await rewardRedemptionService.markRewardPendingForMonth(
      userId,
      awsEmail.trim(),
      previousMonthStart,
      summary.previousMonthReward
    );
    res.status(httpStatus.OK).json({
      message: 'Previous month reward request created (pending)',
      rewardMonth: previousMonthStart.toISOString(),
      status: doc.status,
      amount: doc.amount,
    });
  }
);





export const getPreviousMonthRedemptionStatus = catchAsync(
  async (req: userIdExtend, res: Response): Promise<void> => {
    const userId = parseUserIdOrThrow(req.userId);
    const now = new Date();
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const redeemed = await rewardRedemptionService.hasRedeemedRewardForMonth(
      userId,
      previousMonthStart
    );
    res.status(httpStatus.OK).json({
      previousMonthRedeemed: redeemed,
      rewardMonth: previousMonthStart.toISOString(),
    });
  }
);

