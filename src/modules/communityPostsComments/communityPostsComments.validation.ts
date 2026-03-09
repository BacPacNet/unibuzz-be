import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { Sortby } from '../userPostComments/userPostComments.interface';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

const imageUrlItem = Joi.object().keys({
  imageUrl: Joi.string().optional(),
  publicId: Joi.string().optional(),
});

export const getCommunityPostComments = {
  params: Joi.object().keys({
    communityPostId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    ...paginationQuery,
    sortBy: Joi.string()
      .valid(Sortby.ASC, Sortby.DESC)
      .optional(),
  }),
};

export const createComment = {
  params: Joi.object().keys({
    communityPostId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      content: Joi.string().trim().allow('').optional(),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
    })
    .min(1)
    .unknown(true),
};

export const getCommentById = {
  params: Joi.object().keys({
    commentId: Joi.string().required().custom(objectId),
  }),
};

export const updateComment = {
  params: Joi.object().keys({
    commentId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      content: Joi.string().trim().allow('').optional(),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
    })
    .min(1)
    .unknown(true),
};

export const deleteCommunityPostComment = {
  params: Joi.object().keys({
    commentId: Joi.string().required().custom(objectId),
  }),
};

export const communityPostCommentReply = {
  params: Joi.object().keys({
    commentId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      content: Joi.string().trim().allow('').optional(),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
      level: Joi.number().integer().min(0).optional(),
    })
    .min(1)
    .unknown(true),
};

export const likeUnlikeCommunityPostComment = {
  params: Joi.object().keys({
    communityPostCommentId: Joi.string().required().custom(objectId),
  }),
};
