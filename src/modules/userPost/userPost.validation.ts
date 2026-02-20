import Joi from 'joi';
import { objectId } from '../validate';

const postIdParam = {
  postId: Joi.string().required().custom(objectId),
};

const paginationQuery = {
  page: Joi.string().optional(),
  limit: Joi.string().optional(),
};

const imageUrlItem = Joi.object().keys({
  imageUrl: Joi.string(),
  publicId: Joi.string(),
});

export const getAllUserPosts = {
  query: Joi.object().keys({
    ...paginationQuery,
    userId: Joi.string().required().custom(objectId),
  }),
};

export const createUserPost = {
  body: Joi.object().keys({
    PostType: Joi.string().valid('PUBLIC', 'FOLLOWER_ONLY', 'MUTUAL', 'ONLY_ME').optional(),
  })
  .keys({
    content: Joi.string().required().allow(''),
    imageUrl: Joi.array().items(imageUrlItem).optional(),
  })
  .min(1),
};

export const getAllTimelinePosts = {
  query: Joi.object().keys(paginationQuery),
};

export const updateUserPost = {
  params: Joi.object().keys(postIdParam),
  body: Joi.object()
    .keys({
      content: Joi.string().optional().allow(''),
      imageUrl: Joi.array().items(imageUrlItem).optional(),
      PostType: Joi.string().valid('PUBLIC', 'FOLLOWER_ONLY', 'MUTUAL', 'ONLY_ME').optional(),
    })
    .min(1),
};

export const deleteUserPost = {
  params: Joi.object().keys(postIdParam),
};

export const updateLikeStatus = {
  params: Joi.object().keys(postIdParam),
};
