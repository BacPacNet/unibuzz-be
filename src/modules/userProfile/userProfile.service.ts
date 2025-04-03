import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { UserProfileDocument } from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose from 'mongoose';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationService } from '../Notification';
import { io } from '../../index';
import { communityModel } from '../community';
import { userFollowService } from '../userFollow';
import User from '../user/user.model';
import { parse } from 'date-fns';

export const createUserProfile = async (userId: string, body: any) => {
  const {
    birthDate,
    country,
    city,
    universityEmail,
    universityName,
    year,
    degree,
    major,
    occupation,
    department,
    universityId,
    userType,
    universityLogo,
  } = body;

  const emailField =
    universityEmail.length > 0 ? await buildEmailField(universityEmail, universityName, universityId) : null;

  const userProfileData = {
    users_id: userId,
    dob: parse(birthDate, 'dd/MM/yyyy', new Date()),
    country,
    city,
    degree,
    major,
    role: String(userType).toLowerCase(),
    occupation,
    affiliation: department,
    university_id: universityId,
    university_name: universityName,
    study_year: year,
    universityLogo,
    ...(emailField && { email: [emailField] }),
  };

  await UserProfile.create(userProfileData);
};

const buildEmailField = async (universityEmail: string, universityName: string, universityId: string | null) => {
  const community = await communityModel.findOne({ university_id: universityId });
  return {
    UniversityName: universityName,
    UniversityEmail: universityEmail,
    communityId: community?._id || null,
    logo: community?.communityLogoUrl.imageUrl,
  };
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

  const bioLength = userProfileBody.bio?.trim().length || 0;
  userProfileToUpdate = await UserProfile.findById(id);

  if (bioLength > 160) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bio must not exceed 10 words');
  }

  if (!userProfileToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User Profile not found!');
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
  await userFollowService.follow_unfollow_User(userId.toString(), userToFollow.toString());

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

export const getFollowing = async (name: string = '', userId: string, page: number = 1, limit: number = 10) => {
  const startIndex = (page - 1) * limit;

  const profile = await UserProfile.findOne({ users_id: userId }, 'following');
  if (!profile?.following?.length) return { currentPage: page, totalPages: 0, users: [] };

  const ids = profile.following.map((f: any) => f.userId?._id).filter(Boolean);
  if (!ids.length) return { currentPage: page, totalPages: 0, users: [] };

  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');
  const nameFilter = {
    $or: [
      { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
      ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
    ],
  };

  const users = await User.aggregate([
    { $match: { _id: { $in: ids }, ...nameFilter } },
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        isFollowing: true,
      },
    },
    { $skip: startIndex },
    { $limit: limit },
  ]);

  return { currentPage: page, totalPages: Math.ceil(ids.length / limit), users };
};

//export const getFollow = async (name: string = '', userId: string) => {
//  // Fetch user profile and get list of following user IDs
//  const profile = await UserProfile.findOne({ users_id: userId });
//  if (!profile || !profile.following) return [];

//  const ids = profile.following.map((id: any) => id.userId?._id).filter(Boolean); // Filter out any undefined/null user IDs

//  if (!ids.length) return [];

//  // Split name if provided
//  const [firstNametoPush, lastNametopush] = name ? name.split(' ') : ['', ''];

//  // Find user profiles based on name and following list
//  const userFollows = await UserProfile.find({
//    users_id: { $in: ids },
//  }).populate({
//    path: 'users_id',
//    match: {
//      $or: [
//        { firstName: { $regex: new RegExp(firstNametoPush || '', 'i') } },
//        ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
//      ],
//    },
//    select: '_id firstName lastName',
//  });

//  // Filter out any profiles without populated users_id
//  return userFollows.filter((profile) => profile.users_id);
//};

export const getFollowers = async (name: string = '', userId: string, page: number, limit: number) => {
  const Currpage = page ? page : 1;
  const limitpage = limit ? limit : 10;
  const startIndex = (Currpage - 1) * limitpage;

  // Fetch user profile and get list of follower user IDs
  const profile = await UserProfile.findOne({ users_id: userId });
  if (!profile || !profile.followers) return { currentPage: page, totalPages: 0, users: [] };

  const followingIds = profile?.following.map((id) => id.userId.toString()) || [];

  const ids = profile.followers.map((follower: any) => follower.userId?._id).filter(Boolean);
  if (!ids.length) return { currentPage: page, totalPages: 0, users: [] };

  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');

  const users = await User.aggregate([
    {
      $match: {
        _id: { $in: ids },
        $or: [
          { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
          ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
        ],
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    {
      $unwind: {
        path: '$profile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        isFollowing: { $in: ['$_id', followingIds.map((id) => new mongoose.Types.ObjectId(id))] }, // Check if user is in following list
      },
    },
  ])
    .skip(startIndex)
    .limit(limitpage);

  const totalUsers = ids.length;
  const totalPages = Math.ceil(totalUsers / limit);

  return { currentPage: page, totalPages, users };
};

//export const getMutualUsers = async (userId: string, targetUserId: string, page: number = 1, limit: number = 10) => {
//  const startIndex = (page - 1) * limit;

//  // Fetch both users' following lists
//  const [loggedInUser, targetUser] = await Promise.all([
//    UserProfile.findOne({ users_id: userId }).select('following').lean(),
//    UserProfile.findOne({ users_id: targetUserId }).select('following').lean(),
//  ]);

//  // Extract following user IDs and convert them to ObjectId
//  const loggedInFollowingIds = new Set(loggedInUser?.following.map(f => f.userId.toString()) || []);
//  const targetFollowingIds = new Set(targetUser?.following.map(f => f.userId.toString()) || []);

//  // Find mutual user IDs
//  const mutualUserIds = [...loggedInFollowingIds].filter(id => targetFollowingIds.has(id)).map(id => new mongoose.Types.ObjectId(id));

//  // Fetch user details of mutual users with pagination
//  const mutualUsers = await User.aggregate([
//    { $match: { _id: { $in: mutualUserIds } } },
//    {
//      $lookup: {
//        from: 'userprofiles',
//        localField: '_id',
//        foreignField: 'users_id',
//        as: 'profile',
//      },
//    },
//    {
//      $unwind: {
//        path: '$profile',
//        preserveNullAndEmptyArrays: true,
//      },
//    },
//    { $skip: startIndex },
//    { $limit: limit },
//  ]);

//  return {
//    currentPage: page,
//    totalPages: Math.ceil(mutualUserIds.length / limit),
//    mutualUsers,
//  };
//};

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

export const getFollowingAndMutuals = async (name: string, userId: string, page: number = 1, limit: number = 10) => {
  const startIndex = (page - 1) * limit;

  // Fetch the user's following and followers list
  const loggedInUser = await UserProfile.findOne({ users_id: userId }).select('following followers').lean();

  // Extract following and follower IDs
  const followingIds = new Set(loggedInUser?.following.map((f) => f.userId.toString()) || []);
  const followerIds = new Set(loggedInUser?.followers.map((f) => f.userId.toString()) || []);

  // Find mutual followers (users present in both sets)
  const mutualIds = [...followingIds].filter((id) => followerIds.has(id)).map((id) => new mongoose.Types.ObjectId(id));

  // Convert followingIds to ObjectId for MongoDB query
  //  const followingObjectIds = [...followingIds].map((id) => new mongoose.Types.ObjectId(id));

  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');

  // Fetch user details of following and mutual followers
  const users = await User.aggregate([
    {
      $match: {
        _id: { $in: mutualIds },
        $or: [
          { firstName: { $regex: new RegExp(firstNametoPush, 'i') } },
          ...(lastNametopush ? [{ lastName: { $regex: new RegExp(lastNametopush, 'i') } }] : []),
        ],
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    {
      $unwind: {
        path: '$profile',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        isFollowing: true, // Check if the user is a mutual follower
      },
    },
    { $skip: startIndex },
    { $limit: limit },
  ]);

  return {
    currentPage: page,
    totalPages: Math.ceil(followingIds.size / limit),
    users,
  };
};

export const addUniversityEmail = async (
  userId: string,
  universityEmail: string,
  universityName: string,
  communityId: string,
  communityLogoUrl: string
) => {
  const updatedUserProfile = await UserProfile.findOneAndUpdate(
    {
      users_id: new mongoose.Types.ObjectId(userId),
    },
    {
      $push: {
        email: { UniversityName: universityName, UniversityEmail: universityEmail, communityId, logo: communityLogoUrl },
      },
    },
    { new: true }
  );

  if (!updatedUserProfile) {
    throw new Error('This university email already exists for the user.');
  }

  return updatedUserProfile;
};
