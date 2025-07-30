import { status } from '../modules/communityGroup/communityGroup.interface';
import { communityService } from '../modules/community';
import { ApiError } from '../modules/errors';
import httpStatus from 'http-status';
import { getUserProfileById } from '../.../../modules/userProfile/userProfile.service';

export const validateCommunityMembership = async (communityId: string, userId: string) => {
  const community = await communityService.getCommunity(communityId);
  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  const isMember = community.users.some((user) => user._id.toString() === userId.toString());
  const userCommunities = await getUserProfileById(userId);

  const isUserJoinCommunity = userCommunities?.communities.some(
    (c: { communityId: string }) => c.communityId.toString() === communityId.toString()
  );

  if (!isMember && !isUserJoinCommunity) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not a member of this community');
  }

  return community;
};

/**
 * Validates if a user is a member of a community group
 * @param communityGroup - The community group to check
 * @param userId - The user ID to validate
 * @returns boolean indicating if user is a member
 */
export const isUserCommunityGroupMember = (communityGroup: any, userId: string): boolean => {
  return communityGroup.users.some(
    (user: any) => user._id.toString() === userId.toString() && user.status === status.accepted
  );
};
