import Joi from 'joi';
import { objectId } from '../validate';
import { Sortby } from './userPostComments.interface';

const userPostIdParam = {
  userPostId: Joi.string().required().custom(objectId),
};

const commentIdParam = {
  commentId: Joi.string().required().custom(objectId),
};

const userPostCommentIdParam = {
  userPostCommentId: Joi.string().required().custom(objectId),
};

const paginationQuery = {
  page: Joi.string().optional(),
  limit: Joi.string().optional(),
};

const imageUrlItem = Joi.object().keys({
  imageUrl: Joi.string(),
  publicId: Joi.string(),
});

export const getUserPostComments = {
  params: Joi.object().keys(userPostIdParam),
  query: Joi.object().keys({
    ...paginationQuery,
    sortBy: Joi.string()
      .valid(Sortby.ASC, Sortby.DESC)
      .optional(),
  }),
};

export const createUserPostComment = {
  params: Joi.object().keys(userPostIdParam),
  body: Joi.object()
    .keys({
      content: Joi.string().optional().allow(''),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
    })
    .min(1)
    .keys({
      commenterProfileId: Joi.string().required().custom(objectId),
      postID: Joi.string().required().custom(objectId),
    })
    .custom((value, helpers) => {
      const hasContent = value.content?.trim?.()?.length > 0;
      const hasImage = Array.isArray(value.imageUrl) && value.imageUrl.length > 0;
      if (!hasContent && !hasImage) {
        return helpers.message({ custom: 'Content or image is required' });
      }
      return value;
    }),
};

export const getCommentById = {
  params: Joi.object().keys(commentIdParam),
};

export const updateComment = {
  params: Joi.object().keys(commentIdParam),
  body: Joi.object()
    .keys({
      content: Joi.string().optional(),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
    })
    .min(1),
};

export const deleteComment = {
  params: Joi.object().keys(commentIdParam),
};

export const userPostCommentReply = {
  params: Joi.object().keys(commentIdParam),
  query: Joi.object().keys({
    userPostId: Joi.string().optional().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      content: Joi.string().optional().allow(''),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
    })
    .min(1)
    .keys({
      commenterProfileId: Joi.string().required().custom(objectId),
      postID: Joi.string().required().custom(objectId),
      commentId:Joi.string().required().custom(objectId),
      level: Joi.number().optional(),
    })
    .custom((value, helpers) => {
      const hasContent = value.content?.trim?.()?.length > 0;
      const hasImage = Array.isArray(value.imageUrl) && value.imageUrl.length > 0;
      if (!hasContent && !hasImage) {
        return helpers.message({ custom: 'Content or image is required' });
      }
      return value;
    }),
};

export const likeUserPostComment = {
  params: Joi.object().keys(userPostCommentIdParam),
};
