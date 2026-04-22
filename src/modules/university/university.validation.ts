import Joi from 'joi';

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
