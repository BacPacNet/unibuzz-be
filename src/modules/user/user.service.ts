import httpStatus from 'http-status';
import mongoose from 'mongoose';
import User from './user.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { NewCreatedUser, UpdateUserBody, IUserDoc, NewRegisteredUser } from './user.interfaces';
import { UserProfile } from '../userProfile';

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
  return User.create(userBody);
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
export const getUsersWithProfile=async(name:string,userId:string)=>{

  const profile:any = await UserProfile.findOne({ users_id: userId }).populate('following.userId')
  const ids = profile.following.map((id:any)=>id.userId._id)
  let query:any

  query = {
    $and: [
      { _id: { $ne: userId } },
      { _id: { $nin: ids } }
    ]
  }

  if (name) {
    let nameParts = name.split(' ').filter(part => part); 
    if (nameParts.length > 1) {
      query.$and = nameParts.map(part => ({
        $or: [
          { firstName: new RegExp(part, "i") },
          { lastName: new RegExp(part, "i") }
        ]
      }));
    } else {

      let regName = new RegExp(name, "i");
      query.$or = [
        { firstName: regName },
        { lastName: regName }
      ];
    }
  }

  const user:any =await User.find(query).select('firstName lastName _id ').lean()

  const userIds = user.map((user:any) => user._id);

  const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
    'profile_dp university_name study_year degree major users_id major occupation'
  );

  const userWithProfile = user.map((user:any)=>{
    const profile = userProfiles.find((profile)=> profile.users_id.toString() == user._id.toString())
    return{
      ...user,
      profile
    }
    
  })
  return userWithProfile

}

// join community

export const joinCommunity = async (
  userId: mongoose.Types.ObjectId,
  cummunityId: string,
  communityName: string,
  isAllowed: boolean = false
) => {
  const user = await getUserById(userId);

  const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];
  const userUnverifiedVerifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userVerifiedCommunityIds.includes(cummunityId) || userUnverifiedVerifiedCommunityIds.includes(cummunityId)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already Joined!');
  }

  if (userUnverifiedVerifiedCommunityIds.length >= 1 && !isAllowed && user.role != 'admin') {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Already joined at 1 UnVerified university');
  }

  let updatedUser;
  if (isAllowed) {
    updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $push: { userVerifiedCommunities: { communityName: communityName, communityId: cummunityId } } },
      { new: true }
    );
  } else {
    updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $push: { userUnVerifiedCommunities: { communityName: communityName, communityId: cummunityId } } },
      { new: true }
    );
  }

  return updatedUser;
};

//leave community
export const leaveCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  const user = await getUserById(userId);

  const userUnverifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];
  const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!userUnverifiedCommunityIds.includes(communityId) && !userVerifiedCommunityIds.includes(communityId)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not joined in this community!');
  }

  let updateQuery = {};
  if (userUnverifiedCommunityIds.includes(communityId)) {
    updateQuery = { $pull: { userUnVerifiedCommunities: { communityId } } };
  } else if (userVerifiedCommunityIds.includes(communityId)) {
    updateQuery = { $pull: { userVerifiedCommunities: { communityId } } };
  }

  const updatedUser = await User.findOneAndUpdate({ _id: userId }, updateQuery, { new: true });

  return updatedUser;
};

export const findUsersByCommunityId = async (communityId: string, privacy: string, name: string, userID: string) => {
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

    const users = await User.find(query).select('firstName lastName _id');
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

export const findUsersByCommunityGroupId = async (communityGroupId: string, name: string, userID: string) => {
  try {
    let query: any = {
      'userVerifiedCommunities.communityGroups.communityGroupId': communityGroupId,
      _id: { $ne: userID },
    };

    const nameRegex = new RegExp(name, 'i');
    query.firstName = nameRegex;

    const users = await User.find(query).select('firstName lastName _id userVerifiedCommunities userUnVerifiedCommunities');

    const userIds = users.map((user) => user._id);

    const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
      'profile_dp university_name study_year degree major users_id'
    );

    const result = users.map((user: any) => {
      const profile = userProfiles.find((profile) => profile.users_id.toString() === user._id.toString());

      let verifiedGroup;
      let unVerifiedGroup;
      if (user.userVerifiedCommunities) {
        user.userVerifiedCommunities.forEach((verifiedCommunity: any) => {
          if (verifiedCommunity.communityGroups) {
            verifiedGroup = verifiedCommunity.communityGroups.find(
              (group: any) => group.communityGroupId === communityGroupId
            );
          }
        });
      }

      if (user.userUnVerifiedCommunities) {
        user.userUnVerifiedCommunities.forEach((unVerifiedCommunity: any) => {
          if (unVerifiedCommunity.communityGroups) {
            unVerifiedGroup = unVerifiedCommunity.communityGroups.find(
              (group: any) => group.communityGroupId === communityGroupId
            );
          }
        });
      }

      return {
        ...user.toObject(),
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

  let updated = false;

  // Update the role in userVerifiedCommunities
  user.userVerifiedCommunities.forEach((verifiedCommunity) => {
    verifiedCommunity.communityGroups.forEach((group: any) => {
      if (group.communityGroupId === communityGroupId) {
        group.role = role;
        updated = true;
      }
    });
  });

  // Update the role in userUnVerifiedCommunities if not found in userVerifiedCommunities
  if (!updated) {
    user.userUnVerifiedCommunities.forEach((unVerifiedCommunity) => {
      unVerifiedCommunity.communityGroups.forEach((group: any) => {
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
