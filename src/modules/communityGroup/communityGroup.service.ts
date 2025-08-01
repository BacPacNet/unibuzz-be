import mongoose, { Types, Document } from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfileById, getUserProfiles } from '../userProfile/userProfile.service';
import { CommunityGroupAccess, CommunityGroupType } from '../../config/community.type';
import { communityGroupInterface, status } from './communityGroup.interface';
import { UserProfile, userProfileService } from '../userProfile';
import { communityGroupService } from '.';
import { notificationModel, notificationService } from '../Notification';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { communityService } from '../community';
import { io } from '../../index';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import { convertToObjectId } from '../../utils/common';
import { sendPushNotification } from '../pushNotification/pushNotification.service';

type CommunityGroupDocument = Document & communityGroupInterface;

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: any) => {
  const { selectedUsers = [], communityGroupCategory, ...restBody } = body;

  const communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found!');
  }

  // Assign all basic fields (excluding selectedUsers and category)
  Object.assign(communityGroupToUpdate, restBody);

  // Update category map if provided
  if (communityGroupCategory && typeof communityGroupCategory === 'object') {
    communityGroupToUpdate.communityGroupCategory = new Map(Object.entries(communityGroupCategory));
  }

  // Add new unique users to the group
  if (Array.isArray(selectedUsers) && selectedUsers.length > 0) {
    const existingUserIds = new Set(communityGroupToUpdate.users.map((u) => u._id.toString()));

    const newUsers = selectedUsers.filter((user) => !existingUserIds.has(user._id.toString()));

    if (newUsers.length > 0) {
      communityGroupToUpdate.users.push(...newUsers);
    }

    // Create notifications for newly added users
    await notificationService.createManyNotification(
      communityGroupToUpdate.adminUserId,
      communityGroupToUpdate._id,
      newUsers,
      notificationRoleAccess.GROUP_INVITE,
      'received an invitation to join group'
    );
  }

  await communityGroupToUpdate.save();
};

export const acceptCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!Types.ObjectId.isValid(communityGroupId) || !userId) {
      throw new Error('Invalid communityGroupId or userId');
    }
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users._id': convertToObjectId(userId) },
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

    const communityId = updatedGroup.communityId;

    const userProfile = await getUserProfileById(userId);

    await UserProfile.updateOne(
      {
        _id: userProfile?._id,
        'communities.communityId': communityId,
        'communities.communityGroups.id': communityGroupId,
      },
      {
        $set: {
          'communities.$[community].communityGroups.$[group].status': status.accepted,
        },
      },
      {
        arrayFilters: [{ 'community.communityId': communityId }, { 'group.id': communityGroupId }],
      }
    );

    return updatedGroup;
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message);
  }
};

export const rejectCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!Types.ObjectId.isValid(communityGroupId) || !userId) {
      throw new Error('Invalid communityGroupId or userId');
    }
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users._id': userId },
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
    const communityId = updatedGroup.communityId;

    const userProfile = await getUserProfileById(userId);

    await UserProfile.updateOne(
      {
        _id: userProfile?._id,
        'communities.communityId': communityId,
        'communities.communityGroups.id': communityGroupId,
      },
      {
        $set: {
          'communities.$[community].communityGroups.$[group].status': status.rejected,
        },
      },
      {
        arrayFilters: [{ 'community.communityId': communityId }, { 'group.id': communityGroupId }],
      }
    );

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Get the group before deleting
    const groupToDelete = await communityGroupModel.findById(id).session(session);
    if (!groupToDelete) {
      throw new Error('Community group not found');
    }

    const receiverIds = groupToDelete.users
      .map((user) => user._id)
      .filter((id) => id, toString() !== groupToDelete.adminUserId.toString());

    // Delete the community group
    await communityGroupModel.findByIdAndDelete(id, { session });

    // Delete notifications with that communityGroupId
    await notificationModel.deleteMany({ communityGroupId: id }, { session });

    // Get all posts under the community group
    const posts = await CommunityPostModel.find({ communityGroupId: id }, '_id', { session });
    const postIds = posts.map((post) => post._id);

    // Delete all comments associated with those posts
    if (postIds.length > 0) {
      await communityPostCommentsModel.deleteMany({ postId: { $in: postIds } }, { session });
    }

    // Delete the posts themselves
    await CommunityPostModel.deleteMany({ communityGroupId: id }, { session });

    const jobData = {
      adminId: groupToDelete.adminUserId.toString(),
      communityGroupId: groupToDelete._id.toString(),
      receiverIds: receiverIds,
      type: notificationRoleAccess.DELETED_COMMUNITY_GROUP,
      message: `${groupToDelete.title} group has been deleted by admin`,
    };

    await notificationQueue.add(NotificationIdentifier.delete_community_group, jobData);

    await session.commitTransaction();
    session.endSession();
    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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
      (community) => community.communityId.toString() === communityGroup.communityId?.toString()
    );

    if (!isUserVerified && isCommunityPrivate) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not verified to join this community');
    }

    const community = await communityService.getCommunity(String(communityGroup.communityId));
    const communityUsersID = community?.users.map((item) => item._id.toString());

    const userIDSet = new Set(communityUsersID);

    if (!userIDSet.has(userID)) throw new ApiError(httpStatus.NOT_FOUND, 'User not found in Community  ');
    // const isUserVerifiedToJoin = userProfile.communities.some(
    //   (community) => community.communityId.toString() === communityGroup.communityId.toString()
    // );

    // if (!isUserVerified) {
    //   throw new ApiError(httpStatus.NOT_FOUND, 'User is not a member of this community');
    // }

    const userAlreadyMember = communityGroup.users.some((user) => user._id.toString() === userID && user.isRequestAccepted);

    if (userAlreadyMember) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is already a member of this community');
    }

    communityGroup.users.push({
      _id: new mongoose.Types.ObjectId(userID),
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

    const updateUserProfile = await UserProfile.findOneAndUpdate(
      {
        _id: userProfile._id,
        'communities.communityId': communityGroup.communityId,
      },
      {
        $push: {
          'communities.$.communityGroups': {
            id: groupId,
            status: isAdmin ? status.accepted : isCommunityPrivate ? status.pending : status.accepted,
          },
        },
      },
      {
        new: true,
        returnDocument: 'after',
      }
    );

    //const joinCommunity = userProfile.communities.find(
    //  (c) => c.communityId.toString() === communityGroup.communityId.toString()
    //) as UserCommunities;

    //if (joinCommunity) {
    //  const newGroupMember: UserCommunityGroup = {
    //    id: groupId,
    //    status: isAdmin ? status.accepted : isCommunityPrivate ? status.pending : status.accepted,
    //  };

    //  // Initialize array if it doesn't exist
    //  if (!joinCommunity.communityGroup) {
    //    joinCommunity.communityGroup = [];
    //  }

    //  joinCommunity.communityGroup.push(newGroupMember);

    //  // Explicitly mark the modified path
    //  userProfile.markModified('communities');

    //  userProfile.communities, 'userProfile');
    //  await userProfile.save();
    //}

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
      sendPushNotification(communityGroup.adminUserId.toString(), 'Private Group Request', user.firstName+" has requested to join your private group" + communityGroup.title ,{
        sender_id: userID,
        receiverId: communityGroup.adminUserId.toString(),
        type: notificationRoleAccess.PRIVATE_GROUP_REQUEST,
      });
      
      return { success: true, message: 'Request sent successfully', isGroupPrivate: true };
    } else {
      return {
        success: true,
        message: 'Successfully joined the community group',
        data: { communityGroup, communities: updateUserProfile?.communities, isGroupPrivate: false },
      };
    }
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error);
  }
};

export const leaveCommunityGroup = async (userID: string, groupId: string) => {
  try {
    // Fetch required data in parallel
    const [user, communityGroup, userProfile] = await Promise.all([
      getUserById(new mongoose.Types.ObjectId(userID)),
      getCommunityGroup(groupId),
      userProfileService.getUserProfileById(userID),
    ]);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }
    if (!userProfile) throw new ApiError(httpStatus.NOT_FOUND, 'User profile not found');

    // Check if the user is a member of the communityGroup
    const userIndex = communityGroup.users.findIndex((groupUser) => groupUser._id.toString() === userID);

    if (userIndex === -1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a member of this community');
    }

    // Remove the user from the community's users array
    communityGroup.users.splice(userIndex, 1);

    // Save the updated communityGroup
    await communityGroup.save();

    // Find the community that contains this group
    const communityIndex = userProfile.communities.findIndex((community) =>
      community.communityGroups.some((group) => group.id.toString() === groupId)
    );

    if (communityIndex !== -1) {
      // Filter out the group from the communityGroup array
      userProfile.communities[communityIndex]!.communityGroups = userProfile.communities[
        communityIndex
      ]!.communityGroups.filter((group) => group.id.toString() !== groupId);

    }

    const updatedUserProfile = await userProfile.save();

    return { communityGroup, communities: updatedUserProfile.communities };
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

    console.log(communityGroupId, userId);
    const updatedGroup = await communityGroupModel.findOneAndUpdate(
      { _id: communityGroupId, 'users._id': userId },
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
