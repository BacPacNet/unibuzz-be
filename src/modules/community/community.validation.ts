import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const getCommunity = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
};



export const joinCommunity = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
};

export const leaveCommunity = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
};

export const joinCommunityFromUniversity = {
  query: Joi.object().keys({
    universityId: Joi.string().required().custom(objectId),
  }),
};

export const getCommunityUsers = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    ...paginationQuery,
    isVerified: Joi.boolean().optional(),
    searchQuery: Joi.string().trim().allow('').optional(),
  }),
};

export const getCommunityUsersWithFilter = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    ...paginationQuery,
    isVerified: Joi.boolean().optional(),
    searchQuery: Joi.string().trim().allow('').optional(),
    communityGroupId: Joi.string().custom(objectId).optional(),
  }),
};

export const getFilteredUserCommunity = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      sort: Joi.string().optional(),
      selectedType: Joi.array().items(Joi.string()).optional(),
      selectedLabel: Joi.array().items(Joi.string()).optional(),
      selectedFilters: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())).optional(),
    })
    .unknown(true),
};

