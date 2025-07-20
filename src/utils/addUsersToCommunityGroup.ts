// utils/addUsersToCommunityGroup.ts

import mongoose from 'mongoose';
import { getUserById } from '../modules/user/user.service';
import { userProfileService } from '../modules/userProfile';
import { status } from '../modules/communityGroup/communityGroup.interface';

interface AddUsersToCommunityGroupParams {
  communityGroup: any; // pass the fetched community group doc here
  userIds: string[];
}

/**
 * Adds users to a community group if they're not already present.
 * @param {object} params - Contains the community group doc and user IDs
 * @returns {Promise<object>} - Returns the updated community group document
 */
const addUsersToCommunityGroup = async ({ communityGroup, userIds }: AddUsersToCommunityGroupParams): Promise<object> => {
  if (!communityGroup) {
    throw new Error('Community group not found');
  }

  // 1️⃣ Fetch user and profile data in parallel
  const userPromises = userIds.map(async (userID: string) => {
    const [user, userProfile] = await Promise.all([
      getUserById(new mongoose.Types.ObjectId(userID)),
      userProfileService.getUserProfileById(String(userID)),
    ]);
    return { user, userProfile, userID };
  });

  const usersData = await Promise.all(userPromises);

  // 2️⃣ Add users if not already present
  usersData.forEach(({ user, userProfile, userID }) => {
    const exists = communityGroup.users.find((u: any) => u._id.equals(new mongoose.Types.ObjectId(userID)));
    if (!exists) {
      communityGroup.users.push({
        _id: new mongoose.Types.ObjectId(userID),
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImageUrl: userProfile?.profile_dp?.imageUrl || null,
        universityName: userProfile?.university_name as string,
        year: userProfile?.study_year as string,
        degree: userProfile?.degree as string,
        major: userProfile?.major as string,
        isRequestAccepted: false,
        status: status.pending,
        occupation: userProfile?.occupation as string,
        affiliation: userProfile?.affiliation as string,
        role: userProfile?.role,
      });
    }
  });

  // 3️⃣ Return the updated community group object (NOT saved)
  return communityGroup;
};

export default addUsersToCommunityGroup;
