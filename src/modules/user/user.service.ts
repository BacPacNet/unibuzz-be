import httpStatus from 'http-status';
import mongoose from 'mongoose';
import User from './user.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import {
  NewCreatedUser,
  UpdateUserBody,
  IUserDoc,
  NewRegisteredUser,
  IUserQueryFilter,
} from './user.interfaces';
import { UserProfile } from '../userProfile';
import { chatModel } from '../chat';
import {
  getProfileByIdPipeline,
  getAllUserPipeline,
  buildGetAllUserOrConditions,
  buildGetAllUserMatchStage,
} from './user.pipeline';
import {
  getPaginationSkip,
  computeTotalPages,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  convertToObjectId,
} from '../../utils/common';
import config from '../../config/config';
import * as rewardRedemptionService from '../rewardRedemption/rewardRedemption.service';
import { RewardRedemptionStatus } from '../rewardRedemption/rewardRedemption.interface';
import { universityVerificationEmailModal } from '../universityVerificationEmail';
import { UniversityVerificationEmailStatus } from '../universityVerificationEmail/universityVerificationEmail.interface';

/** Centralized user-related error messages and status for consistency */
const USER_ERROR_MESSAGES = {
  USER_DOES_NOT_EXIST: 'user does not exist',
  PASSWORD_INCORRECT: 'Password is incorrect!',
  USERNAME_DOES_NOT_MATCH: 'userName does not match',
  EMAIL_DOES_NOT_MATCH: 'Email does not match',
  USERNAME_ALREADY_TAKEN: 'userName Already taken',
  NEW_USERNAME_SAME_AS_CURRENT: 'New username cannot be the same as the current username.',
  EMAIL_ALREADY_TAKEN: 'Email is already taken',
  EMAIL_DOES_NOT_EXIST: 'Email does not exist',
  USER_ADMIN_CANNOT_BE_DELETED: 'User is admin of a community and cannot be deleted',
} as const;

/**
 * Ensure email is not already taken; throws ApiError if taken.
 * @param {string} email
 * @param {mongoose.Types.ObjectId} [excludeUserId] - User ID to exclude (e.g. when updating own email)
 */
export const ensureEmailNotTaken = async (
  email: string,
  excludeUserId?: mongoose.Types.ObjectId
): Promise<void> => {
  if (await User.isEmailTaken(email, excludeUserId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, USER_ERROR_MESSAGES.EMAIL_ALREADY_TAKEN);
  }
};

/**
 * Create a user
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createUser = async (userBody: NewCreatedUser): Promise<IUserDoc> => {
  await ensureEmailNotTaken(userBody.email);
  return User.create(userBody);
};



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
  await ensureEmailNotTaken(userBody.email);

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
export const queryUsers = async (filter: IUserQueryFilter, options: IOptions): Promise<QueryResult> => {
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
 * Get user by id or throw ApiError if not found
 * @param {mongoose.Types.ObjectId | string} id
 * @param {number} status - HTTP status code for the error (default: NOT_FOUND)
 * @param {string} message - Error message (default: 'User not found')
 * @returns {Promise<IUserDoc>}
 */
const getUserByIdOrThrow = async (
  id: mongoose.Types.ObjectId | string,
  status: number = httpStatus.NOT_FOUND,
  message: string = 'User not found'
): Promise<IUserDoc> => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(status, message);
  }
  return user;
};

/**
 * Helper: get user by id or throw, run async validations, apply update, save and return user.
 * Use for changeUserName, changeUserPassword, changeUserEmail, deActivateUserAccount, IsNewUserFalse.
 */
const updateUserAfterValidation = async (
  userID: string,
  throwOptions: { status?: number; message?: string },
  validate: (user: IUserDoc) => Promise<void>,
  update: (user: IUserDoc) => void
): Promise<IUserDoc> => {
  const user = await getUserByIdOrThrow(
    userID,
    throwOptions.status ?? httpStatus.CONFLICT,
    throwOptions.message ?? USER_ERROR_MESSAGES.USER_DOES_NOT_EXIST
  );
  await validate(user);
  update(user);
  await user.save();
  return user;
};

export const getUserProfileById = async (id: mongoose.Types.ObjectId, myUserId: string) => {
  const myProfile = await UserProfile.findOne({ users_id: myUserId }, { blockedUsers: 1 }).lean();
  const myUserObjectId = new mongoose.Types.ObjectId(myUserId);
  const myBlockedUserIds =
    myProfile?.blockedUsers?.map((b) => convertToObjectId(b.userId.toString())) || [];

  const pipeline = getProfileByIdPipeline({
    id,
    myUserId,
    myBlockedUserIds,
    myUserObjectId,
  });

  const [userProfile] = await User.aggregate(pipeline);
  return userProfile || null;
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
  const currentPage = page || DEFAULT_PAGE;
  const limitPerPage = limit || DEFAULT_LIMIT;
  const startIndex = getPaginationSkip(currentPage, limitPerPage);
  const [firstName = '', lastName = ''] = name.split(' ');
  const decodedUniversityName = decodeURI(universityName || '');

  const loggedInUser = await UserProfile.findOne({ users_id: userId }).select('following blockedUsers');
  const followingIds = loggedInUser?.following.map((id) => id.userId.toString()) || [];
  const myBlockedUserIds = loggedInUser?.blockedUsers.map((u) => convertToObjectId(u.userId.toString())) || [];

  const orConditions = buildGetAllUserOrConditions(studyYear, major, occupation, affiliation);
  const matchStage = buildGetAllUserMatchStage({
    userId,
    myBlockedUserIds,
    firstName,
    lastName,
    universityName: decodedUniversityName,
    orConditions,
  });

  if (chatId?.length) {
    const chat = await chatModel.findById(chatId).select('users.userId');
    const chatUserIds = chat?.users.map((u) => u.userId.toString()) || [];
    if (chatUserIds.length) {
      matchStage._id = {
        ...matchStage._id,
        $nin: chatUserIds.map((id) => convertToObjectId(id)),
      };
    }
  }

  const pipeline = getAllUserPipeline({
    matchStage,
    followingIds,
    skip: startIndex,
    limit: limitPerPage,
  });
  const [result] = await User.aggregate(pipeline);

  const users = result?.users ?? [];
  const totalUsers = result?.totalCount?.[0]?.total ?? 0;
  const totalPages = computeTotalPages(totalUsers, limitPerPage);

  return { currentPage, totalPages, users };
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserByEmail = async (email: string): Promise<IUserDoc | null> => User.findOne({ email });



/**
 * Delete user by id
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<IUserDoc | null>}
 */
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  const user = await getUserByIdOrThrow(userId);
  await user.deleteOne();
  return user;
};

export const userEmailAndUserNameAvailability = async (email: string, userName: string) => {
  const [userEmail, userNameAvailable,universityVerificationEmail] = await Promise.all([User.findOne({ email }), User.findOne({ userName }),universityVerificationEmailModal.findOne({ email })]);

  if (userEmail) {
    throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.EMAIL_ALREADY_TAKEN);
  }
  if (universityVerificationEmail?.status === UniversityVerificationEmailStatus.COMPLETE) {
    throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.EMAIL_ALREADY_TAKEN);
  }

  if (userNameAvailable) {
    throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.USERNAME_ALREADY_TAKEN);
  }

  return { message: 'Both email and username are available' };
};

export const userEmailAvailability = async (email: string) => {
  const userEmail = await User.findOne({ email });

  if (!userEmail) {
    throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.EMAIL_DOES_NOT_EXIST);
  }

  return { message: 'Email is available' };
};

export const changeUserName = async (userID: string, userName: string, newUserName: string, password: string) => {
  return updateUserAfterValidation(
    userID,
    { status: httpStatus.CONFLICT, message: USER_ERROR_MESSAGES.USER_DOES_NOT_EXIST },
    async (user) => {
      const userNameAvailable = await User.findOne({ userName: newUserName });
      if (user.userName === newUserName) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.NEW_USERNAME_SAME_AS_CURRENT);
      }
      if (user.userName !== userName) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.USERNAME_DOES_NOT_MATCH);
      }
    
      if (userNameAvailable) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.USERNAME_ALREADY_TAKEN);
      }
      if (!(await user.isPasswordMatch(password))) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.PASSWORD_INCORRECT);
      }
    },
    (user) => {
      user.userName = newUserName;
    }
  );
};

export const changeUserPassword = async (userID: string, password: string, newPassword: string) => {
  return updateUserAfterValidation(
    userID,
    { status: httpStatus.UNAUTHORIZED, message: USER_ERROR_MESSAGES.USER_DOES_NOT_EXIST },
    async (user) => {
      if (!(await user.isPasswordMatch(password))) {
        throw new ApiError(httpStatus.UNAUTHORIZED, USER_ERROR_MESSAGES.PASSWORD_INCORRECT);
      }
      await user.isNewPasswordDifferent(newPassword);
    },
    (user) => {
      user.password = newPassword;
    }
  );
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
  const user = await getUserByIdOrThrow(userId);

  const currentPage = page || DEFAULT_PAGE;
  const limitPerPage = limit || DEFAULT_LIMIT;
  const skip = getPaginationSkip(currentPage, limitPerPage);

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

  const totalPages = computeTotalPages(totalReferrals, limitPerPage);

  return {
    referCode: user.referCode,
    totalReferrals,
    currentPage,
    totalPages,
    referrals: referredUsers as IUserDoc[],
  };
};
export const deActivateUserAccount = async (userID: string, userName: string, email: string, password: string) => {
  return updateUserAfterValidation(
    userID,
    { status: httpStatus.CONFLICT, message: USER_ERROR_MESSAGES.USER_DOES_NOT_EXIST },
    async (user) => {
      if (user.userName !== userName) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.USERNAME_DOES_NOT_MATCH);
      }
      if (user.email !== email) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.EMAIL_DOES_NOT_MATCH);
      }
      if (!(await user.isPasswordMatch(password))) {
        throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.PASSWORD_INCORRECT);
      }
    },
    (user) => {
      user.isUserDeactive = true;
    }
  );
};

export const IsNewUserFalse = async (userID: string) => {
  return updateUserAfterValidation(
    userID,
    { status: httpStatus.CONFLICT, message: USER_ERROR_MESSAGES.USER_DOES_NOT_EXIST },
    async () => {},
    (user) => {
      user.isNewUser = false;
    }
  );
};

export const softDeleteUserById = async (userId: mongoose.Types.ObjectId, password: string) => {
  const [user, userProfile] = await Promise.all([
    getUserByIdOrThrow(userId),
    UserProfile.findOne({ users_id: userId }),
  ]);

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.CONFLICT, USER_ERROR_MESSAGES.PASSWORD_INCORRECT);
  }

  if (userProfile?.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, USER_ERROR_MESSAGES.USER_ADMIN_CANNOT_BE_DELETED);
  }
  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();
  return user;
};







type RewardProgress = {
  reward: number;
  leftoverInvites: number;
  rewardedInvites: number;
};

function startOfUtcMonthAfter(rewardMonth: Date): Date {
  return new Date(Date.UTC(rewardMonth.getUTCFullYear(), rewardMonth.getUTCMonth() + 1, 1));
}

function calculateRewardProgress(totalInvites: number): RewardProgress {
  if (totalInvites < 10) {
    return {
      reward: 0,
      leftoverInvites: totalInvites,
      rewardedInvites: 0,
    };
  }

  if (totalInvites < 15) {
    return {
      reward: 100,
      leftoverInvites: totalInvites - 10,
      rewardedInvites: 10,
    };
  }

  if (totalInvites < 20) {
    return {
      reward: 200,
      leftoverInvites: totalInvites - 15,
      rewardedInvites: 15,
    };
  }

  const extraInvites = totalInvites - 20;
  const extraBlocks = Math.floor(extraInvites / 5);
  const rewardedInvites = 20 + extraBlocks * 5;

  return {
    reward: 400 + extraBlocks * 100,
    leftoverInvites: totalInvites - rewardedInvites,
    rewardedInvites,
  };
}


/**
 * Get all users referred by a specific user with populated referral details
 * @param {mongoose.Types.ObjectId} userId
  * @param {number} page - Page number (default: 1)
  * @param {number} limit - Number of results per page (default: 10)
 * @returns {Promise<{referCode: string, totalReferrals: number, currentPage: number, totalPages: number, referrals: IUserDoc[]}>}
 */
export const getRewardsDetails = async (
  userId: mongoose.Types.ObjectId,
): Promise<{
  referCode: string | undefined;
  totalInvites: number;
  totalEarning: number;
  thisMonthProgress: number;
  previousMonthProgress: number;
  thisMonthReward: number;
  previousMonthReward: number;
  thisMonthLeftoverInvites: number;
  previousMonthLeftoverInvites: number;
  previousMonthTotalInvites: number;
  previousMonthRedeemed: boolean;
  currentUPI: string | null;
}> => {
  const parseAllowedCommunityIds = (rawValue: string | undefined): string[] => {
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch (_err) {
      // Fallback to comma-separated values when env is not JSON.
    }

    return rawValue
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  };

  const getUtcMonthBoundaries = (baseDate: Date) => {
    const startOfThisMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
    const startOfNextMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
    const startOfPreviousMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - 1, 1));

    return {
      startOfThisMonth,
      startOfNextMonth,
      startOfPreviousMonth,
    };
  };

  const user = await getUserByIdOrThrow(userId);
  const allowedCommunityIds = parseAllowedCommunityIds(config.ALLOWED_COMMUNITY_IDS_FOR_REWARD_ELIGIBILITY);
  const { startOfThisMonth, startOfNextMonth, startOfPreviousMonth } = getUtcMonthBoundaries(new Date());
  // const { startOfThisMonth, startOfPreviousMonth } = getUtcMonthBoundaries(new Date());


  const baseFilter = {
    referredBy: userId,
    isDeleted: { $ne: true },
  };

  const getEligibleReferralCount = async (startDate: Date, endExclusive: Date): Promise<number> => {
    if (!allowedCommunityIds.length) {
      return 0;
    }

    const [result] = await User.aggregate<{ count: number }>([
      {
        $match: {
          ...baseFilter,
          createdAt: {
            $gte: startDate,
            $lt: endExclusive,
          },
        },
      },
      {
        $lookup: {
          from: UserProfile.collection.name,
          localField: '_id',
          foreignField: 'users_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      { $unwind: '$profile.email' },
      {
        $match: {
          'profile.email.communityId': { $in: allowedCommunityIds },
        },
      },
      {
        $project: {
          normalizedUniversityEmail: {
            $toLower: {
              $trim: {
                input: { $ifNull: ['$profile.email.UniversityEmail', ''] },
              },
            },
          },
        },
      },
      { $match: { normalizedUniversityEmail: { $ne: '' } } },
      { $group: { _id: '$normalizedUniversityEmail' } },
      { $count: 'count' },
    ]);
    return result?.count ?? 0;
  };

  const [thisMonthNewReferrals, previousMonthRedemption, anchorBeforePreviousMonth] =
    await Promise.all([
      getEligibleReferralCount(startOfThisMonth, startOfNextMonth),
      rewardRedemptionService.getRewardRedemptionForMonth(userId, startOfPreviousMonth),
      rewardRedemptionService.getLatestRewardRedemptionBeforeMonth(userId, startOfPreviousMonth),
    ]);

  let previousMonthComputedTotalInvites: number;
  let previousMonthComputed: RewardProgress;

  if (previousMonthRedemption) {
    previousMonthComputedTotalInvites = previousMonthRedemption.totalInvites;
    previousMonthComputed = calculateRewardProgress(previousMonthComputedTotalInvites);
  } else {
    const previousMonthCountStart = anchorBeforePreviousMonth
      ? startOfUtcMonthAfter(anchorBeforePreviousMonth.rewardMonth)
      : new Date(0);
    const previousMonthReferralsAfterAnchor = await getEligibleReferralCount(
      previousMonthCountStart,
      startOfThisMonth
    );
    const previousMonthCarryFromAnchor = anchorBeforePreviousMonth?.totalInvites ?? 0;
    previousMonthComputedTotalInvites = previousMonthCarryFromAnchor + previousMonthReferralsAfterAnchor;
    previousMonthComputed = calculateRewardProgress(previousMonthComputedTotalInvites);
  }

  // If no row exists for previous month, create it as processing (closed month — not pending).
  const ensuredPreviousMonthRedemption =
    previousMonthRedemption ??
    (await rewardRedemptionService.upsertRewardRedemptionForMonth({
      userId,
      rewardMonth: startOfPreviousMonth,
      status: RewardRedemptionStatus.Processing,
      amount: previousMonthComputed.reward || 0,
      totalInvites: previousMonthComputedTotalInvites,
      leftoverInvites: previousMonthComputed.leftoverInvites,
    }));

  const isPreviousMonthFinalized =
    ensuredPreviousMonthRedemption.status === RewardRedemptionStatus.Processing ||
    ensuredPreviousMonthRedemption.status === RewardRedemptionStatus.Completed;

  const carryIntoThisMonth = previousMonthComputed.leftoverInvites;

  const thisMonthProgress = carryIntoThisMonth + thisMonthNewReferrals;
  const thisMonthCalculated = calculateRewardProgress(thisMonthProgress);
  const allPreviousRedemptions = await rewardRedemptionService.getRewardRedemptionsBeforeMonth(
    userId,
    startOfThisMonth
  );
  const allTimeInvites = allPreviousRedemptions.reduce(
    (sum, redemption) => sum + (redemption.totalInvites ?? 0),
    0
  );
  const allTimeCalculated = calculateRewardProgress(allTimeInvites);
  const previousMonthRedeemed = !!ensuredPreviousMonthRedemption;

  const previousMonthProgress = isPreviousMonthFinalized
    ? (ensuredPreviousMonthRedemption.totalInvites ?? previousMonthComputedTotalInvites)
    : previousMonthComputedTotalInvites;
  const previousMonthReward = isPreviousMonthFinalized
    ? (ensuredPreviousMonthRedemption.amount ?? previousMonthComputed.reward)
    : previousMonthComputed.reward;
  const previousMonthLeftoverInvites = isPreviousMonthFinalized
    ? (ensuredPreviousMonthRedemption.leftoverInvites ?? previousMonthComputed.leftoverInvites)
    : previousMonthComputed.leftoverInvites;

  return {
    referCode: user.referCode,
    totalInvites: allTimeCalculated.rewardedInvites,
    totalEarning: allTimeCalculated.reward || 0,
    thisMonthProgress,
    previousMonthProgress,
    thisMonthReward: thisMonthCalculated.reward || 0,
    previousMonthReward: previousMonthReward || 0,
    thisMonthLeftoverInvites: thisMonthCalculated.leftoverInvites,
    previousMonthLeftoverInvites,
    previousMonthTotalInvites: previousMonthProgress,
    previousMonthRedeemed,
    currentUPI:ensuredPreviousMonthRedemption?.upiId || null,
  };
};
