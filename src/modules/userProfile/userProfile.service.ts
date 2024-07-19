import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { UserProfileDocument } from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationService } from '../Notification';
import { io } from '../../app';

export const createUserProfile = async (user: any, dob: string, country: string, city: string, percent: number = 0) => {
  return await UserProfile.create({ users_id: user, dob, country, city, totalFilled: percent });
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

  const { email, totalFilled, ...updateData } = userProfileBody;
  Object.assign(userProfileToUpdate, updateData);

  let filledPropertiesCount = Object.entries(userProfileToUpdate.toObject()).filter(
    ([key, value]) =>
      key !== '_id' &&
      key !== '__v' &&
      key !== 'users_id' &&
      key !== 'totalFilled' &&
      key !== 'email' &&
      value !== null &&
      value !== undefined &&
      value !== ''
  ).length;

  let ProfilePercentage = Math.ceil((filledPropertiesCount / 13) * 100);

  userProfileToUpdate.totalFilled = ProfilePercentage;

  await userProfileToUpdate.save();

  return userProfileToUpdate;
};

export const toggleFollow = async (userId: mongoose.Types.ObjectId, userToFollow: mongoose.Types.ObjectId) => {
  const userProfile = await UserProfile.findOne({ users_id: userId });
  const userToFollowProfile = await UserProfile.findOne({ users_id: userToFollow });
  let updatedUseProfile;
  const notifications = {
    sender_id: userId,
    receiverId: userToFollow,
    type: notificationRoleAccess.FOLLOW,
    message: 'Started following you',
  };

  if (!userProfile?.following.some((x) => x.userId.toString() === userToFollow.toString())) {
    await userToFollowProfile?.updateOne({ $push: { followers: { userId } } });
    await notificationService.CreateNotification(notifications);
    io.emit(`notification_${userToFollow}`, { type: notificationRoleAccess.FOLLOW });

    updatedUseProfile = await UserProfile.findOneAndUpdate(
      { users_id: userId },
      { $push: { following: { userId: userToFollow } } },
      { new: true }
    );
    return updatedUseProfile;
  } else {
    await userToFollowProfile?.updateOne({ $pull: { followers: { userId } } });
    notifications.message = 'Un-followed you';
    await notificationService.CreateNotification(notifications);
    io.emit(`notification_${userToFollow}`, { type: notificationRoleAccess.FOLLOW });

    updatedUseProfile = await UserProfile.findOneAndUpdate(
      { users_id: userId },
      { $pull: { following: { userId: userToFollow } } },
      { new: true }
    );
    return updatedUseProfile;
  }
};

export const getFollow = async (name: string = '', userId: string) => {
  let firstNametoPush: any;
  let lastNametopush: any;
  const profile: any = await UserProfile.findOne({ users_id: userId });
  const ids = profile.following.map((id: any) => id.userId._id);

  if (name) {
    let nameParts = name.split(' ');
    if (nameParts.length > 1) {
      firstNametoPush = nameParts[0];
      lastNametopush = nameParts[1];
    } else {
      firstNametoPush = name;
    }
  }

  const userFollows = await UserProfile.find({
    $and: [{ users_id: { $in: ids } }],
  }).populate({
    path: 'users_id',
    match: {
      $or: [
        { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
        ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
      ],
    },
  });

  const filteredUserFollows = userFollows.filter((profile) => profile.users_id !== null);

  return filteredUserFollows;
};

export const getFollowers = async (name: string = '', userId: string) => {
  let firstNametoPush: any;
  let lastNametopush: any;
  const profile: any = await UserProfile.findOne({ users_id: userId });

  const ids = profile.followers.map((id: any) => id.userId._id);

  if (name) {
    let nameParts = name.split(' ');
    if (nameParts.length > 1) {
      firstNametoPush = nameParts[0];
      lastNametopush = nameParts[1];
    } else {
      firstNametoPush = name;
    }
  }

  const userFollows = await UserProfile.find({
    $and: [{ users_id: { $in: ids } }],
  }).populate({
    path: 'users_id',
    match: {
      $or: [
        { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
        ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
      ],
    },
  });

  const filteredUserFollows = userFollows.filter((profile) => profile.users_id !== null);

  return filteredUserFollows;
};
