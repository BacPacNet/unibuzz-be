import Joi from 'joi';

export const createPreviousMonthRewardRequest = {
  body: Joi.object().keys({
    awsEmail: Joi.string().required().email().trim(),
  }),
};
