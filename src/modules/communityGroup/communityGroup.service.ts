import mongoose, { Types, Document } from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfiles } from '../userProfile/userProfile.service';
import { communityGroupAccess } from '../../config/community.type';
import { communityGroupInterface } from './communityGroup.interface';
import { userProfileService } from '../userProfile';
import { communityGroupService } from '.';
import { notificationService } from '../Notification';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { communityService } from '../community';

type CommunityGroupDocument = Document & communityGroupInterface;

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: any) => {
  const { selectedGroupCategory, groupSubCategory } = body;
  let communityGroupToUpdate;

  communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityGroupToUpdate, body);
  if (selectedGroupCategory && groupSubCategory) {
    communityGroupToUpdate.communityGroupCategory = new Map([[selectedGroupCategory, groupSubCategory]]);
  }

  const updatedCommunityGroup = await communityGroupToUpdate.save();
  return updatedCommunityGroup;
};

export const deleteCommunityGroup = async (id: mongoose.Types.ObjectId) => {
  return await communityGroupModel.findByIdAndDelete(id);
};

export const getAllCommunityGroup = async (communityId: string, access: string) => {
  const accessType =
    access === communityGroupAccess.Public
      ? communityGroupAccess.Public
      : [communityGroupAccess.Public, communityGroupAccess.Private];
  return await communityGroupModel
    .find({ communityId, communityGroupType: accessType })
    .populate({ path: 'adminUserId', select: 'firstName lastName _id' });
};

export const getAllCommunityGroupWithUserProfiles = async (communityId: string, access: string) => {
  const communityGroups = await getAllCommunityGroup(communityId, access);

  const adminUserIds = communityGroups.map((group) => group.adminUserId._id);

  const userProfiles = await getUserProfiles(adminUserIds);

  const communityGroupsWithProfiles = communityGroups.map((group) => {
    const userProfile = userProfiles.find((profile) => profile.users_id.toString() === group.adminUserId._id.toString());
    return {
      ...group.toObject(),
      adminUserProfile: userProfile,
    };
  });

  return communityGroupsWithProfiles;
};

export const getCommunityGroupByUserId = async (userId: string) => {
  return await communityGroupModel.find({ adminUserId: userId });
};
export const getCommunityGroupByCommunity = async (communityId: string) => {
  return await communityGroupModel.findOne({ communityId: communityId });
};

export const getCommunityGroup = async (groupId: string): Promise<CommunityGroupDocument | null> => {
  // Validate the ObjectId
  if (!Types.ObjectId.isValid(groupId)) {
    return null;
  }

  // Find the community group and return it
  return (await communityGroupModel.findById(groupId)) as CommunityGroupDocument | null;
};

export const createCommunityGroup = async (body: any, communityId: string, userId: string) => {
  const { selectedGroupCategory, groupSubCategory, selectedUsers } = body;

  const userProfile = await userProfileService.getUserProfileById(String(userId));
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
  }
  const isUserAllowtoCreateGroup = userProfile?.email.some((item) => item.communityId === communityId);

  if (!isUserAllowtoCreateGroup) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not allowed to create group');
  }
  const createdGroup = await communityGroupModel.create({
    ...body,
    communityId: communityId,
    adminUserId: userId,
    communityGroupCategory: new Map().set(selectedGroupCategory, groupSubCategory),
  });

  await communityGroupService.joinCommunityGroup(userId, createdGroup._id.toString());

  if (selectedUsers?.length >= 1 && createdGroup?._id) {
    await notificationService.createManyNotification(
      createdGroup.adminUserId,
      createdGroup._id,
      selectedUsers,
      notificationRoleAccess.GROUP_INVITE,
      'recieved an invitation to join group'
    );
  }
  return createdGroup;
};

export const getCommunityGroupById = async (groupId: string) => {
  const communityGroup = await communityGroupModel.findById(groupId);
  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
  }
  return communityGroup;
};

export const joinCommunityGroup = async (userID: string, groupId: string) => {
  try {
    const [user, userProfile] = await Promise.all([
      getUserById(new mongoose.Types.ObjectId(userID)),
      userProfileService.getUserProfileById(String(userID)),
    ]);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
    }

    const communityGroup = await getCommunityGroup(groupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }

    const community = await communityService.getCommunity(String(communityGroup.communityId));
    const communityUsersID = community?.users.map((item) => item.id.toString());

    const userIDSet = new Set(communityUsersID);

    if (!userIDSet.has(userID)) throw new ApiError(httpStatus.NOT_FOUND, 'User not found in Community  ');

    const isUserVerifiedToJoin = userProfile.email.some((community) => {
      if (!community.communityId) return;
      return community.communityId.toString() === communityGroup.communityId.toString();
    });

    if (!isUserVerifiedToJoin) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User is not a member of this community');
    }

    const userAlreadyMember = communityGroup.users.some((user) => user.userId.toString() === userID);

    if (userAlreadyMember) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is already a member of this community');
    }

    communityGroup.users.push({
      userId: new mongoose.Types.ObjectId(userID),
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: userProfile.profile_dp?.imageUrl || null,
      universityName: userProfile.university_name as string,
      year: userProfile.study_year as string,
      degree: userProfile.degree as string,
      major: userProfile.major as string,
      isRequestAccepted: true,
    });

    await communityGroup.save();
    return communityGroup;
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error);
  }
};

export const usersJoinCommunityGroup = async (userIDs: string[], groupId: string) => {
  try {
    const communityGroup = await getCommunityGroup(groupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }

    for (const userID of userIDs) {
      const user = await getUserById(new mongoose.Types.ObjectId(userID));
      if (!user) {
        console.warn(`User not found for ID: ${userID}`);
        continue;
      }

      const userProfile = await userProfileService.getUserProfileById(String(userID));
      if (!userProfile) {
        console.warn(`User profile not found for ID: ${userID}`);
        continue;
      }

      const isUserVerifiedToJoin = userProfile.email.some(
        (community) => community.communityId.toString() === communityGroup.communityId.toString()
      );

      if (!isUserVerifiedToJoin) {
        console.warn(`User ID ${userID} is not a member of the required community`);
        continue;
      }

      const userAlreadyMember = communityGroup.users.some((groupUser) => groupUser.userId.toString() === userID);

      if (userAlreadyMember) {
        console.warn(`User ID ${userID} is already a member of the community group`);
        continue;
      }

      communityGroup.users.push({
        userId: new mongoose.Types.ObjectId(userID),
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: userProfile.profile_dp?.imageUrl || null,
        universityName: userProfile.university_name as string,
        year: userProfile.study_year as string,
        degree: userProfile.degree as string,
        major: userProfile.major as string,
        isRequestAccepted: true,
      });
    }

    await communityGroup.save();
    return communityGroup;
  } catch (error: any) {
    console.error('Error adding users to community group:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const leaveCommunityGroup = async (userID: string, groupId: string) => {
  try {
    const user = await getUserById(new mongoose.Types.ObjectId(userID));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const communityGroup = await getCommunityGroup(groupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }

    // Check if the user is a member of the communityGroup
    const userIndex = communityGroup.users.findIndex((groupUser) => groupUser.userId.toString() === userID);

    if (userIndex === -1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a member of this community');
    }

    // Remove the user from the community's users array
    communityGroup.users.splice(userIndex, 1);

    // Save the updated communityGroup
    await communityGroup.save();
    return communityGroup;
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'An error occurred');
  }
};
