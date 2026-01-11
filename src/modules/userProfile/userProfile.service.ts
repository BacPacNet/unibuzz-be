import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { EditProfileRequest } from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose from 'mongoose';
// import { notificationRoleAccess } from '../Notification/notification.interface';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import { communityModel } from '../community';
// import { userFollowService } from '../userFollow';
import User from '../user/user.model';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import { communityGroupModel } from '../communityGroup';
import { chatModel } from '../chat';

export const createUserProfile = async (userId: string, body: any) => {
  const {
    birthDate,
    country,
    city,
    //universityEmail,
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

  //  const emailField =
  //    universityEmail?.length > 0 ? await buildEmailField(universityEmail, universityName, universityId) : null;

  const userProfileData = {
    users_id: userId,
    // dob: parse(birthDate, 'dd/MM/yyyy', new Date()),
    dob: birthDate,
    country,
    city,
    degree,
    major,
    role: String(userType).toLowerCase(),
    occupation,
    affiliation: department,
    university_id: universityId?.length ? universityId : null,
    university_name: universityName,
    study_year: year,
    universityLogo,
    //...(emailField && { email: [emailField] }),
  };

  await UserProfile.create(userProfileData);
};

export const buildEmailField = async (universityEmail: string, universityName: string, universityId: string | null) => {
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

export const getUserProfileVerifiedUniversityEmails = async (id: string) => {
  const userProfile = await UserProfile.findOne({ users_id: id });
  return userProfile?.email;
};

export const getUserProfileById = async (id: string) => {
  const userProfile = await UserProfile.findOne({ users_id: id });

  return userProfile;
};

export const getUserProfiles = async (userIds: any) => {
  return await UserProfile.find({ users_id: { $in: userIds } });
};

export const updateUserProfile = async (id: mongoose.Types.ObjectId, userProfileBody: EditProfileRequest) => {
  let userProfileToUpdate: any;

  const bioLength = userProfileBody.bio?.trim().length || 0;
  userProfileToUpdate = await UserProfile.findById(id);

  if (bioLength > 160) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bio must not exceed 160 characters');
  }

  if (!userProfileToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User Profile not found!');
  }

  // Get 14 days ago date
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Count recent status changes
  const recentChanges = userProfileToUpdate.statusChangeHistory.filter((entry: any) => entry.updatedAt >= fourteenDaysAgo);

  // Determine which status fields are being updated
  const statusFields = ['role', 'study_year', 'major', 'occupation', 'affiliation'] as const;
  const updatedFields = [];

  for (const field of statusFields) {
    const newValue = userProfileBody[field];
    if (newValue && userProfileToUpdate[field] !== newValue) {
      updatedFields.push({
        field,
        oldValue: userProfileToUpdate[field],
        newValue,
      });
    }
  }

  // If there are status field changes, check the limit
  if (updatedFields.length > 0) {
    if (recentChanges.length >= 2) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You can only change your status twice within 14 days');
    }

    // Add the status change to history
    userProfileToUpdate.statusChangeHistory.push({
      updatedAt: new Date(),
      updatedFields,
    });
  }

  const { firstName, lastName, ...updateData } = userProfileBody;
  Object.assign(userProfileToUpdate, updateData);

  // Update firstName and lastName in User schema if they are provided
  if (firstName || lastName) {
    const userToUpdate = await User.findById(userProfileToUpdate.users_id);
    if (userToUpdate) {
      if (firstName) userToUpdate.firstName = firstName;
      if (lastName) userToUpdate.lastName = lastName;
      await userToUpdate.save();
    }
  }

  await userProfileToUpdate.save();

  return userProfileToUpdate;
};

export const toggleFollow = async (userId: mongoose.Types.ObjectId, userToFollow: mongoose.Types.ObjectId) => {
  const userProfile = await UserProfile.findOne({ users_id: userId });
  const userToFollowProfile = await UserProfile.findOne({ users_id: userToFollow });

  // Determine current state BEFORE making any updates
  const isAlreadyFollowing = userProfile?.following.some((x) => x.userId.toString() === userToFollow.toString());

  let updatedUseProfile;

  if (!isAlreadyFollowing) {
    // FOLLOW
    await userToFollowProfile?.updateOne({ $push: { followers: { userId } } });
    updatedUseProfile = await UserProfile.findOneAndUpdate(
      { users_id: userId },
      { $push: { following: { userId: userToFollow } } },
      { new: true }
    );

    const followNotification = {
      sender_id: userId,
      receiverId: userToFollow,
      type: NotificationIdentifier.follow_user,
      message: 'Started following you',
    };

    try {
      console.log('🚀 Attempting to enqueue follow notification...');
      const result = await queueSQSNotification(followNotification);
      console.info('✅ Notification enqueued successfully', {
        notification: followNotification,
        sqsResult: result,
      });
    } catch (err) {
      console.error('❌ Failed to enqueue notification', {
        notification: followNotification,
        error: err,
      });
    }
    // await queueSQSNotification(followNotification);
  } else {
    // UNFOLLOW
    await userToFollowProfile?.updateOne({ $pull: { followers: { userId } } });
    updatedUseProfile = await UserProfile.findOneAndUpdate(
      { users_id: userId },
      { $pull: { following: { userId: userToFollow } } },
      { new: true }
    );

    const unfollowNotification = {
      sender_id: userId,
      receiverId: userToFollow,
      type: NotificationIdentifier.un_follow_user,
      message: 'Stopped following you',
    };
    // await queueSQSNotification(unfollowNotification);
    try {
      console.log('🚀 Attempting to enqueue unfollow notification...');
      const result = await queueSQSNotification(unfollowNotification);
      console.info('✅ Notification enqueued successfully', {
        notification: unfollowNotification,
        sqsResult: result,
      });
    } catch (err) {
      console.error('❌ Failed to enqueue notification', {
        notification: unfollowNotification,
        error: err,
      });
    }
  }

  return updatedUseProfile;
};

export const getFollowingUsers = async (userId: string) => {
  const user = await UserProfile.findById(userId).populate('following.userId', 'email profile_dp').exec();

  return user!.following;
};

export const getFollowing = async (
  name: string = '',
  userId: string,
  page: number = 1,
  limit: number = 10,
  myUserId: string
) => {
  const myProfile = await UserProfile.findOne({ users_id: myUserId }, { blockedUsers: 1 }).lean();

  const myBlockedUserIds = myProfile?.blockedUsers?.map((b: any) => b.userId) || [];

  const myUserObjectId = new mongoose.Types.ObjectId(myUserId);

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
    {
      $match: {
        _id: {
          $in: ids,
          $nin: myBlockedUserIds,
        },
        ...nameFilter,
        isDeleted: { $ne: true },
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
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },

    {
      $match: {
        'profile.blockedUsers': {
          $not: {
            $elemMatch: {
              userId: myUserObjectId,
            },
          },
        },
      },
    },

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

export const getFollowers = async (name: string = '', userId: string, page: number, limit: number, myUserId: string) => {
  const Currpage = page ? page : 1;
  const limitpage = limit ? limit : 10;
  const startIndex = (Currpage - 1) * limitpage;

  const myProfile = await UserProfile.findOne({ users_id: myUserId }, { blockedUsers: 1 }).lean();

  const myBlockedUserIds = myProfile?.blockedUsers?.map((b: any) => new mongoose.Types.ObjectId(b.userId)) || [];

  const myUserObjectId = new mongoose.Types.ObjectId(myUserId);

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
        _id: {
          $in: ids,
          $nin: myBlockedUserIds,
        },
        isDeleted: { $ne: true },
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
      $match: {
        'profile.blockedUsers': {
          $not: {
            $elemMatch: {
              userId: myUserObjectId,
            },
          },
        },
      },
    },

    {
      $addFields: {
        isFollowing: {
          $in: ['$_id', followingIds.map((id) => new mongoose.Types.ObjectId(id))],
        },
      },
    },

    { $skip: startIndex },
    { $limit: limitpage },
  ]);

  const totalUsers = ids.length;
  const totalPages = Math.ceil(totalUsers / limit);

  return { currentPage: page, totalPages, users };
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
    .select('profile_dp degree major study_year university_name role affiliation occupation')
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
      major: profile.major,
      university_name: profile.university_name,
      role: profile.role,
      affiliation: profile.affiliation,
      occupation: profile.occupation,
    },
  }));
  const finalResult = { user: result };
  return finalResult;
};

export const getBlockedUsers = async (userId: string) => {
  const result = await UserProfile.aggregate([
    // 1. Match current user
    {
      $match: {
        users_id: new mongoose.Types.ObjectId(userId),
      },
    },

    // 2. Extract blocked user ids
    {
      $project: {
        blockedUserIds: '$blockedUsers.userId',
      },
    },

    // 3. Lookup blocked users' profiles
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'blockedUserIds',
        foreignField: 'users_id',
        as: 'blockedProfiles',
      },
    },

    // 4. Unwind profiles
    { $unwind: '$blockedProfiles' },

    // 5. Lookup User (firstName, lastName)
    {
      $lookup: {
        from: 'users',
        localField: 'blockedProfiles.users_id',
        foreignField: '_id',
        as: 'user',
      },
    },

    { $unwind: '$user' },

    // 6. Shape final output
    {
      $project: {
        id: '$user._id',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        university: '$blockedProfiles.university_name',
        study_year: '$blockedProfiles.study_year',
        degree: '$blockedProfiles.degree',
        major: '$blockedProfiles.major',
        occupation: '$blockedProfiles.occupation',
        affiliation: '$blockedProfiles.affiliation',
        role: '$blockedProfiles.role',
        imageUrl: '$blockedProfiles.profile_dp.imageUrl',
      },
    },
  ]);

  return result;
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
        isDeleted: { $ne: true },
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
  // First, check if the user profile exists and get current communities
  const userProfile = await UserProfile.findOne({
    users_id: new mongoose.Types.ObjectId(userId),
  });

  if (!userProfile) {
    throw new Error('User profile not found.');
  }

  // Check if the university email already exists
  const emailExists = userProfile.email.some((email) => email.UniversityEmail === universityEmail);
  if (emailExists) {
    throw new Error('University email already exists in profile.');
  }

  // Check if community already exists in communities array
  const communityExists = userProfile.communities.some((community) => community.communityId.toString() === communityId);

  let updateOperation: any = {
    $push: {
      email: { UniversityName: universityName, UniversityEmail: universityEmail, communityId, logo: communityLogoUrl },
    },
  };

  if (communityExists) {
    // Update existing community's isVerified flag to true
    updateOperation.$set = {
      'communities.$[elem].isVerified': true,
    };
  } else {
    // Add new community to communities array
    updateOperation.$push = {
      ...updateOperation.$push,
      communities: {
        communityId: new mongoose.Types.ObjectId(communityId),
        isVerified: true,
        communityGroups: [],
      },
    };
  }

  const filterQuery: any = {
    users_id: new mongoose.Types.ObjectId(userId),
  };

  if (communityExists) {
    filterQuery['communities.communityId'] = new mongoose.Types.ObjectId(communityId);
  }

  // Prepare options for findOneAndUpdate, omitting arrayFilters if not needed
  const updateOptions: any = { new: true };
  if (communityExists) {
    updateOptions.arrayFilters = [{ 'elem.communityId': new mongoose.Types.ObjectId(communityId) }];
  }

  const updatedUserProfile = await UserProfile.findOneAndUpdate(filterQuery, updateOperation, updateOptions);

  if (!updatedUserProfile) {
    throw new Error('Failed to update user profile.');
  }

  return updatedUserProfile;
};

/**
 * Groups community groups by communityId
 */
const groupByCommunityId = (
  groups: Array<{ _id: mongoose.Types.ObjectId; communityId: mongoose.Types.ObjectId }>
): Record<string, mongoose.Types.ObjectId[]> => {
  return groups.reduce((acc, group) => {
    const key = group.communityId.toString();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key]!.push(group._id);
    return acc;
  }, {} as Record<string, mongoose.Types.ObjectId[]>);
};

/**
 * Validates that blocking operation is allowed
 */
const validateBlockOperation = (userProfile: any, userToBlockProfile: any | null): void => {
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userProfile.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You are an admin and cannot block other users.');
  }

  if (userToBlockProfile?.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User to block is an admin of a community and cannot be blocked');
  }
};

/**
 * Removes users from each other's following and followers lists
 */
const removeFollowRelationships = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<void> => {
  await Promise.all([
    UserProfile.updateOne(
      { users_id: userId },
      { $pull: { following: { userId: userToBlock }, followers: { userId: userToBlock } } }
    ),
    UserProfile.updateOne(
      { users_id: userToBlock },
      { $pull: { following: { userId: userId }, followers: { userId: userId } } }
    ),
  ]);
};

/**
 * Removes users from community groups where either user is admin
 */
const removeFromCommunityGroups = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<void> => {
  await Promise.all([
    // Remove current user from groups where blocked user is admin
    communityGroupModel.updateMany(
      {
        adminUserId: userToBlock,
        'users._id': userId,
      },
      {
        $pull: { users: { _id: userId } },
      }
    ),
    // Remove blocked user from groups where current user is admin
    communityGroupModel.updateMany(
      {
        adminUserId: userId,
        'users._id': userToBlock,
      },
      {
        $pull: { users: { _id: userToBlock } },
      }
    ),
  ]);
};

/**
 * Removes community groups from user profiles
 */
const removeCommunityGroupsFromProfiles = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId,
  groupsByCommunity: Record<string, mongoose.Types.ObjectId[]>,
  myGroupsByCommunity: Record<string, mongoose.Types.ObjectId[]>
): Promise<void> => {
  const removeGroupsPromises = [
    // Remove groups from current user's profile where blocked user is admin
    ...Object.entries(groupsByCommunity).map(([communityId, groupIds]) =>
      UserProfile.updateOne(
        {
          users_id: userId,
          'communities.communityId': communityId,
        },
        {
          $pull: {
            'communities.$.communityGroups': {
              id: { $in: groupIds },
            },
          },
        }
      )
    ),
    // Remove groups from blocked user's profile where current user is admin
    ...Object.entries(myGroupsByCommunity).map(([communityId, groupIds]) =>
      UserProfile.updateOne(
        {
          users_id: userToBlock,
          'communities.communityId': communityId,
        },
        {
          $pull: {
            'communities.$.communityGroups': {
              id: { $in: groupIds },
            },
          },
        }
      )
    ),
  ];

  await Promise.all(removeGroupsPromises);
};

/**
 * Removes user from chats
 */
const removeGroupChatsOnBlock = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<void> => {
  await Promise.all([
    // Case 1:
    //  remove me from those group chats
    chatModel.updateMany(
      {
        isGroupChat: true,
        groupAdmin: userToBlock,
        'users.userId': userId,
      },
      {
        $pull: {
          users: { userId },
        },
      }
    ),

    // remove blocked user from my group chats
    chatModel.updateMany(
      {
        isGroupChat: true,
        groupAdmin: userId,
        'users.userId': userToBlock,
      },
      {
        $pull: {
          users: { userId: userToBlock },
        },
      }
    ),
  ]);
};

/**
 * Handles the blocking logic when blocking a user
 */
const handleBlockUser = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId,
  groupsByCommunity: Record<string, mongoose.Types.ObjectId[]>,
  myGroupsByCommunity: Record<string, mongoose.Types.ObjectId[]>
): Promise<{ status: string; userId: mongoose.Types.ObjectId }> => {
  // Add user to blocked list
  await UserProfile.findOneAndUpdate(
    { users_id: userId },
    { $addToSet: { blockedUsers: { userId: userToBlock } } },
    { new: true }
  );

  // Perform all cleanup operations in parallel where possible
  await Promise.all([
    removeFollowRelationships(userId, userToBlock),
    removeFromCommunityGroups(userId, userToBlock),
    removeGroupChatsOnBlock(userId, userToBlock),
  ]);

  // Remove community groups from profiles
  await removeCommunityGroupsFromProfiles(userId, userToBlock, groupsByCommunity, myGroupsByCommunity);

  return { status: 'blocked', userId: userToBlock };
};

/**
 * Handles the unblocking logic when unblocking a user
 */
const handleUnblockUser = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<{ status: string; userId: mongoose.Types.ObjectId }> => {
  await UserProfile.findOneAndUpdate(
    { users_id: userId },
    { $pull: { blockedUsers: { userId: userToBlock } } },
    { new: true }
  );

  return { status: 'unblocked', userId: userToBlock };
};

export const toggleBlock = async (userId: mongoose.Types.ObjectId, userToBlock: mongoose.Types.ObjectId) => {
  // Fetch all required data in parallel
  const [userProfile, userToBlockProfile, adminGroups, myAdminGroups] = await Promise.all([
    UserProfile.findOne({ users_id: userId }),
    UserProfile.findOne({ users_id: userToBlock }),
    communityGroupModel.find({ adminUserId: userToBlock }, { _id: 1, communityId: 1 }).lean(),
    communityGroupModel.find({ adminUserId: userId }, { _id: 1, communityId: 1 }).lean(),
  ]);

  // Validate the operation
  validateBlockOperation(userProfile, userToBlockProfile);

  // Group admin groups by community ID
  const groupsByCommunity = groupByCommunityId(adminGroups);
  const myGroupsByCommunity = groupByCommunityId(myAdminGroups);

  // Check if user is already blocked
  const isBlocked = userProfile!.blockedUsers.some(
    (blockedUser) => blockedUser.userId.toString() === userToBlock.toString()
  );

  if (isBlocked) {
    return await handleUnblockUser(userId, userToBlock);
  } else {
    return await handleBlockUser(userId, userToBlock, groupsByCommunity, myGroupsByCommunity);
  }
};
