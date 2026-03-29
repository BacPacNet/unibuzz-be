import mongoose from 'mongoose';
import whitelistRewardCommunityModel from './whitelistRewardCommunity.model';
import * as userProfileService from '../userProfile/userProfile.service';

/**
 * Check if a user is eligible for rewards: userProfile.email is an array of
 * { UniversityName, UniversityEmail, communityId, logo }. If any of the
 * user's email entries have a communityId that exists in the whitelist, return true.
 * @param userId - The user's ID
 * @returns true if any user.email[].communityId exists in whitelistReward DB, else false
 */
export const isUserEligibleForRewards = async (
  userId: mongoose.Types.ObjectId
): Promise<boolean> => {
  const user = await userProfileService.findOneProfileByUserId(userId.toString())
    

  const emails = user?.email;

  if (!Array.isArray(emails) || emails.length === 0) {
    return false;
  }

  const communityIds = emails
    .map((e: { communityId?: string }) => e?.communityId)
    .filter(Boolean);

  if (communityIds.length === 0) {
    return false;
  }

  const objectIds = communityIds.map((id) =>
    typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
  );

  const whitelisted = await whitelistRewardCommunityModel.exists({
    communityId: { $in: objectIds },
  });

  return !!whitelisted;
};
