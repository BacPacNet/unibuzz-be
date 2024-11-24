import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { UserProfileDocument } from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationService } from '../Notification';
import { io } from '../../index';

export const createUserProfile = async (
  user: any,
  dob: string,
  country: string,
  city: string = '',
  universityEmail: string = '',
  universityName: string = '',
  year: string,
  degree: string,
  major: string,
  occupation: string,
  department: string,
  universityId: string
) => {
  let emailField = [];

  if (universityEmail) {
    emailField.push({ UniversityName: universityName, UniversityEmail: universityEmail });
  }

  return await UserProfile.create({
    users_id: user,
    dob,
    country,
    city,
    degree,
    major,
    occupation,
    affiliation: department,
    university_id: universityId,
    university_name: universityName,
    study_year: year,
    ...(emailField.length > 0 && { email: emailField }),
  });
};

export const getUserProfile = async (id: string) => {
  const userProfile = await UserProfile.findOne({ users_id: id }).populate({
    path: 'university_id',
    select: 'name country logos images',
  });
  return userProfile;
};
export const getUserProfileById = async (id: string) => {
  const userProfile = await UserProfile.findOne({ users_id: id });
  return userProfile;
};

export const getUserProfiles = async (userIds: any) => {
  return await UserProfile.find({ users_id: { $in: userIds } });
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

  const { email, ...updateData } = userProfileBody;
  Object.assign(userProfileToUpdate, updateData);

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
export const getFollowingUsers = async (userId: string) => {
  const user = await UserProfile.findById(userId).populate('following.userId', 'email profile_dp').exec();

  return user!.following;
};
export const getFollow = async (name: string = '', userId: string) => {
  // Fetch user profile and get list of following user IDs
  const profile = await UserProfile.findOne({ users_id: userId });
  if (!profile || !profile.following) return [];

  const ids = profile.following.map((id: any) => id.userId?._id).filter(Boolean); // Filter out any undefined/null user IDs

  if (!ids.length) return [];

  // Split name if provided
  const [firstNametoPush, lastNametopush] = name ? name.split(' ') : ['', ''];

  // Find user profiles based on name and following list
  const userFollows = await UserProfile.find({
    users_id: { $in: ids },
  }).populate({
    path: 'users_id',
    match: {
      $or: [
        { firstName: { $regex: new RegExp(firstNametoPush || '', 'i') } },
        ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
      ],
    },
    select: '_id firstName lastName',
  });

  // Filter out any profiles without populated users_id
  return userFollows.filter((profile) => profile.users_id);
};

export const getFollowers = async (name: string = '', userId: string) => {
  // Fetch user profile and get list of follower user IDs
  const profile = await UserProfile.findOne({ users_id: userId });
  if (!profile || !profile.followers) return [];

  const ids = profile.followers.map((follower: any) => follower.userId?._id).filter(Boolean); // Filter out any undefined/null user IDs

  if (!ids.length) return [];

  // Split name if provided
  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');

  // Find user profiles based on name and followers list
  const userFollows = await UserProfile.find({
    users_id: { $in: ids },
  }).populate({
    path: 'users_id',
    match: {
      $or: [
        { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
        ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
      ],
    },
  });

  // Filter out any profiles without populated users_id
  return userFollows.filter((profile) => profile.users_id);
};

export const getFollowersAndFollowing = async (name: string = '', userId: string) => {
  let firstNametoPush: any;
  let lastNametopush: any;
  const profile: any = await UserProfile.findOne({ users_id: userId });

  const followersIds = profile.followers.map((id: { userId: { _id: string } }) => id.userId._id);
  const followingIds = profile.following.map((id: { userId: { _id: string } }) => id.userId._id);

  const uniqueIds = new Set([...followersIds, ...followingIds]);
  const ids = Array.from(uniqueIds);

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
  })
    .populate({
      path: 'users_id',
      select: 'firstName lastName',
      match: {
        $or: [
          { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
          ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
        ],
      },
    })
    .select('profile_dp degree study_year university_name')
    .exec();

  const filteredUserFollows = userFollows.filter((profile) => profile.users_id !== null);
  const result = filteredUserFollows?.map((profile: any) => ({
    _id: profile.users_id._id,
    firstName: profile.users_id.firstName,
    lastName: profile.users_id.lastName,
    profile: {
      _id: profile._id,
      profile_dp: profile.profile_dp,
      degree: profile.degree,
      study_year: profile.study_year,
      university_name: profile.university_name,
    },
  }));
  const finalResult = { user: result };
  return finalResult;
};

export const getBlockedUsers = async (userId: string) => {
  const userProfileData = await UserProfile.findOne({ users_id: userId });

  const followingBlockedUsers = userProfileData?.following.filter((item) => item.isBlock == true);
  const followersBlockedUsers = userProfileData?.followers.filter((item) => item.isBlock == true);
  const followingBlockedUsersIds = followingBlockedUsers?.map((item) => item.userId.toString()) || [];
  const followersBlockedUsersIds = followersBlockedUsers?.map((item) => item.userId.toString()) || [];

  const allBlockedUserIds = [...followingBlockedUsersIds, ...followersBlockedUsersIds];
  const UniqueBlockUserId = Array.from(new Set(allBlockedUserIds));

  const allUsers = await UserProfile.find({ users_id: { $in: UniqueBlockUserId } })
    .populate('users_id')
    .select('firstName lastName _id');
  return allUsers;
};

export const addUniversityEmail = async (userId: string, universityEmail: string, universityName: string) => {
  const updatedUserProfile = await UserProfile.findOneAndUpdate(
    {
      users_id: userId,
      'email.UniversityEmail': { $ne: universityEmail },
    },
    {
      $push: { email: { UniversityName: universityName, UniversityEmail: universityEmail } },
    },
    { new: true }
  );

  if (!updatedUserProfile) {
    throw new Error('This university email already exists for the user.');
  }

  return updatedUserProfile;
};
