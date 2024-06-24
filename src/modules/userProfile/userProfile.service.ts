import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { UserProfileDocument } from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose from 'mongoose';

export const createUserProfile = async (user: any) => {
  return await UserProfile.create({ users_id: user._id });
};

export const getUserProfile = async (id: string) => {
  const userProfile = await UserProfile.findOne({ users_id: id });
  return userProfile;
};

export const getUserProfiles = async (userIds: any) => {
  return await UserProfile.find({ users_id: { $in: userIds } }).select(
    'affiliation study_year university_name degree users_id profile_dp '
  );
};

export const updateUserProfile = async (id: mongoose.Types.ObjectId, userProfileBody: UserProfileDocument) => {
  let userProfileToUpdate: any;

  userProfileToUpdate = await UserProfile.findById(id);

  if (!userProfileToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User Profile not found!');
  }
  // console.log(userProfileBody.email);
  // Check if the updateData contains new email to be added
  if (userProfileBody.email && userProfileBody.email.length > 0) {
    for (const newEmailEntry of userProfileBody.email) {
      // Check if the email already exists
      const emailExists = userProfileToUpdate.email.some(
        (existingEmailEntry: any) =>
          existingEmailEntry.UniversityName === newEmailEntry.UniversityName &&
          existingEmailEntry.UniversityEmail === newEmailEntry.UniversityEmail
      );

      if (!emailExists) {
        userProfileToUpdate.email.push(newEmailEntry);
      }
    }
  }

  // Merge userProfileBody into userProfileToUpdate, excluding email
  const { email, ...updateData } = userProfileBody;
  Object.assign(userProfileToUpdate, updateData);

  // Object.assign(userProfileToUpdate, userProfileBody);
  let filledPropertiesCount = Object.entries(userProfileToUpdate.toObject()).filter(
    ([key, value]) =>
      key !== '_id' && key !== '__v' && key !== 'users_id' && key !== 'totalFilled' && value !== null && value !== undefined
  ).length;

  let ProfilePercentage = Math.ceil((filledPropertiesCount / 13) * 100);
  // console.log(ProfilePercentage);

  userProfileToUpdate.totalFilled = ProfilePercentage;

  await userProfileToUpdate.save();

  return userProfileToUpdate;
};
