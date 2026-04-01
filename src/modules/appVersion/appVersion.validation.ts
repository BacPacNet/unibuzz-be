import Joi from 'joi';

const platform = Joi.string().valid('android', 'ios').required();

export const getPolicy = {
  query: Joi.object().keys({
    platform,
  }),
};

export const required = {
  headers: Joi.object()
    .keys({
      'x-client-platform': Joi.string().valid('android', 'ios'),
      'x-platform': Joi.string().valid('android', 'ios'),
      'x-app-version': Joi.string().trim().allow(''),
      'x-version': Joi.string().trim().allow(''),
    })
    .unknown(true),
};

