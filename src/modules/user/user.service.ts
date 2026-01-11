import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import User from './user.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { NewCreatedUser, UpdateUserBody, IUserDoc, NewRegisteredUser, IUser } from './user.interfaces';
import { UserProfile, userProfileService } from '../userProfile';
import { UserProfileDocument } from '../userProfile/userProfile.interface';
import { communityModel } from '../community';
import { chatModel } from '../chat';

/**
 * Create a user
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createUser = async (userBody: NewCreatedUser): Promise<IUserDoc> => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create(userBody);
};

/**
 * Generate a unique refer code for a user
 * Format: CAPITAL_FIRSTNAME + random 4 digit number
 * @param {string} firstName
 * @returns {Promise<string>}
 */
const generateReferCode = async (firstName: string): Promise<string> => {
  const capitalFirstName = firstName.toUpperCase();
  let referCode: string;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit number (1000-9999)
    referCode = `${capitalFirstName}${randomDigits}`;
    const existingUser = await User.findOne({ referCode });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return referCode!;
};

/**
 * Register a user
 * @param {NewRegisteredUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const registerUser = async (userBody: NewRegisteredUser): Promise<IUserDoc> => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Handle referral code if provided
  let referredByUserId: mongoose.Types.ObjectId | null = null;
  if (userBody.referralCode) {
    const referringUser = await User.findOne({ referCode: userBody.referralCode });
    if (referringUser) {
      referredByUserId = referringUser._id;
    }
  }

  // Generate refer code for the new user
  const newReferCode = await generateReferCode(userBody.firstName);

  // Create user with referral information
  const userData = {
    ...userBody,
    referCode: newReferCode,
    referredBy: referredByUserId,
  };

  const user = new User(userData);
  const result = await user.save();
  return result;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryUsers = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserById = async (id: mongoose.Types.ObjectId): Promise<IUserDoc | null> => User.findById(id);

export const getUserProfileById = async (id: mongoose.Types.ObjectId, myUserId: string) => {
  const myProfile = await UserProfile.findOne({ users_id: myUserId }, { blockedUsers: 1 }).lean();
  const myUserObjectId = new mongoose.Types.ObjectId(myUserId);
  const myBlockedUserIds = myProfile?.blockedUsers?.map((b: any) => b.userId) || [];

  const [userProfile] = await User.aggregate([
    {
      $match: { _id: id },
    },
    {
      $match: {
        _id: { $nin: myBlockedUserIds },
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
      $lookup: {
        from: 'users',
        localField: 'profile.following.userId',
        foreignField: '_id',
        as: 'followingUsers',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'profile.followers.userId',
        foreignField: '_id',
        as: 'followersUsers',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'profile.following.userId',
        foreignField: 'users_id',
        as: 'followingProfiles',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'profile.followers.userId',
        foreignField: 'users_id',
        as: 'followersProfiles',
      },
    },

    {
      $addFields: {
        'profile.following': {
          $filter: {
            input: '$profile.following',
            as: 'f',
            cond: {
              $and: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$followingUsers',
                          as: 'u',
                          cond: {
                            $and: [{ $eq: ['$$u._id', '$$f.userId'] }, { $ne: ['$$u.isDeleted', true] }],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },

                { $not: { $in: ['$$f.userId', myBlockedUserIds] } },

                {
                  $not: {
                    $anyElementTrue: {
                      $map: {
                        input: {
                          $ifNull: [
                            {
                              $filter: {
                                input: '$followingProfiles',
                                as: 'fp',
                                cond: { $eq: ['$$fp.users_id', '$$f.userId'] },
                              },
                            },
                            [],
                          ],
                        },
                        as: 'fp',
                        in: {
                          $anyElementTrue: {
                            $map: {
                              input: { $ifNull: ['$$fp.blockedUsers', []] },
                              as: 'b',
                              in: { $eq: ['$$b.userId', myUserObjectId] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },

        'profile.followers': {
          $filter: {
            input: '$profile.followers',
            as: 'f',
            cond: {
              $and: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$followersUsers',
                          as: 'u',
                          cond: {
                            $and: [{ $eq: ['$$u._id', '$$f.userId'] }, { $ne: ['$$u.isDeleted', true] }],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },

                { $not: { $in: ['$$f.userId', myBlockedUserIds] } },

                {
                  $not: {
                    $anyElementTrue: {
                      $map: {
                        input: {
                          $ifNull: [
                            {
                              $filter: {
                                input: '$followersProfiles',
                                as: 'fp',
                                cond: { $eq: ['$$fp.users_id', '$$f.userId'] },
                              },
                            },
                            [],
                          ],
                        },
                        as: 'fp',
                        in: {
                          $anyElementTrue: {
                            $map: {
                              input: { $ifNull: ['$$fp.blockedUsers', []] },
                              as: 'b',
                              in: { $eq: ['$$b.userId', myUserObjectId] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        followingUsers: 0,
        followersUsers: 0,
      },
    },

    //start
    {
      $lookup: {
        from: 'communities',
        localField: 'profile.communities.communityId',
        foreignField: '_id',
        as: 'profile.communitiesData',
      },
    },
    {
      $addFields: {
        'profile.communities': {
          $map: {
            input: { $ifNull: ['$profile.communities', []] },
            as: 'comm',
            in: {
              $let: {
                vars: {
                  populated: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ['$profile.communitiesData', []] },
                          as: 'pop',
                          cond: { $eq: ['$$pop._id', '$$comm.communityId'] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  _id: '$$populated._id',
                  name: '$$populated.name',
                  logo: '$$populated.communityLogoUrl.imageUrl',
                  isVerifiedMember: {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ['$$populated.users', []] },
                                as: 'usr',
                                cond: {
                                  $and: [{ $eq: ['$$usr._id', id] }, { $eq: ['$$usr.isVerified', true] }],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      true,
                      false,
                    ],
                  },
                  isCommunityAdmin: {
                    $cond: [
                      {
                        $in: ['$_id', { $ifNull: ['$$populated.adminId', []] }],
                      },
                      true,
                      false,
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $project: {
        'profile.communitiesData': 0,
      },
    },
    // end

    {
      $match: {
        'profile.blockedUsers.userId': { $ne: new mongoose.Types.ObjectId(myUserId) },
      },
    },
    {
      $match: {
        isDeleted: { $ne: true },
      },
    },

    {
      $lookup: {
        from: 'communities',
        localField: 'profile.communities.communityId',
        foreignField: '_id',
        as: 'communityDetails',
      },
    },

    {
      $project: {
        password: 0,
      },
    },
  ]);

  return userProfile || null;
};

export const getUserProfileByUsername = async (userName: string) => {
  const userProfile = await User.aggregate([
    {
      $match: {
        userName: userName,
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
      $lookup: {
        from: 'communities',
        localField: 'profile.communities',
        foreignField: '_id',
        as: 'communityDetails',
      },
    },
    {
      $project: {
        password: 0,
      },
    },
  ]);
  return userProfile[0];
};

export const getAllUser = async (
  name: string = '',
  page: number,
  limit: number,
  userId: string,
  universityName: string,
  studyYear: string[],
  major: string[],
  occupation: string[],
  affiliation: string[],
  chatId: string
) => {
  const Currpage = page || 1;
  const limitpage = limit || 10;
  const startIndex = (Currpage - 1) * limitpage;
  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');
  const university_name = decodeURI(universityName || '');

  const loggedInUser = await UserProfile.findOne({ users_id: userId }).select('following blockedUsers');
  const followingIds = loggedInUser?.following.map((id) => id.userId.toString()) || [];

  const myBlockedUserIds = loggedInUser?.blockedUsers.map((u) => new mongoose.Types.ObjectId(u.userId.toString())) || [];
  const matchStage: any = {
    _id: {
      $ne: new mongoose.Types.ObjectId(userId),
      $nin: myBlockedUserIds,
    },
    isDeleted: { $ne: true },
    'profile.blockedUsers': {
      $not: {
        $elemMatch: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
    },
  };

  if (firstNametoPush) {
    matchStage.firstName = { $regex: new RegExp(firstNametoPush, 'i') };
  }

  if (lastNametopush) {
    matchStage.lastName = { $regex: new RegExp(lastNametopush, 'i') };
  }

  if (university_name.trim() !== '') {
    matchStage['profile.university_name'] = { $regex: new RegExp(university_name, 'i') };
  }

  const orConditions: any[] = [];

  if (studyYear.length && major.length) {
    orConditions.push({
      $and: [{ 'profile.study_year': { $in: studyYear } }, { 'profile.major': { $in: major } }],
    });
  } else if (studyYear.length) {
    orConditions.push({ 'profile.study_year': { $in: studyYear } });
  } else if (major.length) {
    orConditions.push({ 'profile.major': { $in: major } });
  }

  if (occupation.length && affiliation.length) {
    orConditions.push({
      $and: [{ 'profile.occupation': { $in: occupation } }, { 'profile.affiliation': { $in: affiliation } }],
    });
  } else if (occupation.length) {
    orConditions.push({ 'profile.occupation': { $in: occupation } });
  } else if (affiliation.length) {
    orConditions.push({ 'profile.affiliation': { $in: affiliation } });
  }

  if (orConditions.length) {
    matchStage.$or = orConditions;
  }

  if (chatId?.length) {
    const chat = await chatModel.findById(chatId).select('users.userId');
    const chatUserIds = chat?.users.map((u) => u.userId.toString()) || [];

    if (chatUserIds.length) {
      matchStage._id = {
        ...matchStage._id,
        $nin: chatUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
  }

  const users = await User.aggregate([
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    { $match: matchStage },
    {
      $addFields: {
        isFollowing: {
          $in: ['$_id', followingIds.map((id) => new mongoose.Types.ObjectId(id))],
        },
      },
    },
    {
      $project: {
        password: 0,
      },
    },
  ])
    .skip(startIndex)
    .limit(limitpage);

  const totalUsersAggregate = await User.aggregate([
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    { $match: matchStage },
    {
      $count: 'total',
    },
  ]);

  const totalUsers = totalUsersAggregate[0]?.total || 0;
  const totalPages = Math.ceil(totalUsers / limitpage);

  return { currentPage: Currpage, totalPages, users };
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserByEmail = async (email: string): Promise<IUserDoc | null> => User.findOne({ email });

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const updateUserById = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<IUserDoc | null>}
 */
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.deleteOne();
  return user;
};

//get Users with Profile data
export const getUsersWithProfile = async (name: string = '', userId: string) => {
  const profile: UserProfileDocument | null = await UserProfile.findOne({ users_id: userId }).populate('following.userId');
  const following = profile?.following as { userId: { _id: Types.ObjectId } }[] | undefined;

  const ids = following && following.map((id) => id.userId && id.userId._id);

  let query: any;

  query = {
    $and: [{ _id: { $ne: userId } }, { _id: { $nin: ids } }],
  };

  if (name) {
    let nameParts = name.split(' ').filter((part) => part);
    if (nameParts.length > 1) {
      query.$and = nameParts.map((part) => ({
        $or: [{ firstName: new RegExp(part, 'i') }, { lastName: new RegExp(part, 'i') }],
      }));
    } else {
      let regName = new RegExp(name, 'i');
      query.$or = [{ firstName: regName }, { lastName: regName }];
    }
  }

  const user: (IUser & { _id: string })[] | null = await User.find(query).select('firstName lastName _id ').lean();

  const userIds = user && user.map((user) => user._id);

  const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
    'profile_dp university_name study_year degree major users_id major occupation'
  );

  const userWithProfile =
    user &&
    user
      .map((user) => {
        const profile = userProfiles.find((profile) => profile.users_id.toString() == user._id.toString());
        return {
          ...user,
          profile,
          isFollowing: profile && profile.following.find((id) => id.userId.toString() == user._id),
        };
      })
      .filter((user) => user.profile !== undefined);

  return userWithProfile;
};

// join community

// join during verification
export const joinCommunityAfterEmailVerification = async (
  userId: mongoose.Types.ObjectId,
  communityName: string
  //   universityEmail: string
) => {
  const user = await getUserById(userId);
  let community: any = await communityModel.findOne({ name: communityName });
  const userProfile = await userProfileService.getUserProfileById(String(userId));

  const userSet = new Set(userProfile?.communities.map((community) => community.communityId));

  let status = { isUniversityCommunity: false, isAlreadyJoined: false };

  if (!user || !userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!community) {
    return status;
  }

  if (!userSet.has(String(community?._id))) {
    status.isUniversityCommunity = true;
    status.isAlreadyJoined = true;
    return status;
  }

  const updateUser = await communityModel.updateOne(
    { _id: community?._id },
    {
      $push: {
        users: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: userProfile.profile_dp?.imageUrl || null,
          universityName: userProfile.university_name,
          year: userProfile.study_year,
          degree: userProfile.degree,
          major: userProfile.major,
          isVerified: true,
        },
      },
    }
  );

  //   await userProfileService.addUniversityEmail(
  //     String(userId),
  //     universityEmail,
  //     communityName,
  //     community?._id.toString(),
  //     community?.communityLogoUrl?.imageUrl
  //   );

  status.isUniversityCommunity = true;

  return { status, updateUser };
};

export const findUsersByCommunityId = async (
  communityId: string,
  privacy: string = '',
  name: string = '',
  userID: string
) => {
  try {
    let query: any = {};

    if (privacy == 'Private') {
      query = {
        'userVerifiedCommunities.communityId': communityId,
        _id: { $ne: userID },
      };

      if (name) {
        const nameRegex = new RegExp(name, 'i');
        query.firstName = nameRegex;
      }
    } else {
      const communityConditions = [
        { 'userVerifiedCommunities.communityId': communityId },
        { 'userUnVerifiedCommunities.communityId': communityId },
      ];

      if (name) {
        const nameRegex = new RegExp(name, 'i');
        const nameConditions = [{ firstName: nameRegex }, { lastName: nameRegex }];

        query = {
          $and: [{ $or: communityConditions }, { $or: nameConditions }, { _id: { $ne: userID } }],
        };
      } else {
        query = {
          $or: communityConditions,
          _id: { $ne: userID },
        };
      }
    }

    const users = await User.find(query).select('firstName lastName _id userVerifiedCommunities');
    const userIds = users.map((user) => user._id);

    const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
      'profile_dp university_name study_year degree major users_id'
    );

    const result = users.map((user) => ({
      ...user.toObject(),
      profile: userProfiles.find((profile) => profile.users_id.toString() === user._id.toString()),
    }));

    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const findUsersByCommunityGroupId = async (communityGroupId: string, name: string = '', userID: string) => {
  try {
    interface UserQuery {
      'userVerifiedCommunities.communityGroups.communityGroupId': string;
      _id: {
        $ne: string; // or mongoose.Types.ObjectId if using ObjectId type
      };
      firstName?: string | RegExp;
    }

    let query: UserQuery = {
      'userVerifiedCommunities.communityGroups.communityGroupId': communityGroupId,
      _id: { $ne: userID },
    };

    const nameRegex = new RegExp(name, 'i');
    query.firstName = nameRegex;

    const users: (IUser & { _id: string })[] | null = await User.find(query)
      .select('firstName lastName _id userVerifiedCommunities userUnVerifiedCommunities')
      .lean();

    const userIds = users && users.map((user) => user._id);

    const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
      'profile_dp university_name study_year degree major users_id'
    );

    const result =
      users &&
      users.map((user) => {
        const profile = userProfiles.find((profile) => profile.users_id.toString() === user._id.toString());

        let verifiedGroup;
        let unVerifiedGroup;
        if (user.userVerifiedCommunities) {
          user.userVerifiedCommunities.forEach((verifiedCommunity) => {
            if (verifiedCommunity.communityGroups) {
              verifiedGroup = verifiedCommunity.communityGroups.find((group) => group.communityGroupId === communityGroupId);
            }
          });
        }

        if (user.userUnVerifiedCommunities) {
          user.userUnVerifiedCommunities.forEach((unVerifiedCommunity) => {
            if (unVerifiedCommunity.communityGroups) {
              unVerifiedGroup = unVerifiedCommunity.communityGroups.find(
                (group) => group.communityGroupId === communityGroupId
              );
            }
          });
        }

        return {
          ...user,
          profile,
          communityGroup: verifiedGroup || unVerifiedGroup, // Include the matching community group
        };
      });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const updateUserCommunityGroupRole = async (userId: string, communityGroupId: string, role: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  interface groupInter {
    communityGroupName: String;
    communityGroupId: String;
    role: string;
  }

  let updated = false;

  // Update the role in userVerifiedCommunities
  user.userVerifiedCommunities.forEach((verifiedCommunity) => {
    verifiedCommunity.communityGroups.forEach((group: groupInter) => {
      if (group.communityGroupId === communityGroupId) {
        group.role = role;
        updated = true;
      }
    });
  });

  // Update the role in userUnVerifiedCommunities if not found in userVerifiedCommunities
  if (!updated) {
    user.userUnVerifiedCommunities.forEach((unVerifiedCommunity) => {
      unVerifiedCommunity.communityGroups.forEach((group: groupInter) => {
        if (group.communityGroupId === communityGroupId) {
          group.role = role;
          updated = true;
        }
      });
    });
  }

  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
  }

  await user.save();
  return user;
};

export const updateUserCommunityRole = async (userId: string, communityId: string, role: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  let updated = false;

  // Update the role in userVerifiedCommunities
  user.userVerifiedCommunities.forEach((verifiedCommunity) => {
    if (communityId == verifiedCommunity.communityId.toString()) {
      verifiedCommunity.role = role;
      updated = true;
    }
  });

  if (!updated) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  await user.save();
  return user;
};

export const UserEmailAndUserNameAvailability = async (email: string, userName: string) => {
  const [userEmail, userNameAvailable] = await Promise.all([User.findOne({ email }), User.findOne({ userName })]);

  if (userEmail) {
    throw new ApiError(httpStatus.CONFLICT, 'Email is already taken');
  }

  if (userNameAvailable) {
    throw new ApiError(httpStatus.CONFLICT, 'userName Already taken');
  }

  return { message: 'Both email and username are available' };
};

export const UserEmailAvailability = async (email: string) => {
  const userEmail = await User.findOne({ email });

  if (!userEmail) {
    throw new ApiError(httpStatus.CONFLICT, 'Email does not exist');
  }

  return { message: 'Email is available' };
};

export const changeUserName = async (userID: string, userName: string, newUserName: string, password: string) => {
  const [user, userNameAvailable] = await Promise.all([User.findById(userID), User.findOne({ userName: newUserName })]);

  if (!user) {
    throw new ApiError(httpStatus.CONFLICT, 'user does not exist');
  }
  if (user?.userName !== userName) {
    throw new ApiError(httpStatus.CONFLICT, 'userName does not match');
  }
  if (user?.userName == newUserName) {
    throw new ApiError(httpStatus.CONFLICT, 'New username cannot be the same as the current username.');
  }

  if (userNameAvailable) {
    throw new ApiError(httpStatus.CONFLICT, 'userName is already taken');
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.CONFLICT, 'Password is incorrect!');
  }

  user.userName = newUserName;

  await user.save();
  return user;
};
export const changeUserPassword = async (userID: string, password: string, newPassword: string) => {
  const user = await User.findById(userID);

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'user does not exist');
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password is incorrect!');
  }
  await user.isNewPasswordDifferent(newPassword);

  user.password = newPassword;

  user.save();
  return user;
};

export const changeUserEmail = async (userID: string, email: string, newMail: string) => {
  const user = await User.findById(userID);

  if (!user) {
    throw new ApiError(httpStatus.CONFLICT, 'user does not exist');
  }

  if (user.email !== email) {
    throw new ApiError(httpStatus.CONFLICT, 'Email does not match');
  }

  user.email = newMail;

  user.save();
  return user;
};

/**
 * Get all users referred by a specific user with populated referral details
 * @param {mongoose.Types.ObjectId} userId
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Number of results per page (default: 10)
 * @returns {Promise<{referCode: string, totalReferrals: number, currentPage: number, totalPages: number, referrals: IUserDoc[]}>}
 */
export const getReferredUsers = async (
  userId: mongoose.Types.ObjectId,
  page: number = 1,
  limit: number = 10
): Promise<{
  referCode: string | undefined;
  totalReferrals: number;
  currentPage: number;
  totalPages: number;
  referrals: IUserDoc[];
}> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const currentPage = page || 1;
  const limitPerPage = limit || 10;
  const skip = (currentPage - 1) * limitPerPage;

  // Build the filter for referred users
  const filter = {
    referredBy: userId,
    isDeleted: { $ne: true },
  };

  // Get total count and paginated results
  const [totalReferrals, referredUsers] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitPerPage).lean(),
  ]);

  const totalPages = Math.ceil(totalReferrals / limitPerPage);

  return {
    referCode: user.referCode,
    totalReferrals,
    currentPage,
    totalPages,
    referrals: referredUsers as IUserDoc[],
  };
};
export const deActivateUserAccount = async (userID: string, userName: string, email: string, password: string) => {
  const user = await User.findById(userID);

  if (!user) {
    throw new ApiError(httpStatus.CONFLICT, 'user does not exist');
  }
  if (user?.userName !== userName) {
    throw new ApiError(httpStatus.CONFLICT, 'userName does not match');
  }

  if (user.email !== email) {
    throw new ApiError(httpStatus.CONFLICT, 'Email does not match');
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.CONFLICT, 'Password is incorrect!');
  }

  user.isUserDeactive = true;

  user.save();
  return user;
};

export const IsNewUserFalse = async (userID: string) => {
  const user = await User.findById(userID);

  if (!user) {
    throw new ApiError(httpStatus.CONFLICT, 'user does not exist');
  }

  user.isNewUser = false;

  user.save();
  return user;
};

export const softDeleteUserById = async (userId: mongoose.Types.ObjectId, password: string) => {
  const [user, userProfile] = await Promise.all([User.findById(userId), UserProfile.findOne({ users_id: userId })]);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.CONFLICT, 'Password is incorrect!');
  }

  if (userProfile?.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is admin of a community and cannot be deleted');
  }
  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();
  return user;
};
