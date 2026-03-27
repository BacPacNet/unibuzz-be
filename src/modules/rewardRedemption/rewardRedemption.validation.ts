import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { REWARD_REDEMPTION_STATUS_VALUES } from './rewardRedemption.interface';

export const createPreviousMonthRewardRequest = {
  body: Joi.object().keys({
    upiId: Joi.string().required().trim(),
  }),
};

export const markRewardRedemptionCompleted = {
  params: Joi.object().keys({
    redemptionId: Joi.string().required().custom(objectId),
  }),
};

export const updateLatestRewardRedemptionUpiId = {
  body: Joi.object().keys({
    upiId: Joi.string().required().trim(),
  }),
};

export const getAllRewardRedemptions = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    status: Joi.string()
      .valid(...REWARD_REDEMPTION_STATUS_VALUES)
      .optional(),
  }),
};
