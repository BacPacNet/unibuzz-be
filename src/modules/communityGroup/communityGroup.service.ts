import mongoose, { Types, Document } from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfiles } from '../userProfile/userProfile.service';
import { communityGroupType } from '../../config/community.type';
import { communityGroupInterface } from './communityGroup.interface';
import { userProfileService } from '../userProfile';

type CommunityGroupDocument = Document & communityGroupInterface;

export const createCommunityGroup = async (userID: string, communityId: any, body: any) => {
  const newGroup = { ...body, communityId: communityId, adminUserId: userID };
  return await communityGroupModel.create(newGroup);
};

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: any) => {
  let communityGroupToUpadate;
  communityGroupToUpadate = await communityGroupModel.findById(id);

  if (!communityGroupToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityGroupToUpadate, body);
  await communityGroupToUpadate.save();
  return communityGroupToUpadate;
};

export const deleteCommunityGroup = async (id: mongoose.Types.ObjectId) => {
  return await communityGroupModel.findByIdAndDelete(id);
};

export const getAllCommunityGroup = async (communityId: string, access: string) => {
  const accessType =
    access === communityGroupType.Public
      ? communityGroupType.Public
      : [communityGroupType.Public, communityGroupType.Private];
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

export const joinCommunityGroup = async (userID: string, groupId: string) => {
  try {
    const user = await getUserById(new mongoose.Types.ObjectId(userID));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    const userProfile = await userProfileService.getUserProfileById(String(userID));

    if (!userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
    }

    const communityGroup = await getCommunityGroup(groupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }
    const userVerifiedCommunityIds = user.userVerifiedCommunities.map((community) => community.communityId.toString()) || [];

    const userUnverifiedVerifiedCommunityIds =
      user.userUnVerifiedCommunities.map((community) => community.communityId.toString()) || [];
    if (
      !userVerifiedCommunityIds.includes(communityGroup.communityId.toString()) &&
      !userUnverifiedVerifiedCommunityIds.includes(communityGroup.communityId.toString())
    ) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User is not a member of this community');
    }
    // Check if the user is already a member of the communityGroup
    const userAlreadyMember = communityGroup.users.some((user) => user.userId.toString() === userID);

    if (userAlreadyMember) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is already a member of this community');
    }

    communityGroup.users.push({
      userId: new mongoose.Types.ObjectId(userID),
      firstName: user.firstName,
      lastName: user.lastName,
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
