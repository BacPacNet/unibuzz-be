import mongoose, { Types, Document } from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfiles } from '../userProfile/userProfile.service';
import { CommunityGroupAccess, CommunityGroupType } from '../../config/community.type';
import { communityGroupInterface, status } from './communityGroup.interface';
import { userProfileService } from '../userProfile';
import { communityGroupService } from '.';
import { notificationService } from '../Notification';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { communityService } from '../community';
import { io } from '../../index';

type CommunityGroupDocument = Document & communityGroupInterface;

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: any) => {
  const { selectedUsers, communityGroupType, communityGroupCategory, ...restBody } = body;

  let communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }

  communityGroupToUpdate.communityGroupType = communityGroupType;

  Object.assign(communityGroupToUpdate, restBody);

  if (communityGroupCategory && typeof communityGroupCategory === 'object') {
    communityGroupToUpdate.communityGroupCategory = new Map(Object.entries(communityGroupCategory));
  }

  if (Array.isArray(selectedUsers) && selectedUsers.length > 0) {
    communityGroupToUpdate.users.push(...selectedUsers);
  }

  await communityGroupToUpdate.save();
};

export const acceptCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!Types.ObjectId.isValid(communityGroupId) || !userId) {
      throw new Error('Invalid communityGroupId or userId');
    }
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users.userId': userId },
      {
        $set: {
          'users.$.isRequestAccepted': true,
          'users.$.status': status.accepted,
        },
      },
      { new: true }
    );

    if (!updatedGroup) {
      throw new Error('Community group or user not found');
    }

    return updatedGroup;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const rejectCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!Types.ObjectId.isValid(communityGroupId) || !userId) {
      throw new Error('Invalid communityGroupId or userId');
    }
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users.userId': userId },
      {
        $set: {
          'users.$.isRequestAccepted': false,
          'users.$.status': status.rejected,
        },
      },
      { new: true }
    );

    if (!updatedGroup) {
      throw new Error('Community group or user not found');
    }

    return updatedGroup;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const RejectCommunityGroupApproval = async (id: mongoose.Types.ObjectId) => {
  let communityGroupToUpdate;

  communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }

  communityGroupToUpdate.status = status.rejected;

  const updatedCommunityGroup = await communityGroupToUpdate.save();
  return updatedCommunityGroup;
};
export const AcceptCommunityGroupApproval = async (id: mongoose.Types.ObjectId) => {
  let communityGroupToUpdate;

  communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }

  communityGroupToUpdate.status = status.accepted;
  communityGroupToUpdate.communityGroupType = CommunityGroupType.OFFICIAL;

  const updatedCommunityGroup = await communityGroupToUpdate.save();
  return updatedCommunityGroup;
};

export const deleteCommunityGroup = async (id: mongoose.Types.ObjectId) => {
  return await communityGroupModel.findByIdAndDelete(id);
};

export const getAllCommunityGroup = async (communityId: string, access: string) => {
  const accessType =
    access === CommunityGroupAccess.Public
      ? CommunityGroupAccess.Public
      : [CommunityGroupAccess.Public, CommunityGroupAccess.Private];
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
  if (!Types.ObjectId.isValid(groupId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid community group ID');
  }
  return (await communityGroupModel.findById(groupId)) as CommunityGroupDocument | null;
};

export const createCommunityGroup = async (body: any, communityId: string, userId: string) => {
  const { communityGroupCategory, selectedUsers, communityGroupType } = body;

  const userProfile = await userProfileService.getUserProfileById(String(userId));
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');
  }
  const isUserAllowtoCreateGroup = userProfile?.email.some((item) => item.communityId === communityId);

  if (!isUserAllowtoCreateGroup) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not allowed to create group');
  }

  const groupStatus = communityGroupType?.toLowerCase() === CommunityGroupType.OFFICIAL ? status.pending : status.default;
  const createdGroup = await communityGroupModel.create({
    ...body,
    communityGroupType: CommunityGroupType.CASUAL,
    status: groupStatus,
    communityId: communityId,
    adminUserId: userId,
    communityGroupCategory,
  });

  await communityGroupService.joinCommunityGroup(userId, createdGroup._id.toString(), true);

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
  const communityGroup = await communityGroupModel
    .findById(groupId)
    .populate({
      path: 'communityId', // Assuming this is the reference to communityModel
      select: 'communityLogoUrl', // Selecting only the communityLogo field
    })
    .lean();

  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
  }

  return communityGroup;
};

export const joinCommunityGroup = async (userID: string, groupId: string, isAdmin: boolean = false) => {
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

    //check if community is private and user is verified
    const isCommunityPrivate = communityGroup?.communityGroupAccess === CommunityGroupAccess.Private;
    const isUserVerified = userProfile?.email.some(
      (community) => community.communityId.toString() === communityGroup.communityId._id.toString()
    );

    if (!isUserVerified && isCommunityPrivate) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not verified to join this community');
    }

    const community = await communityService.getCommunity(String(communityGroup.communityId));
    const communityUsersID = community?.users.map((item) => item.id.toString());

    const userIDSet = new Set(communityUsersID);

    if (!userIDSet.has(userID)) throw new ApiError(httpStatus.NOT_FOUND, 'User not found in Community  ');

    const isUserVerifiedToJoin = userProfile.communities.some(
      (community) => community.communityId.toString() === communityGroup.communityId.toString()
    );

    if (!isUserVerifiedToJoin) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User is not a member of this community');
    }

    const userAlreadyMember = communityGroup.users.some(
      (user) => user.userId.toString() === userID && user.isRequestAccepted
    );

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
      isRequestAccepted: isAdmin ? true : isCommunityPrivate ? false : true,
      status: isAdmin ? status.accepted : isCommunityPrivate ? status.pending : status.accepted,
      occupation: userProfile.occupation as string,
      affiliation: userProfile.affiliation as string,
      role: userProfile.role,
    });
    await communityGroup.save();

    if (isCommunityPrivate && !isAdmin) {
      const notificationPayload = {
        sender_id: userID,
        receiverId: communityGroup.adminUserId,
        communityGroupId: communityGroup._id,
        type: notificationRoleAccess.PRIVATE_GROUP_REQUEST,
        message: 'User has requested to join your private group',
      };
      await notificationService.CreateNotification(notificationPayload);
      io.emit(`notification_${communityGroup.adminUserId}`, { type: notificationRoleAccess.PRIVATE_GROUP_REQUEST });
      return { success: true, message: 'Request sent successfully' };
    } else {
      return { success: true, message: 'Successfully joined the community group', data: communityGroup };
    }
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

export const acceptPrivateCommunityGroupRequest = async (userId: string, communityGroupId: string) => {
  try {
    if (!communityGroupId || !userId) {
      throw new Error('Invalid communityGroupId or userId');
    }
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users.userId': userId },
      {
        $set: {
          'users.$.isRequestAccepted': true,
          'users.$.status': status.accepted,
        },
      },
      { new: true }
    );

    if (!updatedGroup) {
      throw new Error('Community group or user not found');
    }

    return updatedGroup;
  } catch (error: any) {
    throw new Error(error.message);
  }
};
