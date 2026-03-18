import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const getGroupNotification = {
  query: Joi.object().keys({
    ...paginationQuery,
  }),
};

export const updateGroupNotification = {
  body: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

export const getUserNotification = {
  query: Joi.object().keys({
    ...paginationQuery,
  }),
};

export const joinGroup = {
  body: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
    groupId: Joi.string().required().custom(objectId),
    isAccepted: Joi.boolean().optional(),

  }),
};
