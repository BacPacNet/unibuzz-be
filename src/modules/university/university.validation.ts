import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const getAllUniversity = {
  query: Joi.object().keys({
    ...paginationQuery,
    searchQuery: Joi.string().trim().allow('').optional(),
  }),
};

export const searchUniversityByQuery = {
  query: Joi.object().keys({
    ...paginationQuery,
    searchTerm: Joi.string().trim().allow('').optional(),
  }),
};

export const getUniversityById = {
  params: Joi.object().keys({
    university_name: Joi.string().trim().required(),
  }),
};

export const getUniversityDashboardStats = {
  params: Joi.object().keys({
    university_name: Joi.string().trim().required(),
  }),
};

export const setSemesterStart = {
  params: Joi.object().keys({
    university_name: Joi.string().trim().required(),
  }),
  body: Joi.object().keys({
    day: Joi.number().integer().min(1).max(31).required(),
    month: Joi.number().integer().min(1).max(12).required(),
  }),
};

export const addUniversityHighlightPost = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    postId: Joi.string().custom(objectId).required(),
    postType: Joi.string().valid('CommunityPost', 'UserPost').required(),
    position: Joi.number().integer().min(0).required(),
  }),
};

export const deleteUniversityHighlightPost = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
    postId: Joi.string().custom(objectId).required(),
  }),
};
