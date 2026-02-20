import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';
import { userProfileService, UserProfile } from '../userProfile';
import { BlockedUserEntry } from '../userProfile/userProfile.interface';
import mongoose, { PipelineStage } from 'mongoose';
import UniversityModel, { IUniversity } from '../university/university.model';
import cleanUpUserFromCommunityGroups from '../../utils/leftCommunity';
import { convertToObjectId, buildPaginationResponse } from '../../utils/common';
import { GetCommunityUsersOptions, GetUserFilteredCommunitiesResult, communityInterface } from './community.interface';
import type { HydratedDocument } from 'mongoose';
import config from '../../config/config';
import { communityGroupService } from '../communityGroup';
import {
  CommunityGroupFilters,
  buildFilteredCommunitiesBasePipeline,
  buildGroupVisibilityFilterStage,
  buildTypeAndLabelFilterStage,
  buildSelectedFiltersStage,
  buildCommunityGroupsSortStages,
  buildCommunityUsersBasePipeline,
  buildCommunityGroupUsersExclusionStage,
  buildVerifiedUsersFilterStage,
  buildUserFieldsExtractionStage,
  buildUserProfileLookupStage,
  buildBlockedUsersFilterStage,
  buildBlockedUsersFilterStageForProfileRoot,
  buildUserLookupAndFilterStage,
  buildUserFieldsAddStage,
  buildSearchQueryFilterStage,
  buildPaginationFacetStage,
  buildUserCommunitiesBasePipeline,
  buildUserInCommunityCheckStage,
  // buildUserCommunitiesGroupFilterStage,
  buildUserCommunitiesProjectStage,
  buildUserCommunitiesUsersFilterStage,
  buildCommunityGroupsProjectStage,
  buildCommunityUsersServiceBaseStages,
  buildCommunityUsersServiceSearchStage,
} from './community.pipeline';

export const createCommunity = async (
  name: string,

  university_id: string,
  numberOfStudent: string,
  numberOfFaculty: string,
  coverImg: string,
  logo: string,
  about: string
) => {
  const data = {
    name,
    adminId: config.DEFAULT_COMMUNITY_ADMIN_ID,
    university_id,
    numberOfStudent: numberOfStudent || 0,
    numberOfFaculty: numberOfFaculty || 0,
    numberOfUser: 0,
    communityCoverUrl: { imageUrl: coverImg },
    communityLogoUrl: { imageUrl: logo },
    about,
  };
  return await communityModel.create(data);
};

export const getCommunity = async (
  communityId: string,
  options?: { currentUserId?: string }
) => {
  const id = convertToObjectId(communityId);
  if (options?.currentUserId) {
    const userId = convertToObjectId(options.currentUserId);
    const [community] = await communityModel.aggregate([
      { $match: { _id: id } },
      {
        $project: {
          communityCoverUrl: 1,
          communityLogoUrl: 1,
          name: 1,
          university_id: 1,
          about: 1,
          communityGroups: 1,
          adminId: 1,
          numberOfStudent: 1,
          numberOfFaculty: 1,
          assistantId: 1,
          users: {
            $filter: {
              input: '$users',
              as: 'u',
              cond: { $eq: ['$$u._id', userId] },
            },
          },
        },
      },
    ]);
    return community as communityInterface;
  }
  return await communityModel.findById(id).lean();
};


/**
 * Finds a community by ID. Throws ApiError if not found.
 */
const getCommunityOrThrow = async (communityId: string, options?: { lean?: boolean }) => {
  const query = communityModel.findById(convertToObjectId(communityId));
  const community = options?.lean ? await query.lean() : await query;
  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }
  return community;
};

/**
 * Fetches user and user profile by user ID. Throws ApiError if either is not found.
 */
const getUserAndProfileOrThrow = async (userID: string) => {
  const [user, userProfile] = await Promise.all([
    User.findById(userID).lean(),
    userProfileService.getUserProfileById(userID),
  ]);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User Profile not found');
  }
  return { user, userProfile };
};

/**
 * Find a community by university name, or create it from the university record if not found.
 * When creating, also updates the university with communityId and isVerified.
 */
export const findOrCreateCommunityByUniversityName = async (
  universityName: string,
  createdByUserId: string
): Promise<HydratedDocument<communityInterface>> => {
  let community = await communityModel.findOne({ name: universityName });
  if (community) {
    return community;
  }

  const fetchUniversity = await UniversityModel.findOne({ name: universityName });
  if (!fetchUniversity) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const { _id: university_id, logo, campus, total_students, short_overview } = fetchUniversity as IUniversity;

  community = await communityModel.create({
    name: universityName,
    communityLogoUrl: { imageUrl: logo },
    communityCoverUrl: { imageUrl: campus },
    total_students: total_students,
    university_id: university_id,
    created_by: createdByUserId,
    about: short_overview,
    adminId: config.DEFAULT_COMMUNITY_ADMIN_ID,
  });

  await UniversityModel.updateOne(
    { _id: university_id },
    { $set: { communityId: community._id, isVerified: true } }
  );

  return community;
};

export const getUserCommunities = async (userID: string) => {
  try {
    const { userProfile } = await getUserAndProfileOrThrow(userID);

    const getAllUserCommunityIds = userProfile.communities.map((community) => {
      const communityId = community.communityId instanceof mongoose.Types.ObjectId
        ? community.communityId.toString()
        : String(community.communityId);
      return convertToObjectId(communityId);
    });
    const userObjectId = convertToObjectId(userID);

    const pipeline: PipelineStage[] = [
      ...buildUserCommunitiesBasePipeline(getAllUserCommunityIds),
      buildUserInCommunityCheckStage(userObjectId),
      // buildUserCommunitiesGroupFilterStage(userObjectId),
      ...(buildUserCommunitiesUsersFilterStage(userObjectId)
      ? [buildUserCommunitiesUsersFilterStage(userObjectId)!]
      : []),
      buildUserCommunitiesProjectStage(),
    ];

    const communities = await communityModel.aggregate(pipeline);

    // Now enrich with verification status from userProfile
    const communitiesWithVerification = communities.map((community) => {
      const communityInProfile = userProfile.communities.find((c) => c.communityId.toString() === community._id.toString());

      return {
        ...community,
        isVerified: communityInProfile ? communityInProfile.isVerified : false,
      };
    });

    return communitiesWithVerification;
  } catch (error) {
    console.error('Error fetching user communities:', error);
    throw error;
  }
};
export const getUserFilteredCommunities = async (
  userID: string,
  communityId: string = '',
  sortBy: string,
  filters?: CommunityGroupFilters
): Promise<GetUserFilteredCommunitiesResult> => {
  try {
    const { userProfile } = await getUserAndProfileOrThrow(userID);

    const myBlockedUserIds = new Set((userProfile.blockedUsers || []).map((u: BlockedUserEntry) => u.userId.toString()));
    const userObjectId = convertToObjectId(userID);

    const hasFilters = Boolean(
      (filters?.selectedType && filters.selectedType.length > 0) ||
        (filters?.selectedLabel && filters.selectedLabel.length > 0) ||
        (filters?.selectedFilters && Object.keys(filters.selectedFilters || {}).length > 0)
    );

    const pipeline: PipelineStage[] = [
      ...buildFilteredCommunitiesBasePipeline(communityId, userObjectId, myBlockedUserIds),
      buildGroupVisibilityFilterStage(userObjectId, hasFilters),
    ];

    const typeLabelStage = filters ? buildTypeAndLabelFilterStage(filters) : null;
    if (typeLabelStage) pipeline.push(typeLabelStage);

    if (filters?.selectedFilters && Object.keys(filters.selectedFilters).length > 0) {
      pipeline.push(buildSelectedFiltersStage(filters.selectedFilters));
    }

    pipeline.push({ $project: { communityGroups: 1 } });
    pipeline.push(...buildCommunityGroupsSortStages(sortBy));
    pipeline.push(...buildCommunityGroupsProjectStage(userObjectId));

    const communities = await communityModel.aggregate(pipeline);
    return (communities.length ? communities[0] : { _id: communityId, communityGroups: [] }) as GetUserFilteredCommunitiesResult;
  } catch (error) {
    console.error('Error fetching user communities:', error);
    throw error;
  }
};

export const updateCommunity = async (id: string, community: Partial<communityInterface>) => {
  const communityToUpdate = await communityModel.findById(id);

  if (!communityToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityToUpdate, community);
  await communityToUpdate.save();
  return communityToUpdate;
};

export const joinCommunity = async (userId: mongoose.Types.ObjectId, communityId: string, isVerified: boolean = false) => {
  const { user, userProfile } = await getUserAndProfileOrThrow(String(userId));

  const community = await communityModel.findOne({ _id: communityId, 'users._id': userId });

  if (community && !isVerified) {
    throw new ApiError(httpStatus.CONFLICT, 'User is already a member of this community');
  }

  const communityToJoin = await getCommunityOrThrow(communityId);

  const isCommunityVerified = userProfile.email.some(
    (userCommunity) => userCommunity.communityId.toString() === communityToJoin._id.toString()
  );

  const isAlreadyJoined = userProfile.communities.some(
    (c) => c.communityId.toString() === communityId.toString()
  );

  if (!isAlreadyJoined) {
    userProfile.communities.push({ communityId, isVerified: isCommunityVerified || isVerified, communityGroups: [] });
    await userProfile.save();
  }

  const userResult = await communityModel.findOne({
    _id: communityId,
    users: { $elemMatch: { _id: userId } },
  });

  if (!userResult) {
    await communityModel.updateOne(
      { _id: communityId, 'users._id': { $ne: user._id } },
      {
        $push: {
          users: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: userProfile.profile_dp?.imageUrl || null,
            universityName: userProfile.university_name,
            year: userProfile.study_year,
            degree: userProfile.degree,
            major: userProfile.major,
            occupation: userProfile.occupation,
            affiliation: userProfile.affiliation,
            role: userProfile.role,
            isVerified: isVerified || isCommunityVerified,
          },
        },
      }
    );
  } else {
    await communityModel.updateOne(
      { _id: communityId, 'users._id': user._id },
      {
        $set: {
          'users.$.isVerified': isVerified || isCommunityVerified,
        },
      }
    );
  }

  userProfile.followers =[]
  userProfile.following =[]
  userProfile.blockedUsers =[]
  userProfile.statusChangeHistory =[]

  return userProfile;
};

export const joinCommunityFromUniversity = async (userId: string, universityId: string, isVerified: boolean = false) => {
  const fetchUniversity = await UniversityModel.findById(universityId);
  if (!fetchUniversity) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }
  try {
    let community = await communityModel.findOne({ university_id: universityId });
    let userProfile = await userProfileService.getUserProfileById(userId);
    let numberOfUnverifiedJoinCommunity =
      userProfile?.communities?.reduce((acc, c) => (c?.isVerified === false ? acc + 1 : acc), 0) || 0;

    let isCommunityVerified = userProfile?.email.some(
      (userCommunity) => userCommunity.communityId.toString() === community?._id.toString()
    );
    if (numberOfUnverifiedJoinCommunity >= 1 && !isCommunityVerified) {
      throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'You can only join 1 community that is not verified');
    }
    if (!community) {
      const { _id: universityId, logo, campus, total_students, short_overview, name } = fetchUniversity as IUniversity;

      community = await communityModel.create({
        adminId: [config.DEFAULT_COMMUNITY_ADMIN_ID],
        name: name,
        communityLogoUrl: { imageUrl: logo },
        communityCoverUrl: { imageUrl: campus },
        total_students: total_students,
        university_id: universityId,
        created_by: userId,
        about: short_overview,
      });
      await UniversityModel.updateOne({ _id: universityId }, { $set: { communityId: community._id } });
    }
    const updatedUserProfile = await joinCommunity(
      convertToObjectId(userId),
      (community?._id).toString(),
      isCommunityVerified || isVerified
    );

    return { message: 'Joined successfully', data: { profile: updatedUserProfile, community: community } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, message);
  }
};

export const leaveCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  try {
    const { userProfile } = await getUserAndProfileOrThrow(String(userId));
    await getCommunityOrThrow(communityId);

    // Remove community from user's profile
    const communityIndex = userProfile.communities.findIndex((c) => c.communityId.toString() === communityId.toString());

    if (communityIndex === -1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a member of this community');
    }

    userProfile.communities.splice(communityIndex, 1);
    userProfile.communities = userProfile?.communities?.map((c) => {
        c.communityGroups = [];
        return c;
      }) || [];
    await userProfile.save();

    // Remove user from the community users list using atomic update
    await communityModel.updateOne({ _id: communityId }, { $pull: { users: { _id: userId } } });

    // Clean up user from any community groups
    await cleanUpUserFromCommunityGroups(userId, communityId);

    return {
      message: 'You have left the community',
      data: { communities: userProfile.communities },
    };
  } catch (error: unknown) {
    console.error('Error in leaveCommunity:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, message);
  }
};

export const getCommunityUsersByFilterService = async (communityId: string, options: GetCommunityUsersOptions) => {
  try {
    const { isVerified, searchQuery, page = 1, limit = 10, communityGroupId, userId } = options;

    const myProfile = await UserProfile.findOne({ users_id: userId }, { blockedUsers: 1 }).lean();

    const myBlockedUserIds = myProfile?.blockedUsers?.map((b: BlockedUserEntry) => convertToObjectId(b.userId.toString())) || [];

    const currentUserObjectId = convertToObjectId(options.userId);

    const communityGroup = communityGroupId
      ? await communityGroupService.getCommunityGroupByObjectId(communityGroupId as string)
      : null;
    const communityGroupUsers = communityGroup?.users.map((user) => user._id as mongoose.Types.ObjectId);

    const pipeline: PipelineStage[] = [...buildCommunityUsersBasePipeline(communityId)];

    const exclusionStage = buildCommunityGroupUsersExclusionStage(communityGroupUsers || []);
    if (exclusionStage) pipeline.push(exclusionStage);

    const verifiedStage = buildVerifiedUsersFilterStage(isVerified || false);
    if (verifiedStage) pipeline.push(verifiedStage);

    pipeline.push(...buildUserFieldsExtractionStage());
    pipeline.push(...buildUserProfileLookupStage());
    pipeline.push(buildBlockedUsersFilterStage(myBlockedUserIds, currentUserObjectId));
    pipeline.push(...buildUserLookupAndFilterStage());
    pipeline.push(buildUserFieldsAddStage());

    const searchStage = buildSearchQueryFilterStage(searchQuery || '');
    if (searchStage) pipeline.push(searchStage);

    pipeline.push(buildPaginationFacetStage(page, limit));

    const result = await communityModel.aggregate(pipeline);
    const data = result[0]?.data ?? [];
    const total = result[0]?.totalCount[0]?.total ?? 0;

    return {
      data,
      pagination: buildPaginationResponse(total, page, limit),
    };
  } catch (error: unknown) {
    console.error('Error in getCommunityUsersByFilterService:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, message);
  }
};

export const getCommunityUsersService = async (communityId: string, options: GetCommunityUsersOptions) => {
  try {
    const { isVerified, searchQuery, page = 1, limit = 10 } = options;

    const myProfile = await UserProfile.findOne({ users_id: options.userId }, { blockedUsers: 1 }).lean();
    const myBlockedUserIds =
      myProfile?.blockedUsers?.map((b: BlockedUserEntry) => convertToObjectId(b.userId.toString())) || [];
    const currentUserObjectId = convertToObjectId(options.userId);

    const community = await getCommunityOrThrow(communityId, { lean: true });

    let userList = community.users;
    if (isVerified) {
      userList = userList.filter((u) => u?.isVerified === true);
    }

    const userIds = userList.map((u) => u._id);

    const baseStages = buildCommunityUsersServiceBaseStages(userIds);
    const searchStage = buildCommunityUsersServiceSearchStage(searchQuery || '');
    const blockedFilterStage = buildBlockedUsersFilterStageForProfileRoot(myBlockedUserIds, currentUserObjectId);

    const dataPipeline: PipelineStage[] = [
      ...baseStages,
      blockedFilterStage,
      ...(searchStage ? [searchStage] : []),
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { user: 0,email:0,communities:0,following:0,followers:0,blockedUsers:0,statusChangeHistory:0 } },
    ];
    const countPipeline: PipelineStage[] = [
      ...baseStages,
      blockedFilterStage,
      ...(searchStage ? [searchStage] : []),
      { $count: 'total' },
    ];

    const [usersWithProfile, countResult] = await Promise.all([
      UserProfile.aggregate(dataPipeline),
      UserProfile.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      data: usersWithProfile,
      pagination: buildPaginationResponse(total, page, limit),
    };
  } catch (error: unknown) {
    console.error('Error in getCommunityUsersService:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, message);
  }
};

