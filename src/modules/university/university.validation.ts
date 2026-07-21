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

export const getUniversityByName = {
  params: Joi.object().keys({
    university_name: Joi.string().trim().required(),
  }),
};

export const getUniversityByUniversityId = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
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

export const updateUniversityProfile = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().trim().min(1).optional(),
      description: Joi.string().trim().optional(),
      long_description: Joi.string().trim().optional(),
      short_overview: Joi.string().trim().optional(),
      shortOverview: Joi.string().trim().optional(),
      logo: Joi.string().trim().optional(),
      campus: Joi.string().trim().optional(),
      total_students: Joi.string().trim().allow('').optional(),
      web_pages: Joi.string().trim().uri().allow('').optional(),
      email: Joi.string().trim().email().allow('').optional(),
      phone: Joi.string().trim().allow('').optional(),
      address: Joi.string().trim().allow('').optional(),
      office_hours: Joi.string().trim().allow('').optional(),
      contacts: Joi.object()
        .keys({
          email: Joi.string().trim().email().allow('').optional(),
          phone: Joi.string().trim().allow('').optional(),
          address: Joi.string().trim().allow('').optional(),
          office_hours: Joi.string().trim().allow('').optional(),
        })
        .optional(),
    })
    .min(1),
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

export const updateUniversityHighlightPostPositions = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.array()
    .items(
      Joi.object().keys({
        postId: Joi.string().custom(objectId).required(),
        postType: Joi.string().valid('CommunityPost', 'UserPost').required(),
        position: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required(),
};

export const deleteUniversityHighlightPost = {
  params: Joi.object().keys({
    universityId: Joi.string().custom(objectId).required(),
    postId: Joi.string().custom(objectId).required(),
  }),
};
