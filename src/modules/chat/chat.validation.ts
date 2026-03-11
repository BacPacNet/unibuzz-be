import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const createGetChat = {
  body: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

export const getUserMessageNotification = {
  query: Joi.object().keys({
    ...paginationQuery,
  }),
};


export const createGroupChat = {
  body: Joi.object().keys({
    users: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
    groupName: Joi.string().trim().allow('').optional(),
    groupDescription: Joi.string().trim().allow('').optional(),
    groupLogo: Joi.object().keys({
      imageUrl: Joi.string(),
      publicId: Joi.string(),
    }).optional().allow(null),
    community: Joi.object()
      .keys({
        id: Joi.string().custom(objectId).allow('').optional(),
        name: Joi.string().allow('').optional(),
      })
      .optional(),
  }),
};

export const getGroupChatMember = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
};

export const acceptSingleRequest = {
  body: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};

export const acceptGroupRequest = {
  body: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};

export const toggleStarred = {
  body: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};

export const toggleAddToGroup = {
  params: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    userToToggleId: Joi.string().required().custom(objectId),
  }),
};

export const editGroupChat = {
  params: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    users: Joi.array().items(Joi.string().custom(objectId)).optional(),
    groupName: Joi.string().trim().allow('').optional(),
    groupLogo: Joi.object().keys({
      imageUrl: Joi.string(),
      publicId: Joi.string(),
    }).optional().allow(null),
  }),
};

export const leaveGroup = {
  params: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};

export const deleteChatGroup = {
  params: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};


