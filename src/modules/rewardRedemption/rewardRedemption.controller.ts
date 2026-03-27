import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import ApiError from '../errors/ApiError';
import catchAsync from '../utils/catchAsync';
import { parsePagination, parseUserIdOrThrow } from '../../utils/common';
import { userIdExtend } from '../../config/userIDType';
import * as rewardRedemptionService from './rewardRedemption.service';
import { RewardRedemptionStatus } from './rewardRedemption.interface';








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

export const markRewardRedemptionCompleted = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { redemptionId } = req.params as { redemptionId: string };
    const updated = await rewardRedemptionService.markRewardRedemptionCompleted(
      new mongoose.Types.ObjectId(redemptionId)
    );

    res.status(httpStatus.OK).json({
      message: 'Reward redemption marked as completed',
      redemptionId: updated._id,
      status: updated.status,
    });
  }
);

export const updateLatestRewardRedemptionUpiId = catchAsync(
  async (req: userIdExtend, res: Response): Promise<void> => {
    const userId = parseUserIdOrThrow(req.userId);
    const { upiId } = req.body as { upiId?: string };

    if (!upiId || typeof upiId !== 'string' || !upiId.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'upiId is required');
    }

    const updated = await rewardRedemptionService.updateLatestRewardRedemptionUpiId(
      userId,
      upiId
    );

    res.status(httpStatus.OK).json({
      message: 'Latest reward redemption UPI ID updated successfully',
      redemptionId: updated._id,
      upiId: updated.upiId,
      rewardMonth: updated.rewardMonth,
    });
  }
);

export const getAllRewardRedemptions = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const { status } = req.query as { status?: RewardRedemptionStatus };

    const result = await rewardRedemptionService.getAllRewardRedemptions(
      page,
      limit,
      status
    );

    res.status(httpStatus.OK).json(result);
  }
);

