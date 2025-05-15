import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import User from './user.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { NewCreatedUser, UpdateUserBody, IUserDoc, NewRegisteredUser, IUser } from './user.interfaces';
import { UserProfile, userProfileService } from '../userProfile';
import { UserProfileDocument } from '../userProfile/userProfile.interface';
import { communityModel } from '../community';

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
 * Register a user
 * @param {NewRegisteredUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const registerUser = async (userBody: NewRegisteredUser): Promise<IUserDoc> => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const user = new User(userBody);
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

export const getUserProfileById = async (id: mongoose.Types.ObjectId) => {
  const userProfile = await User.aggregate([
    {
      $match: {
        _id: id,
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: '_id', // The field in the User schema to match
        foreignField: 'users_id', // The field in the UserProfile schema to match
        as: 'profile',
      },
    },
    {
      $unwind: {
        path: '$profile', // Unwind the profile array to get a single object
        preserveNullAndEmptyArrays: true, // Include users without a matching profile
      },
    },
    {
      $lookup: {
        from: 'communities', // Collection name for communities
        localField: 'profile.communities', // Array of community ObjectIds in profile
        foreignField: '_id', // Matching field in the communities collection
        as: 'communityDetails', // Resulting array with community data
      },
    },
    {
      $project: {
        password: 0, // Exclude the password field
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
  affiliation: string[]
) => {
  const Currpage = page || 1;
  const limitpage = limit || 10;
  const startIndex = (Currpage - 1) * limitpage;
  const [firstNametoPush = '', lastNametopush = ''] = name.split(' ');
  const university_name = decodeURI(universityName || '');

  const loggedInUser = await UserProfile.findOne({ users_id: userId }).select('following');
  const followingIds = loggedInUser?.following.map((id) => id.userId.toString()) || [];

  const matchStage: any = {
    _id: { $ne: new mongoose.Types.ObjectId(userId) },
  };

  if (firstNametoPush) {
    matchStage.firstName = { $regex: new RegExp(firstNametoPush, 'i') };
  }

  if (lastNametopush) {
    matchStage.lastName = { $regex: new RegExp(lastNametopush, 'i') };
  }

  // Only apply university_name filter if provided
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

export const changeUserName = async (userID: string, userName: string, newUserName: string, password: string) => {
  const user = await User.findById(userID);

  if (!user) {
    throw new ApiError(httpStatus.CONFLICT, 'user does not exist');
  }
  if (user?.userName !== userName) {
    throw new ApiError(httpStatus.CONFLICT, 'userName does not match');
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
