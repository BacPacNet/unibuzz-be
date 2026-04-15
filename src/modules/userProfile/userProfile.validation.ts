import Joi from 'joi';
import { objectId } from '../validate';

const userProfileIdParam = {
  userProfileId: Joi.string().required().custom(objectId),
};

const paginationQuery = {
  page: Joi.string().optional(),
  limit: Joi.string().optional(),
};

export const toggleFollow = {
  query: Joi.object().keys({
    userToFollow: Joi.string().required().custom(objectId),
  }),
};

export const toggleBlock = {
  query: Joi.object().keys({
    userToBlock: Joi.string().required().custom(objectId),
  }),
};

export const getAllUserFollowers = {
  query: Joi.object().keys({
    ...paginationQuery,
    name: Joi.string().allow('').optional(),
    userId: Joi.string().optional().custom(objectId),
  }),
};

export const getAllUserFollowing = {
  query: Joi.object().keys({
    ...paginationQuery,
    name: Joi.string().allow('').optional(),
    userId: Joi.string().optional().custom(objectId),
  }),
};

export const getAllMutualUsers = {
  query: Joi.object().keys({
    ...paginationQuery,
    name: Joi.string().allow('').optional(),
    userId: Joi.string().optional().custom(objectId),
  }),
};

export const getAllUserFollowersAndFollowing = {
  query: Joi.object().keys({
    name: Joi.string().optional(),
  }),
};

export const addUniversityEmail = {
  body: Joi.object().keys({
    universityName: Joi.string().required(),
    universityEmail: Joi.string().email().required(),
    UniversityOtp: Joi.string().required(),
    universityId: Joi.string().optional(),
universityDomain: Joi.array().items(Joi.string()).optional(),
  }),
};

const profileDpSchema = Joi.object().keys({
  imageUrl: Joi.string().allow(''),
  publicId: Joi.string().allow(''),
});

export const updateUserProfile = {
  params: Joi.object().keys(userProfileIdParam),
  body: Joi.object()
    .keys({
      firstName: Joi.string().allow('').optional(),
      lastName: Joi.string().allow('').optional(),
      email: Joi.string().email().allow('').optional(),
      displayEmail: Joi.string().allow('').optional(),
      gender: Joi.string().allow('').optional(),
      affiliation: Joi.string().allow('').optional(),
      bio: Joi.string().allow('').optional(),
      city: Joi.string().allow('').optional(),
      country: Joi.string().allow('').optional(),
      degree: Joi.string().allow('').optional(),
      dob: Joi.string().allow('').optional(),
      major: Joi.string().allow('').optional(),
      occupation: Joi.string().allow('').optional(),
      phone_number: Joi.string().allow('').optional(),
      study_year: Joi.string().allow('').optional(),
      profilePicture: Joi.any().optional(),
      profile_dp: profileDpSchema.optional(),
      role: Joi.string().allow('').optional(),
      university_name: Joi.string().allow('').optional(),
      university_id: Joi.string().optional().custom(objectId),
      universityId: Joi.string().optional().custom(objectId),
      universityLogo: Joi.string().allow('').optional(),
      communityId:Joi.string().allow('').optional(),
    })
    .min(1),
};
