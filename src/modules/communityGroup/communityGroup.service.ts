import mongoose from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { getUserById } from '../user/user.service';
import { getUserProfiles } from '../userProfile/userProfile.service';

export const createCommunityGroup = async (userID: string, communityId: any, body: any) => {
  // console.log("bb",body);

  const newComment = { ...body, communityId: communityId, adminUserId: userID };
  return await communityGroupModel.create(newComment);
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

export const getAllCommunityGroup = async (communityId: string) => {
  return await communityGroupModel.find({ communityId }).populate({ path: 'adminUserId', select: 'firstName lastName _id' });
};

export const getAllCommunityGroupWithUserProfiles = async (communityId: string) => {
  const communityGroups = await getAllCommunityGroup(communityId);

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

export const getCommunityGroup = async (groupId: string) => {
  return await communityGroupModel.findById(groupId);
};

export const joinLeaveCommunityGroup = async (userID: string, groupId: string) => {
  try {
    const user: any = await getUserById(new mongoose.Types.ObjectId(userID));
    const community: any = await getCommunityGroup(groupId);

    const communityIdStr = community?.communityId.toString();
    // console.log(communityIdStr);
    let message;
    const communityGroup: any = {
      communityGroupName: community?.title,
      communityGroupId: community?._id,
    };

    if (!user.userVerifiedCommunities) {
      user.userVerifiedCommunities = [];
    }

    const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c: any) => c.communityId.toString()) || [];

    // changes
    const userUnverifiedVerifiedCommunityIds =
      user?.userUnVerifiedCommunities.map((c: any) => c.communityId.toString()) || [];

    if (userUnverifiedVerifiedCommunityIds.includes(communityIdStr) && community.communityGroupType == 'private') {
      throw new ApiError(httpStatus.NOT_FOUND, ' only verified community users can join!');
    }
    // console.log(userVerifiedCommunityIds);

    if (!userVerifiedCommunityIds.includes(communityIdStr) && !userUnverifiedVerifiedCommunityIds.includes(communityIdStr)) {
      throw new ApiError(httpStatus.NOT_FOUND, ' not part of university!');
      // console.log("no");
    }

    // let communityExists = false;
    // for verified Communities
    user.userVerifiedCommunities = user.userVerifiedCommunities.map((c: any) => {
      if (c.communityId.toString() === communityIdStr) {
        // Check if the group exists within the community
        const groupIndex = c.communityGroups.findIndex((g: any) => g.communityGroupId === groupId);
        if (groupIndex !== -1) {
          c.communityGroups.splice(groupIndex, 1);
          community.memberCount = community.memberCount - 1;
          message = 'left Group';
          return c;
        } else {
          c.communityGroups.push(communityGroup);
          community.memberCount = community.memberCount + 1;
          message = 'joined Group';
          return c;
        }
      }
      return c;
    });

    // for unverified communities
    user.userUnVerifiedCommunities = user.userUnVerifiedCommunities.map((c: any) => {
      if (c.communityId.toString() === communityIdStr) {
        const groupIndex = c.communityGroups.findIndex((g: any) => g.communityGroupId === groupId);
        if (groupIndex !== -1) {
          c.communityGroups.splice(groupIndex, 1);
          community.memberCount = community.memberCount - 1;
          message = 'left Group';
          return c;
        } else {
          c.communityGroups.push(communityGroup);
          community.memberCount = community.memberCount + 1;
          message = 'joined Group';
          return c;
        }
      }
      return c;
    });
    // return { message: !communityExists ? 'left Group' : 'Joined Group' };
    await user.save();
    await community.save();
    return { message, user };
  } catch (err) {
    // console.log(err)
    throw err;
  }
};
