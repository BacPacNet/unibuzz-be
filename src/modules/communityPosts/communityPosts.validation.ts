import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { CommunityType, communityPostFilterType } from '../../config/community.type';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const getAllCommunityPostV2 = {
  query: Joi.object().keys({
    ...paginationQuery,
    communityId: Joi.string().required().custom(objectId),
  }),
};

export const getAllCommunityGroupPostV2 = {
  query: Joi.object().keys({
    ...paginationQuery,
    communityId: Joi.string().required().custom(objectId),
    communityGroupId: Joi.string().required().custom(objectId),
    filterPostBy: Joi.string()
      .valid(communityPostFilterType.MY_POSTS, communityPostFilterType.PENDING_POSTS).allow("")
      .optional(),
  }),
};

export const getPostById = {
  params: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    isType: Joi.string().valid('Community', 'Timeline').optional(),
    commentId: Joi.string().custom(objectId).optional().allow(""),
  }),
};

export const updateCommunityPostLive = {
  params: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    status: Joi.string().optional(),
  }),
};

export const getAllCommunityPost = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
    communityGroupId: Joi.string().custom(objectId).optional(),
  }),
  query: Joi.object().keys({
    ...paginationQuery,
  }),
};



const imageUrlItem = Joi.object().keys({
  imageUrl: Joi.string(),
  publicId: Joi.string(),
});

export const createCommunityPost = {
  body: Joi.object()
  .keys({
    content: Joi.string().trim().allow(''),
    imageUrl: Joi.array().items(imageUrlItem).optional(),
  }).min(1)
    .keys({
      communityId: Joi.string().required().custom(objectId),
      communityGroupId: Joi.string().custom(objectId).optional().allow(null),
    
      communityPostsType: Joi.string()
        .valid(CommunityType.PUBLIC, CommunityType.FOLLOWER_ONLY)
        .optional(),
    })
    .unknown(true),
};

export const updateCommunityPost = {
  params: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      content: Joi.string().trim().allow('').optional(),
      communityPostsType: Joi.string()
        .valid(CommunityType.PUBLIC, CommunityType.FOLLOWER_ONLY)
        .optional(),
    })
    .unknown(true),
};

export const deleteCommunityPost = {
  params: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
};

export const likeUnlikePost = {
  params: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
};
