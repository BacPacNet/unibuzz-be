import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedUser } from './user.interfaces';

const createUserBody: Record<keyof NewCreatedUser, any> = {
  email: Joi.string().required().email(),
  password: Joi.string().required().custom(password),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  userName: Joi.string().required(),
  gender: Joi.string().required(),
  role: Joi.string().required().valid('user', 'admin'),
  createdAt: Joi.string(),
  userVerifiedCommunities: Joi.string(),
  userUnVerifiedCommunities: Joi.string(),
  isNewUser: Joi.boolean(),
  isDeleted: Joi.boolean(),
  deletedAt: Joi.date(),
  referCode: Joi.string().optional(),
  referredBy: Joi.string().optional(),
  uniqueId: Joi.string().optional(),
};

export const createUser = {
  body: Joi.object().keys(createUserBody),
};

export const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};



export const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const paginationQuery = {
  page: Joi.string().optional(),
  limit: Joi.string().optional(),
};

export const getAllUser = {
  query: Joi.object().keys({
    ...paginationQuery,
    name: Joi.string().optional(),
    universityName: Joi.string().optional(),
    studyYear: Joi.string().optional(),
    major: Joi.string().optional(),
    occupation: Joi.string().optional(),
    affiliation: Joi.string().optional(),
    chatId: Joi.string().optional(),
    role: Joi.string().optional(),
  }),
};

export const checkUserEmailAndUserNameAvailability = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    userName: Joi.string().required(),
  }),
};

export const checkUserEmailAvailability = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
  }),
};

export const softDeleteUser = {
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
    sure: Joi.boolean().required(),
  }),
};

export const changeUserPassword = {
  body: Joi.object().keys({
    currentPassword: Joi.string().required(),
    confirmPassword: Joi.string().required().custom(password),
    newPassword: Joi.string().required().custom(password),
  }),
};

export const changeUserName = {
  body: Joi.object().keys({
    userName: Joi.string().required(),
    newUserName: Joi.string().required(),
    password: Joi.string().required().custom(password),
  }),
};

export const changeEmail = {
  body: Joi.object().keys({
    currentEmail: Joi.string().required().email(),
    newMail: Joi.string().required().email(),
    emailOtp: Joi.string().required(),
  }),
};

export const deActivateUserAccount = {
  body: Joi.object().keys({
    userName: Joi.string().required(),
    email: Joi.string().required().email(),
    Password: Joi.string().required().custom(password),
  }),
};

export const getReferredUsers = {
  query: Joi.object().keys(paginationQuery),
};
