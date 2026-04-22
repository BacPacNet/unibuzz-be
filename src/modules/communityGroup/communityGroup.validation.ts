import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { CommunityGroupAccess, CommunityGroupLabel, CommunityGroupType } from '../../config/community.type';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
};

export const getCommunityGroupMembers = {
  query: Joi.object().keys({
    communityGroupId: Joi.string().required().custom(objectId),
    userStatus: Joi.string().trim().optional(),
    ...paginationQuery,
  }),
};

export const getCommunityGroupById = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    communityGroupId: Joi.string().required().custom(objectId),
  }),
};

export const createCommunityGroup = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string().trim().required(),
      description: Joi.string().trim().allow('').optional(),
      communityGroupType: Joi.string().valid(CommunityGroupType.CASUAL,"Casual", CommunityGroupType.OFFICIAL,"Official").required(),
      communityGroupLabel: Joi.string().valid(CommunityGroupLabel.Course, CommunityGroupLabel.Club, CommunityGroupLabel.Circle, CommunityGroupLabel.Other).optional(),
      communityGroupCategory: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())).optional(),
      selectedUsers: Joi.array()
        .items(
          Joi.object()
            .keys({
              users_id: Joi.string().custom(objectId),
              _id: Joi.string().custom(objectId).optional(),
              displayEmail: Joi.string().allow('').optional(),
              adminCommunityId: Joi.valid(null).optional(),
              affiliation: Joi.string().allow('').optional(),
              bio: Joi.string().allow('').optional(),
              blockedUsers: Joi.array().optional(),
              city: Joi.string().allow('').optional(),
              country: Joi.string().allow('').optional(),
              createdAt: Joi.string().optional(),
              degree: Joi.string().allow('').optional(),
              dob: Joi.string().optional(),
              firstName: Joi.string().optional(),
              isVerified: Joi.boolean().optional(),
              lastName: Joi.string().optional(),
              major: Joi.string().optional(),
              occupation: Joi.string().allow('').optional(),
              phone_number: Joi.string().allow('').optional(),
              profile_dp: Joi.object().optional(),
              role: Joi.string().optional(),
              study_year: Joi.string().optional(),
              universityLogo: Joi.string().uri().allow('').optional(),
              university_id: Joi.string().optional(),
              university_name: Joi.string().optional(),
            })
            .unknown(true)
        )
        .optional(),
      communityGroupLogoUrl: Joi.object()
        .keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() })
        .optional(),
      communityGroupLogoCoverUrl: Joi.object()
        .keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() })
        .optional(),
    })
    .unknown(true),
};

const createCommunityGroupBySuperAdminItem = Joi.object()
  .keys({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().allow('').optional(),
    communityGroupType: Joi.string()
      .valid(CommunityGroupType.CASUAL, 'Casual', CommunityGroupType.OFFICIAL, 'Official')
      .required(),
    communityGroupLabel: Joi.string()
      .valid(
        CommunityGroupLabel.Course,
        CommunityGroupLabel.Club,
        CommunityGroupLabel.Circle,
        CommunityGroupLabel.Other
      )
      .optional(),
    communityGroupAccess: Joi.string()
      .valid(CommunityGroupAccess.Public, CommunityGroupAccess.Private, 'Public', 'Private')
      .optional(),
    communityGroupCategory: Joi.alternatives()
      .try(Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())), Joi.valid(null))
      .optional(),
    selectedUsers: Joi.array()
      .items(
        Joi.object()
          .keys({
            users_id: Joi.string().custom(objectId),
            _id: Joi.string().custom(objectId).optional(),
            displayEmail: Joi.string().allow('').optional(),
            adminCommunityId: Joi.valid(null).optional(),
            affiliation: Joi.string().allow('').optional(),
            bio: Joi.string().allow('').optional(),
            blockedUsers: Joi.array().optional(),
            city: Joi.string().allow('').optional(),
            country: Joi.string().allow('').optional(),
            createdAt: Joi.string().optional(),
            degree: Joi.string().allow('').optional(),
            dob: Joi.string().optional(),
            firstName: Joi.string().optional(),
            isVerified: Joi.boolean().optional(),
            lastName: Joi.string().optional(),
            major: Joi.string().optional(),
            occupation: Joi.string().allow('').optional(),
            phone_number: Joi.string().allow('').optional(),
            profile_dp: Joi.object().optional(),
            role: Joi.string().optional(),
            study_year: Joi.string().optional(),
            universityLogo: Joi.string().uri().allow('').optional(),
            university_id: Joi.string().optional(),
            university_name: Joi.string().optional(),
          })
          .unknown(true)
      )
      .optional(),
    // Optional aliases used by bulk-import payloads
    adminId: Joi.string().trim().optional(),
    memberList: Joi.array().items(Joi.string().trim()).optional(),
    communityGroupLogoUrl: Joi.alternatives()
      .try(Joi.object().keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() }), Joi.string().allow(''))
      .optional(),
    communityGroupLogoCoverUrl: Joi.alternatives()
      .try(Joi.object().keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() }), Joi.string().allow(''))
      .optional(),
  })
  .unknown(true);

export const createCommunityGroupBySuperAdmin = {
  params: Joi.object().keys({
    communityId: Joi.string().required().custom(objectId),
  }),
  body: Joi.alternatives().try(createCommunityGroupBySuperAdminItem, Joi.array().items(createCommunityGroupBySuperAdminItem)),
};

export const updateCommunityGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string().trim().optional(),
      description: Joi.string().trim().allow('').optional(),
      communityGroupCategory: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())).optional(),
      communityGroupAccess: Joi.string().valid(CommunityGroupAccess.Public, CommunityGroupAccess.Private).optional(),
      communityGroupLogoUrl: Joi.object()
        .keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() })
        .optional(),
      communityGroupLogoCoverUrl: Joi.object()
        .keys({ imageUrl: Joi.string().uri(), publicId: Joi.string() })
        .optional(),
      selectedUsers: Joi.array()
        .items(
          Joi.object()
            .keys({
              users_id: Joi.string().custom(objectId),
              _id: Joi.string().custom(objectId).optional(),
              displayEmail: Joi.string().allow('').optional(),
              adminCommunityId: Joi.valid(null).optional(),
              affiliation: Joi.string().allow('').optional(),
              bio: Joi.string().allow('').optional(),
              blockedUsers: Joi.array().optional(),
              city: Joi.string().allow('').optional(),
              country: Joi.string().allow('').optional(),
              createdAt: Joi.string().optional(),
              degree: Joi.string().allow('').optional(),
              dob: Joi.string().optional(),
              firstName: Joi.string().optional(),
              isVerified: Joi.boolean().optional(),
              lastName: Joi.string().optional(),
              major: Joi.string().optional(),
              occupation: Joi.string().allow('').optional(),
              phone_number: Joi.string().allow('').optional(),
              profile_dp: Joi.object().optional(),
              role: Joi.string().optional(),
              study_year: Joi.string().optional(),
              universityLogo: Joi.string().uri().allow('').optional(),
              university_id: Joi.string().optional(),
              university_name: Joi.string().optional(),
            })
            .unknown(true)
        )
        .optional(),
    })
    .unknown(true),
};

export const deleteCommunityGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
};

export const changeCommunityGroupStatus = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      communityGroupId: Joi.string().required().custom(objectId),
      adminId: Joi.string().required().custom(objectId),
      userId: Joi.string().required().custom(objectId),
      text: Joi.string().trim().optional(),
      status: Joi.string().valid('pending', 'rejected', 'accepted', 'default').required(),
      notificationId: Joi.string().custom(objectId).optional(),
    })
    .unknown(true),
};

export const updateCommunityGroupJoinRequest = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      notificationId: Joi.string().required().custom(objectId),
      status: Joi.string().valid('pending', 'rejected', 'accepted', 'default').required(),
      userId: Joi.string().required().custom(objectId),
      adminId: Joi.string().required().custom(objectId),
      communityGroupId: Joi.string().required().custom(objectId),
    })
    .unknown(true),
};

export const joinCommunityGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
};

export const leaveCommunityGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
  }),
};

export const removeUserFromCommunityGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(objectId),
    userId: Joi.string().required().custom(objectId),
  }),
};
