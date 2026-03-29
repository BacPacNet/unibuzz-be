import mongoose, { Types } from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfileById, getUserProfiles } from '../userProfile/userProfile.service';
import { CommunityGroupAccess, CommunityGroupType } from '../../config/community.type';
import {
  communityGroupInterface,
  status,
  UpdateCommunityGroupBody,
  CreateCommunityGroupBody,
  users as UsersSchema,
  UserLike,
  ProfileLike,
  UserIdLike,
  PopulatedAdminLike,
  BlockedUserRef,
  MemberProfileLean,
  MemberWithVerified,
  CommunityGroupDocument,
  SelectedUserItem,
} from './communityGroup.interface';
import { UserProfile, userProfileService } from '../userProfile';
import { notificationModel, notificationService } from '../Notification';
import { CreateNotificationPayload, notificationRoleAccess } from '../Notification/notification.interface';
import { communityModel, communityService } from '../community';
import { io } from '../../index';
import CommunityPostModel from '../communityPosts/communityPosts.model';
import communityPostCommentsModel from '../communityPostsComments/communityPostsComments.model';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import { convertToObjectId, isValidObjectId } from '../../utils/common';
import { sendPushNotification } from '../pushNotification/pushNotification.service';
import { User } from '../user';
import {
  buildCommunityGroupMembersDataPipeline,
  buildCommunityGroupMembersCountPipeline,
} from './communityGroup.pipeline';
import { UserCommunities } from '../userProfile/userProfile.interface';

/** Error messages used in this service (constants to avoid typos and simplify i18n later) */
const ERROR_MESSAGES = {
  COMMUNITY_GROUP_NOT_FOUND: 'Community group not found',
  COMMUNITY_GROUP_NOT_FOUND_OR_USER: 'Community group or user not found',
  COMMUNITY_GROUP_OR_USER_NOT_FOUND_IN_GROUP: 'Community group or user not found in group',
  USER_PROFILE_NOT_FOUND: 'User profile not found',
  USER_NOT_FOUND: 'User not found',
  USER_NOT_FOUND_IN_COMMUNITY: 'User not found in Community',
  INVALID_COMMUNITY_GROUP_ID_OR_USER_ID: 'Invalid communityGroupId or userId',
  INVALID_COMMUNITY_GROUP_ID: 'Invalid community group ID',
  INVALID_COMMUNITY_GROUP_ID_SHORT: 'Invalid communityGroupId',
  USER_NOT_ALLOWED_TO_CREATE_GROUP: 'User is not allowed to create group',
  COMMUNITY_GROUP_DOES_NOT_EXIST: 'Community group does not exist',
  COMMUNITY_GROUP_IS_NOT_LIVE: 'Community group is not live',
  VERIFY_UNIVERSITY_EMAIL_FOR_PRIVATE: 'You need to verify your university email to join private groups',
  BLOCKED_FROM_GROUP: 'You are blocked from this community group',
  NOT_VERIFIED_TO_JOIN: 'You are not verified to join this community',
  ALREADY_A_MEMBER: 'User is already a member of this community',
  NOT_A_MEMBER: 'User is not a member of this community',
  COMMUNITY_REFERENCE_MISSING: 'Community reference missing in group',
  ERROR_APPROVING_REQUEST: 'Error approving request',
  ERROR_REJECTING_REQUEST: 'Error rejecting request',
  ERROR_ACCEPTING_PRIVATE_GROUP_REQUEST: 'Error accepting private group request',
  ERROR_FETCHING_MEMBERS: 'Error fetching community group members',
} as const;

function buildGroupMemberFromUserAndProfile(
  user: UserLike,
  profile: ProfileLike,
  options: { isRequestAccepted: boolean; status: status }
): {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  universityName: string;
  year: string;
  degree: string;
  major: string;
  isRequestAccepted: boolean;
  status: status;
  occupation: string;
  affiliation: string;
  role: string | undefined;
} {
  if (!user._id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User _id is required to build group member');
  }
  return {
    _id: user._id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    profileImageUrl: profile.profile_dp?.imageUrl ?? null,
    universityName: profile.university_name ?? '',
    year: profile.study_year ?? '',
    degree: profile.degree ?? '',
    major: profile.major ?? '',
    occupation: profile.occupation ?? '',
    affiliation: profile.affiliation ?? '',
    role: profile.role,
    isRequestAccepted: options.isRequestAccepted,
    status: options.status,
  };
}

/**
 * Updates a single member's request status in a community group (users subdocument).
 * Returns the updated group document or null if group or user in group not found.
 */
async function updateGroupMemberStatus(
  communityGroupId: mongoose.Types.ObjectId | string,
  userId: string,
  isRequestAccepted: boolean,
  memberStatus: status
) {
  const groupId =
    typeof communityGroupId === 'string' ? new mongoose.Types.ObjectId(communityGroupId) : communityGroupId;
  const userIdObj = convertToObjectId(userId);
  return communityGroupModel.findOneAndUpdate(
    { _id: groupId, 'users._id': userIdObj },
    { $set: { 'users.$.isRequestAccepted': isRequestAccepted, 'users.$.status': memberStatus } },
    { new: true }
  );
}

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: UpdateCommunityGroupBody) => {
  const { selectedUsers = [], communityGroupCategory, communityGroupAccess, title, ...restBody } = body;

  const communityGroup = await communityGroupModel.findById(id);
  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
  }

  const existingGroup = await communityGroupModel.findOne({
    communityId: communityGroup.communityId,
    title: { $regex: new RegExp(`^${title}$`, 'i') },
  });

  if (existingGroup && communityGroup.title !== title) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      JSON.stringify({ for: 'title', message: 'Community group with same name already exists' })
    );
  }

  if (
    communityGroupAccess &&
    communityGroupAccess === CommunityGroupAccess.Private &&
    communityGroup.communityGroupAccess === CommunityGroupAccess.Public
  ) {
    const community = await communityModel.findById(communityGroup.communityId).select('users');

    const unverifiedUserIds = community?.users?.filter((user) => !user.isVerified).map((user) => user._id.toString()) ?? [];

    const hasUnverifiedUsersInGroup = communityGroup.users.some(
      (user) => unverifiedUserIds.includes(user._id.toString()) && user.status !== status.pending
    );

    if (hasUnverifiedUsersInGroup) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        JSON.stringify({
          for: 'communityGroupAccess',
          message: 'To switch to a private group, all members must be verified.',
        })
      );
    }
  }

  if (communityGroupAccess) {
    communityGroup.communityGroupAccess = communityGroupAccess;
  }
  if (title !== undefined) {
    communityGroup.title = title;
  }

  Object.assign(communityGroup, restBody);

  if (communityGroupCategory && typeof communityGroupCategory === 'object') {
    communityGroup.communityGroupCategory = new Map(Object.entries(communityGroupCategory));
  }

  if (Array.isArray(selectedUsers) && selectedUsers.length > 0) {
    const existingUserIds = new Set(
      communityGroup.users.filter((user) => user.isRequestAccepted).map((u) => u._id.toString())
    );

    const newUsers = selectedUsers.filter((user) => !existingUserIds.has(user?.users_id?.toString() ?? ''));

    if (newUsers.length > 0) {
      await notificationService.createManyNotification(
        communityGroup.adminUserId,
        communityGroup._id,
        newUsers,
        notificationRoleAccess.GROUP_INVITE,
        'received an invitation to join group'
      );
    }
  }

  await communityGroup.save();
};

export const acceptCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!isValidObjectId(communityGroupId) || !userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID_OR_USER_ID);
    }

    const communityGroup = await communityGroupModel.findById(communityGroupId);
    const userProfile = await getUserProfileById(userId);

    if (!userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
    }

    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
    }

    if (communityGroup.communityGroupAccess === CommunityGroupAccess.Private) {
      if (!userProfile) {
        throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
      }

      const hasMatchingUniversity = userProfile.email?.some(
        (emailObj: any) => emailObj.communityId?.toString() === communityGroup.communityId?.toString()
      );

      if (!hasMatchingUniversity) {
        throw new ApiError(httpStatus.FORBIDDEN, ERROR_MESSAGES.VERIFY_UNIVERSITY_EMAIL_FOR_PRIVATE);
      }
    }

    const updatedGroup = await updateGroupMemberStatus(
      communityGroupId,
      userId,
      true,
      status.accepted
    );

    if (!updatedGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_OR_USER_NOT_FOUND_IN_GROUP);
    }

    const communityId = updatedGroup.communityId;

   

    const hasCommunityGroup = userProfile.communities.some(
      (c) =>
        c.communityId.toString() === communityId.toString() &&
        c.communityGroups?.some((g) => g.id.toString() === communityGroupId.toString())
    );

    if (hasCommunityGroup) {
      await UserProfile.updateOne(
        {
          _id: userProfile._id,
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
    } else {
      await UserProfile.updateOne(
        {
          _id: userProfile._id,
          'communities.communityId': communityId,
        },
        {
          $push: {
            'communities.$.communityGroups': {
              id: communityGroupId,
              status: status.accepted,
            },
          },
        }
      );
    }

    return updatedGroup;
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || ERROR_MESSAGES.ERROR_APPROVING_REQUEST);
  }
};

export const rejectCommunityGroupJoinApproval = async (communityGroupId: mongoose.Types.ObjectId, userId: string) => {
  try {
    if (!isValidObjectId(communityGroupId) || !userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID_OR_USER_ID);
    }

    const userProfile = await getUserProfileById(userId);
    if (!userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
    }

    const updatedGroup = await updateGroupMemberStatus(
      communityGroupId,
      userId,
      false,
      status.rejected
    );

    if (!updatedGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND_OR_USER);
    }
    const communityId = updatedGroup.communityId;

    await UserProfile.updateOne(
      {
        _id: userProfile._id,
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
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || ERROR_MESSAGES.ERROR_REJECTING_REQUEST);
  }
};

export const rejectCommunityGroupApproval = async (id: mongoose.Types.ObjectId) => {
  const groupToDelete = await communityGroupModel.findById(id);
  if (!groupToDelete) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
  }
  await communityGroupModel.findByIdAndDelete(id);
};

export const acceptCommunityGroupApproval = async (id: mongoose.Types.ObjectId, adminIds: string[] = []) => {
  const communityGroupToUpdate = await communityGroupModel.findById(id);

  if (!communityGroupToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
  }

  communityGroupToUpdate.status = status.accepted;
  communityGroupToUpdate.communityGroupType = CommunityGroupType.OFFICIAL;
  communityGroupToUpdate.isCommunityGroupLive = true;

  if (communityGroupToUpdate?.inviteUsers?.length > 0) {
    const adminIdSet = new Set(adminIds.map(String));

    const inviteUsers = communityGroupToUpdate.inviteUsers
      .map((user) => ({
        users_id: user.userId.toString(),
      }))
      .filter((user) => !adminIdSet.has(user.users_id));

    if (inviteUsers.length > 0) {
      await notificationService.createManyNotification(
        communityGroupToUpdate.adminUserId,
        communityGroupToUpdate._id,
        inviteUsers,
        notificationRoleAccess.GROUP_INVITE,
        'received an invitation to join group'
      );
    }
  }

  const allAdminIds = Array.from(new Set(adminIds.map(String)));

  const adminUsersData = await Promise.all(
    allAdminIds.map(async (adminId) => {
      const [userDetails, userProfile] = await Promise.all([
        getUserById(new mongoose.Types.ObjectId(adminId)),
        getUserProfileById(adminId),
      ]);

      if (!userDetails || !userProfile) return null;

      return buildGroupMemberFromUserAndProfile(userDetails, userProfile, {
        isRequestAccepted: true,
        status: status.accepted,
      });
    })
  );

  const validAdminUsers = adminUsersData.filter(Boolean);

  const existingUserIds = new Set(communityGroupToUpdate.users.map((u) => u._id.toString()));

  for (const adminUser of validAdminUsers) {
    const adminUserId = adminUser?._id?.toString();
    if (adminUserId && !existingUserIds.has(adminUserId)) {
      communityGroupToUpdate.users.push(adminUser as unknown as UsersSchema);

      await UserProfile.findOneAndUpdate(
        {
          _id: adminUser!._id,
          'communities.communityId': communityGroupToUpdate.communityId,
        },
        {
          $push: {
            'communities.$.communityGroups': {
              id: communityGroupToUpdate._id,
              status: status.accepted,
            },
          },
        },
        {
          new: true,
          returnDocument: 'after',
        }
      );
    }
  }

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
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
    }

    const receiverIds = groupToDelete.users
      .map((user) => user._id)
      .filter((id) => id?.toString() !== groupToDelete.adminUserId.toString());

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
    await queueSQSNotification(jobData);

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
  if (!isValidObjectId(groupId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID);
  }
  return (await communityGroupModel.findById(groupId)) as CommunityGroupDocument | null;
};

export const getCommunityGroupByObjectId = async (groupId: string): Promise<CommunityGroupDocument | null> => {
  if (!isValidObjectId(groupId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID);
  }

  const objectId = new mongoose.Types.ObjectId(groupId);
  return (await communityGroupModel.findById(objectId)) as CommunityGroupDocument | null;
};

export const createCommunityGroup = async (
  body: CreateCommunityGroupBody,
  communityId: string,
  userId: string,
  isOfficial: boolean,
  isAdminOfCommunity: boolean = false
) => {
  const { communityGroupCategory, selectedUsers, communityGroupType, communityGroupLabel } = body;

  const userProfile = await userProfileService.getUserProfileById(String(userId));
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
  }
  const isUserAllowtoCreateGroup = userProfile?.email.some((item) => item.communityId === communityId);

  if (!isUserAllowtoCreateGroup) {
    throw new ApiError(httpStatus.FORBIDDEN, ERROR_MESSAGES.USER_NOT_ALLOWED_TO_CREATE_GROUP);
  }

  const inviteUsers = (selectedUsers ?? []).map((user: SelectedUserItem) => ({
    userId: user.users_id,
  }));

  const groupStatus =
    isAdminOfCommunity && communityGroupType?.toLowerCase() === CommunityGroupType.OFFICIAL
      ? status.accepted
      : !isAdminOfCommunity && communityGroupType?.toLowerCase() === CommunityGroupType.OFFICIAL
      ? status.pending
      : status.default;
  const createdGroup = await communityGroupModel.create({
    ...body,
    communityGroupType: groupStatus == status.accepted ? CommunityGroupType.OFFICIAL : CommunityGroupType.CASUAL,
    communityGroupLabel: communityGroupLabel,
    status: groupStatus,
    communityId: communityId,
    adminUserId: userId,
    communityGroupCategory,
    isCommunityGroupLive: groupStatus == status.accepted || groupStatus == status.default ? true : false,
    inviteUsers: inviteUsers,
  });

  await joinCommunityGroup(
    userId,
    createdGroup._id.toString(),
    true,
    isOfficial && isAdminOfCommunity
  );

  const selectedUsersList = selectedUsers ?? [];
  if (selectedUsersList.length >= 1 && createdGroup?._id && (!isOfficial || isAdminOfCommunity)) {
    await notificationService.createManyNotification(
      createdGroup.adminUserId,
      createdGroup._id,
      selectedUsersList,
      notificationRoleAccess.GROUP_INVITE,
      'received an invitation to join group'
    );
  }
  return createdGroup;
};

export const getCommunityGroupById = async (groupId: string, userId: string) => {
  const communityGroup = (await communityGroupModel
    .findById(groupId)
    .populate({
      path: 'communityId',
      select: 'communityLogoUrl adminId name',
    })
    .lean()) as communityGroupInterface & {
    communityId: { communityLogoUrl: string; adminId: string[]; name: string };
  };

  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
  }

  const communityAdminId = communityGroup?.communityId?.adminId?.map(String).includes(userId?.toString() || '');

  const populatedGroup = await communityGroupModel.populate(communityGroup, [
    { path: 'adminUserId', select: 'isDeleted  blockedUsers' },
  ]);

  const myBlockedUsers = await UserProfile.findOne({ users_id: userId }).select('blockedUsers').lean();

  const userIds = (populatedGroup.users || []).map((u: UsersSchema) => u._id);

  const deletedUsers = await User.find({ _id: { $in: userIds }, isDeleted: true }, { _id: 1 }).lean();

  const deletedUserIds = new Set(
    (deletedUsers as UserIdLike[]).map((u) => (u as UserIdLike)._id.toString())
  );

  const adminUserObj = populatedGroup.adminUserId as PopulatedAdminLike;
  const adminUserId =
    typeof adminUserObj === 'object' && adminUserObj !== null && '_id' in adminUserObj
      ? adminUserObj._id.toString()
      : String(adminUserObj);

  if (adminUserObj?.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_DOES_NOT_EXIST);
  }
  if (adminUserObj && adminUserObj?.blockedUsers && adminUserObj?.blockedUsers?.length > 0) {
    const isBlocked = adminUserObj?.blockedUsers.some(
      (user) => (user as unknown as BlockedUserRef).userId.toString() === userId?.toString()
    );
    if (isBlocked) {
      throw new ApiError(httpStatus.FORBIDDEN, ERROR_MESSAGES.BLOCKED_FROM_GROUP);
    }
  }
  if (myBlockedUsers && myBlockedUsers?.blockedUsers && myBlockedUsers?.blockedUsers?.length > 0) {
    const isBlocked = myBlockedUsers?.blockedUsers.some(
      (user) => (user as unknown as BlockedUserRef).userId.toString() === adminUserId?.toString()
    );
    if (isBlocked) {
      throw new ApiError(httpStatus.FORBIDDEN, ERROR_MESSAGES.BLOCKED_FROM_GROUP);
    }
  }

  const memberProfiles = await UserProfile.find({ users_id: { $in: userIds } }, { users_id: 1, blockedUsers: 1 }).lean();

  const memberBlockedMap = new Map(
    (memberProfiles as unknown as MemberProfileLean[]).map((p) => [
      p.users_id.toString(),
      new Set((p.blockedUsers || []).map((b) => (b as unknown as BlockedUserRef).userId.toString())),
    ])
  );
  const myBlockedUserIds = new Set(
    myBlockedUsers?.blockedUsers?.map((b) => (b as unknown as BlockedUserRef).userId.toString()) || []
  );
  populatedGroup.users = populatedGroup.users.filter((u: UsersSchema) => {
    const memberId = u._id.toString();

    if (deletedUserIds.has(memberId)) return false;

    if (myBlockedUserIds.has(memberId)) return false;

    const memberBlockedSet = memberBlockedMap.get(memberId);
    if (memberBlockedSet?.has(userId.toString())) return false;

    return true;
  });
  if (!populatedGroup.isCommunityGroupLive && adminUserId !== userId && !communityAdminId) {
    throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_IS_NOT_LIVE);
  }

  if (Array.isArray(populatedGroup.users)) {
    populatedGroup.users.sort((a: UsersSchema, b: UsersSchema) => {
      const isAAdmin = a._id.toString() === adminUserId;
      const isBAdmin = b._id.toString() === adminUserId;

      if (isAAdmin && !isBAdmin) return -1;
      if (!isAAdmin && isBAdmin) return 1;

      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase());
    });
  }

  return populatedGroup;
};

export const joinCommunityGroup = async (
  userID: string,
  groupId: string,
  isAdmin: boolean = false,
  isCreatorAdmin: boolean = false
) => {
  try {
    const [user, userProfile] = await Promise.all([
      getUserById(new mongoose.Types.ObjectId(userID)),
      userProfileService.getUserProfileById(String(userID)),
    ]);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (!userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
    }

    const communityGroup = await getCommunityGroup(groupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
    }

    if (!communityGroup.isCommunityGroupLive && communityGroup.adminUserId.toString() !== userID) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_IS_NOT_LIVE);
    }

    //check if community is private and user is verified
    const isCommunityPrivate = communityGroup?.communityGroupAccess === CommunityGroupAccess.Private;
    const isUserVerified = userProfile?.email.some(
      (community) => community.communityId.toString() === communityGroup.communityId?.toString()
    );

    if (!isUserVerified && isCommunityPrivate) {
      throw new ApiError(httpStatus.FORBIDDEN, ERROR_MESSAGES.NOT_VERIFIED_TO_JOIN);
    }

    const community = await communityService.getCommunity(String(communityGroup.communityId));
    const communityUsersID = community?.users.map((item) => item._id.toString());
    const communityAdminIds = community?.adminId?.map(String);

    const userIDSet = new Set(communityUsersID);

    if (!userIDSet.has(userID)) throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND_IN_COMMUNITY);

    const userAlreadyMember = communityGroup.users.some((user) => user._id.toString() === userID && user.isRequestAccepted);

    if (userAlreadyMember) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.ALREADY_A_MEMBER);
    }

    communityGroup.users.push(
      buildGroupMemberFromUserAndProfile(user, userProfile, {
        isRequestAccepted: isAdmin ? true : isCommunityPrivate ? false : true,
        status: isAdmin ? status.accepted : isCommunityPrivate ? status.pending : status.accepted,
      }) as unknown as UsersSchema
    );

    if (isAdmin && Array.isArray(communityAdminIds) && communityAdminIds.length > 0 && isCreatorAdmin) {
      const adminDetails = await Promise.all(
        communityAdminIds.map(async (adminId) => {
          const [adminUser, adminProfile] = await Promise.all([
            getUserById(new mongoose.Types.ObjectId(adminId)),
            userProfileService.getUserProfileById(String(adminId)),
          ]);
          return { adminUser, adminProfile };
        })
      );

      const existingUserIds = new Set(communityGroup.users.map((u) => u._id.toString()));

      for (const { adminUser, adminProfile } of adminDetails) {
        if (adminUser && adminProfile && !existingUserIds.has(adminUser._id.toString())) {
          communityGroup.users.push(
            buildGroupMemberFromUserAndProfile(adminUser, { ...adminProfile, role: adminProfile.role || 'admin' }, {
              isRequestAccepted: true,
              status: status.accepted,
            }) as unknown as UsersSchema
          );
        }
      }
    }

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



    if (isCommunityPrivate && !isAdmin) {
      const notificationPayload: CreateNotificationPayload = {
        sender_id: userID,
        receiverId: communityGroup.adminUserId,
        communityGroupId: communityGroup._id,
        type: notificationRoleAccess.PRIVATE_GROUP_REQUEST,
        message: 'User has requested to join your private group',
      };
      await notificationService.createNotification(notificationPayload);
      io.emit(`notification_${communityGroup.adminUserId}`, { type: notificationRoleAccess.PRIVATE_GROUP_REQUEST });
      sendPushNotification(
        communityGroup.adminUserId.toString(),
        'Private Group Request',
        user.firstName + ' has requested to join your private group' + communityGroup.title,
        {
          sender_id: userID,
          receiverId: communityGroup.adminUserId.toString(),
          type: notificationRoleAccess.PRIVATE_GROUP_REQUEST,
        }
      );

      return { success: true, message: 'Request sent successfully', isGroupPrivate: true };
    } else {
      const plainProfile = updateUserProfile?.toObject();

      const updatedCommunities = plainProfile?.communities.map((community: UserCommunities) => ({
        ...community,
        communityGroups: []
      }));
      return {
        success: true,
        message: 'Successfully joined the community group',
        data: { communityGroup, communities: updatedCommunities, isGroupPrivate: false },
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
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
    }
    if (!userProfile) throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);

    // Check if the user is a member of the communityGroup
    const userIndex = communityGroup.users.findIndex((groupUser) => groupUser._id.toString() === userID);

    if (userIndex === -1) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.NOT_A_MEMBER);
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

    const filteredUsers = communityGroup.users.filter((user) => user.isRequestAccepted === true);

    communityGroup.users = filteredUsers;

    const plainProfile = updatedUserProfile.toObject();

    const updatedCommunities = plainProfile?.communities.map((community: UserCommunities) => ({
      ...community,
      communityGroups: []
    }));

    return { communityGroup, communities: updatedCommunities };
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'An error occurred');
  }
};

export const acceptPrivateCommunityGroupRequest = async (userId: string, communityGroupId: string) => {
  try {
    if (!communityGroupId || !userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID_OR_USER_ID);
    }

    const updatedGroup = await updateGroupMemberStatus(communityGroupId, userId, true, status.accepted);

    if (!updatedGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND_OR_USER);
    }

    return updatedGroup;
  } catch (error: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || ERROR_MESSAGES.ERROR_ACCEPTING_PRIVATE_GROUP_REQUEST);
  }
};

export const getCommunityGroupMembers = async (
  communityGroupId: string,
  userStatus: string,
  page: number = 1,
  limit: number = 10,
  userId: string
) => {
  try {
    if (!communityGroupId) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.INVALID_COMMUNITY_GROUP_ID_SHORT);
    }

    const groupId = new Types.ObjectId(communityGroupId);

    const communityGroup = await getCommunityGroupByObjectId(communityGroupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, ERROR_MESSAGES.COMMUNITY_GROUP_NOT_FOUND);
    }

    const currentUserProfile = await UserProfile.findOne(
      { users_id: new Types.ObjectId(userId) },
      { blockedUsers: 1 }
    ).lean();

    const blockedUserIds = currentUserProfile?.blockedUsers?.map((b) => b.userId) || [];

    const targetStatus = userStatus === status.pending ? status.pending : status.accepted;

    const adminId = communityGroup.adminUserId?.toString();
    const communityId = communityGroup.communityId;

    if (!communityId) {
      throw new ApiError(httpStatus.BAD_REQUEST, ERROR_MESSAGES.COMMUNITY_REFERENCE_MISSING);
    }

    const blockedUserObjectIds = (blockedUserIds || []).map((id) =>
      id instanceof Types.ObjectId ? id : new Types.ObjectId(id.toString())
    );

    const pipeline = buildCommunityGroupMembersDataPipeline(
      groupId,
      targetStatus,
      blockedUserObjectIds,
      userId,
      adminId,
      communityId,
      page,
      limit
    );

    const results = await communityGroupModel.aggregate(pipeline);
    const users = results[0]?.users || [];

    const totalPipeline = buildCommunityGroupMembersCountPipeline(groupId, targetStatus);

    const totalResult = await communityGroupModel.aggregate(totalPipeline);
    const totalCount = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: (users as MemberWithVerified[]).map((u) => ({
        ...u,
        isVerified: u.isVerified ?? false,
      })),
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  } catch (error: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || ERROR_MESSAGES.ERROR_FETCHING_MEMBERS);
  }
};
