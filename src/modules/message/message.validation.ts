import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const mediaSchema = Joi.object().keys({
  imageUrl: Joi.string().allow(''),
  publicId: Joi.string().allow(''),
});

export const sendMessage = {
  body: Joi.object().keys({
    content: Joi.string().trim().allow('').optional(),
    chatId: Joi.string().required().custom(objectId),
    media: Joi.array().items(mediaSchema).optional(),
    UserProfileId: Joi.string().custom(objectId).optional(),
  }),
};

export const getUserMessages = {
  params: Joi.object().keys({
    chatId: Joi.string().required().custom(objectId),
  }),
};

export const updateMessageIsSeen = {
  params: Joi.object().keys({
    messageId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    readByUserId: Joi.string().required().custom(objectId),
  }),
};

export const reactToMessage = {
  body: Joi.object().keys({
    messageId: Joi.string().required().custom(objectId),
    emoji: Joi.string().trim().required(),
  }),
};
