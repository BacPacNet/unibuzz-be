import httpStatus from 'http-status';
import { ApiError } from '../errors';
import {
  EditProfileRequest,
  CreateUserProfileBody,
  StatusChangeHistoryEntry,
  BlockedUserEntry,
  FollowingListItem,
  FollowListItem,
  UserProfileDocument,
  UserCommunities,
} from './userProfile.interface';
import UserProfile from './userProfile.model';
import mongoose, { HydratedDocument } from 'mongoose';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import { communityModel } from '../community';
import User from '../user/user.model';
import { communityGroupModel } from '../communityGroup';
import { chatModel } from '../chat';
import {
  getFollowListPipelineStages,
  getBlockedUsersPipelineStages,
  getFollowingAndMutualsPipelineStages,
} from './userProfile.pipeline';
import { getPaginationSkip, computeTotalPages, DEFAULT_PAGE, DEFAULT_LIMIT } from '../../utils/common';

// =============================================================================
// CONSTANTS & TYPES
// =============================================================================

// Profile validation constants
const BIO_MAX_LENGTH = 160;
const STATUS_CHANGE_WINDOW_DAYS = 14;
const MAX_STATUS_CHANGES_IN_WINDOW = 2;

// Field names
const FIELD_USERS_ID = 'users_id';
const FIELD_FOLLOWING = 'following';
const FIELD_FOLLOWERS = 'followers';
const FIELD_BLOCKED_USERS = 'blockedUsers';

// Select strings for .select() / populate
const SELECT_USER_FIRST_LAST_NAME = 'firstName lastName';
const SELECT_UNIVERSITY_FIELDS = 'name country logos images';
const SELECT_PROFILE_FIELDS_FOR_FOLLOW =
  'profile_dp degree major study_year university_name role affiliation occupation';
const SELECT_FOLLOWING_FOLLOWERS = 'following followers';

// Block operation result status
const BLOCK_STATUS_BLOCKED = 'blocked';
const BLOCK_STATUS_UNBLOCKED = 'unblocked';
export type BlockStatus = typeof BLOCK_STATUS_BLOCKED | typeof BLOCK_STATUS_UNBLOCKED;

// Error messages (university email & profile)
const ERR_USER_PROFILE_NOT_FOUND = 'User profile not found.';
const ERR_USER_PROFILE_NOT_FOUND_UPDATE = 'User Profile not found!';
const ERR_UNIVERSITY_EMAIL_ALREADY_EXISTS = 'University email already exists in profile.';
const ERR_FAILED_TO_UPDATE_USER_PROFILE = 'Failed to update user profile.';
const ERR_BIO_TOO_LONG = `Bio must not exceed ${BIO_MAX_LENGTH} characters`;
const ERR_STATUS_CHANGE_LIMIT = `You can only change your status ${MAX_STATUS_CHANGES_IN_WINDOW} times within ${STATUS_CHANGE_WINDOW_DAYS} days`;
// Block operation
const ERR_USER_NOT_FOUND = 'User not found';
const ERR_ADMIN_CANNOT_BLOCK = 'You are an admin and cannot block other users.';
const ERR_CANNOT_BLOCK_ADMIN = 'User to block is an admin of a community and cannot be blocked';

/** Safely converts ObjectId-like value to mongoose.Types.ObjectId (avoids Schema vs mongoose type mismatch). */
const toMongooseObjectId = (value: unknown): mongoose.Types.ObjectId => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const nested = (value as { _id: unknown })._id;
    return new mongoose.Types.ObjectId(nested != null ? String(nested) : undefined);
  }
  return new mongoose.Types.ObjectId(value != null ? String(value) : undefined);
};

/** Type guard for non-null ObjectId in filter. */
const isNonNullObjectId = (id: mongoose.Types.ObjectId | null): id is mongoose.Types.ObjectId => id != null;


// =============================================================================
// SHARED HELPERS (follow/list, name filter, pagination)
// =============================================================================

/**
 * Queues a follow/unfollow notification (fire-and-forget, logs errors)
 */
const queueFollowNotification = async (notification: {
  sender_id: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  type: NotificationIdentifier;
  message: string;
}) => {
  try {
    await queueSQSNotification(notification);
  } catch (err) {
    console.error('Failed to enqueue notification', { notification, error: err });
  }
};

/**
 * Returns MongoDB $or filter for firstName/lastName search from a name string
 */
const buildNameFilter = (name: string): { $or: Array<Record<string, { $regex: RegExp }>> } => {
  const [firstName = '', lastName = ''] = (name || '').split(' ');
  return {
    $or: [
      { firstName: { $regex: new RegExp(firstName, 'i') } },
      ...(lastName ? [{ lastName: { $regex: new RegExp(lastName, 'i') } }] : []),
    ],
  };
};

/**
 * Resolves userId from a following/follower list entry (handles both ObjectId and populated doc).
 * Single cast at return for Schema.Types.ObjectId vs mongoose.Types.ObjectId compatibility.
 */
const getUserIdFromFollowEntry = (entry: FollowingListItem): mongoose.Types.ObjectId | null => {
  const userId = entry.userId;
  if (!userId) return null;
  const id = typeof userId === 'object' && '_id' in userId ? (userId as { _id: unknown })._id : userId;
  return id != null ? toMongooseObjectId(id) : null;
};

/** Return type for follow list context (myBlockedUserIds as ObjectId[] for pipeline). */
interface FollowListContext {
  myBlockedUserIds: mongoose.Types.ObjectId[];
  myUserObjectId: mongoose.Types.ObjectId;
  startIndex: number;
  nameFilter: { $or: Array<Record<string, { $regex: RegExp }>> };
}

/**
 * Shared context for follow/follower list: blocked IDs, viewer ID, pagination skip, name filter.
 */
const getFollowListContext = async (
  myUserId: string,
  name: string,
  page: number,
  limit: number
): Promise<FollowListContext> => {
  const myProfile = await UserProfile.findOne({ [FIELD_USERS_ID]: myUserId }, { [FIELD_BLOCKED_USERS]: 1 }).lean();
  const rawBlocked = myProfile?.[FIELD_BLOCKED_USERS]?.map((b: BlockedUserEntry) => b.userId) ?? [];
  const myBlockedUserIds = rawBlocked.map((userId) => toMongooseObjectId(userId));
  const myUserObjectId = new mongoose.Types.ObjectId(myUserId);
  const startIndex = getPaginationSkip(page, limit);
  const nameFilter = buildNameFilter(name);
  return { myBlockedUserIds, myUserObjectId, startIndex, nameFilter };
};

/**
 * Returns a consistent empty paginated result for follow/follower list endpoints.
 */
const emptyPaginatedResult = (page: number): { currentPage: number; totalPages: number; users: FollowListItem[] } => ({
  currentPage: page,
  totalPages: 0,
  users: [],
});

type FollowListType = 'following' | 'followers';

/**
 * Shared implementation for getFollowing and getFollowers: context, profile fetch, ID extraction, pipeline, paginated result.
 */
const getFollowListByType = async (
  listType: FollowListType,
  name: string,
  userId: string,
  page: number,
  limit: number,
  myUserId: string
): Promise<{ currentPage: number; totalPages: number; users: FollowListItem[] }> => {
  const { myBlockedUserIds, myUserObjectId, startIndex, nameFilter } = await getFollowListContext(
    myUserId,
    name,
    page,
    limit
  );

  const selectFields = listType === 'following' ? FIELD_FOLLOWING : `${FIELD_FOLLOWING} ${FIELD_FOLLOWERS}`;
  const profile = await UserProfile.findOne({ [FIELD_USERS_ID]: userId }, selectFields);

  const list = listType === 'following' ? profile?.[FIELD_FOLLOWING] : profile?.[FIELD_FOLLOWERS];
  if (!list?.length) return emptyPaginatedResult(page);
  if (!profile) return emptyPaginatedResult(page);

  const ids = list.map((f) => getUserIdFromFollowEntry(f)).filter(isNonNullObjectId);
  if (!ids.length) return emptyPaginatedResult(page);

  const isFollowingParam: true | mongoose.Types.ObjectId[] =
    listType === 'following'
      ? true
      : profile[FIELD_FOLLOWING].map((e) => getUserIdFromFollowEntry(e)).filter(isNonNullObjectId);

  const pipeline = getFollowListPipelineStages({
    userIds: ids,
    myBlockedUserIds,
    myUserObjectId,
    nameFilter,
    isFollowing: isFollowingParam,
    skip: startIndex,
    limit,
  });
  const users = (await User.aggregate(pipeline)) as FollowListItem[];

  return { currentPage: page, totalPages: computeTotalPages(ids.length, limit), users };
};

// =============================================================================
// PROFILE CRUD (create, read, build email)
// =============================================================================

/** Internal: find one profile by user id, optionally with university populated. */
 export const findOneProfileByUserId = async (
  userId: string,
  options?: { populateUniversity?: boolean }
) => {
  const query = UserProfile.findOne({ [FIELD_USERS_ID]: userId });
  if (options?.populateUniversity) {
    return query.populate({ path: 'university_id', select: SELECT_UNIVERSITY_FIELDS });
  }
  return query;
};

/** Internal: find many profiles by user ids. */
const findProfilesByUserIds = async (userIds: (string | mongoose.Types.ObjectId)[]) => {
  return UserProfile.find({ [FIELD_USERS_ID]: { $in: userIds } });
};

export const createUserProfile = async (userId: string, body: CreateUserProfileBody) => {
  const {
    birthDate,
    country,
    city,
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

  const userProfileData = {
    [FIELD_USERS_ID]: userId,
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
  return findOneProfileByUserId(id, { populateUniversity: true });
};

export const getUserProfileVerifiedUniversityEmails = async (id: string) => {
  const userProfile = await findOneProfileByUserId(id);
  return userProfile?.email;
};

export const getUserProfileById = async (id: string) => {
  return findOneProfileByUserId(id);
};

export const getUserProfiles = async (userIds: (string | mongoose.Types.ObjectId)[]) => {
  return findProfilesByUserIds(userIds);
};

// =============================================================================
// PROFILE UPDATE & STATUS CHANGE VALIDATION
// =============================================================================

/**
 * Validates status change limit within the window and appends to statusChangeHistory if allowed.
 * Mutates profile.statusChangeHistory when there are status field changes.
 */
const validateAndApplyStatusChange = (
  profile: HydratedDocument<UserProfileDocument>,
  body: EditProfileRequest
): void => {
  const statusWindowStartDate = new Date();
  statusWindowStartDate.setDate(statusWindowStartDate.getDate() - STATUS_CHANGE_WINDOW_DAYS);

  const recentChanges = profile.statusChangeHistory.filter(
    (entry: StatusChangeHistoryEntry) => entry.updatedAt >= statusWindowStartDate
  );

  const statusFields = ['role', 'study_year', 'major', 'occupation', 'affiliation'] as const;
  const updatedFields: Array<{ field: (typeof statusFields)[number]; oldValue: unknown; newValue: unknown }> = [];

  for (const field of statusFields) {
    const newValue = body[field];
    if (newValue && profile[field] !== newValue) {
      updatedFields.push({
        field,
        oldValue: profile[field],
        newValue,
      });
    }
  }

  if (updatedFields.length === 0) return;

  if (recentChanges.length >= MAX_STATUS_CHANGES_IN_WINDOW) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR_STATUS_CHANGE_LIMIT);
  }

  profile.statusChangeHistory.push({
    updatedAt: new Date(),
    updatedFields,
  });
};

export const updateUserProfile = async (id: mongoose.Types.ObjectId, userProfileBody: EditProfileRequest) => {
  const bioLength = userProfileBody.bio?.trim().length || 0;
  const userProfileToUpdate: HydratedDocument<UserProfileDocument> | null = await UserProfile.findById(id);

  if (bioLength > BIO_MAX_LENGTH) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR_BIO_TOO_LONG);
  }

  if (!userProfileToUpdate) {
    throw new ApiError(httpStatus.NOT_FOUND, ERR_USER_PROFILE_NOT_FOUND_UPDATE);
  }

  validateAndApplyStatusChange(userProfileToUpdate, userProfileBody);

  const { firstName, lastName, ...updateData } = userProfileBody;
  Object.assign(userProfileToUpdate, updateData);

  // Update firstName and lastName in User schema if they are provided
  if (firstName || lastName) {
    const userToUpdate = await User.findById(userProfileToUpdate[FIELD_USERS_ID]);
    if (userToUpdate) {
      if (firstName) userToUpdate.firstName = firstName;
      if (lastName) userToUpdate.lastName = lastName;
      await userToUpdate.save();
    }
  }

  await userProfileToUpdate.save();

  return userProfileToUpdate;
};

// =============================================================================
// FOLLOW / UNFOLLOW
// =============================================================================

/**
 * Applies follow or unfollow: updates both profiles and queues the notification.
 */
const applyFollowState = async (
  userId: mongoose.Types.ObjectId,
  userToFollow: mongoose.Types.ObjectId,
  userToFollowProfile: HydratedDocument<UserProfileDocument> | null,
  isFollow: boolean
) => {
  const updateOp = isFollow ? { $push: { [FIELD_FOLLOWERS]: { userId } } } : { $pull: { [FIELD_FOLLOWERS]: { userId } } };
  const myUpdateOp = isFollow
    ? { $push: { [FIELD_FOLLOWING]: { userId: userToFollow } } }
    : { $pull: { [FIELD_FOLLOWING]: { userId: userToFollow } } };

  await userToFollowProfile?.updateOne(updateOp);
  const updatedUserProfile = await UserProfile.findOneAndUpdate(
    { [FIELD_USERS_ID]: userId },
    myUpdateOp,
    { new: true }
  );

  await queueFollowNotification({
    sender_id: userId,
    receiverId: userToFollow,
    type: isFollow ? NotificationIdentifier.follow_user : NotificationIdentifier.un_follow_user,
    message: isFollow ? 'Started following you' : 'Stopped following you',
  });

  return updatedUserProfile;
};

export const toggleFollow = async (userId: mongoose.Types.ObjectId, userToFollow: mongoose.Types.ObjectId) => {
  const userProfile = await UserProfile.findOne({ [FIELD_USERS_ID]: userId });
  const userToFollowProfile = await UserProfile.findOne({ [FIELD_USERS_ID]: userToFollow });

  const isAlreadyFollowing = userProfile?.[FIELD_FOLLOWING].some((x) => x.userId.toString() === userToFollow.toString());

  return applyFollowState(userId, userToFollow, userToFollowProfile, !isAlreadyFollowing);
};



export const getFollowing = async (
  name: string = '',
  userId: string,
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT,
  myUserId: string
) => getFollowListByType('following', name, userId, page, limit, myUserId);

export const getFollowers = async (
  name: string = '',
  userId: string,
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT,
  myUserId: string
) => getFollowListByType('followers', name, userId, page, limit, myUserId);

/**
 * Maps a populated profile (with users_id populated) to the follow-list item shape.
 * Returns null if users_id is not populated or missing required fields.
 */
const mapProfileToFollowListItem = (
  populated: unknown
): { _id: mongoose.Types.ObjectId; firstName: string; lastName: string; profile: Record<string, unknown> } | null => {
  if (typeof populated !== 'object' || populated === null) return null;
  const p = populated as Record<string, unknown>;
  const user = p[FIELD_USERS_ID];
  if (
    !user ||
    typeof user !== 'object' ||
    !('_id' in user) ||
    !('firstName' in user) ||
    !('lastName' in user)
  )
    return null;
  const userObj = user as { _id: unknown; firstName: string; lastName: string };
  return {
    _id: toMongooseObjectId(userObj._id),
    firstName: userObj.firstName,
    lastName: userObj.lastName,
    profile: {
      _id: toMongooseObjectId(p['_id']),
      profile_dp: p['profile_dp'],
      degree: p['degree'],
      study_year: p['study_year'],
      major: p['major'],
      university_name: p['university_name'],
      role: p['role'],
      affiliation: p['affiliation'],
      occupation: p['occupation'],
    },
  };
};

export const getFollowersAndFollowing = async (name: string = '', userId: string) => {
  const profile = await UserProfile.findOne({ [FIELD_USERS_ID]: userId });
  if (!profile) return { user: [] };

  const followersIds = profile[FIELD_FOLLOWERS]
    .map((f) => getUserIdFromFollowEntry(f)?.toString())
    .filter((id): id is string => Boolean(id));
  const followingIds = profile[FIELD_FOLLOWING]
    .map((f) => getUserIdFromFollowEntry(f)?.toString())
    .filter((id): id is string => Boolean(id));

  const uniqueIds = new Set([...followersIds, ...followingIds]);
  const ids = Array.from(uniqueIds);

  const nameFilter = buildNameFilter(name);

  const userFollows = await UserProfile.find({
    $and: [{ [FIELD_USERS_ID]: { $in: ids } }],
  })
    .populate({
      path: FIELD_USERS_ID,
      select: SELECT_USER_FIRST_LAST_NAME,
      match: nameFilter,
    })
    .select(SELECT_PROFILE_FIELDS_FOR_FOLLOW)
    .exec();

  const result = userFollows
    .map((p) => mapProfileToFollowListItem(p))
    .filter((item): item is NonNullable<typeof item> => item != null);
  return { user: result };
};

// =============================================================================
// BLOCKED USERS (read)
// =============================================================================

export const getBlockedUsers = async (userId: string) => {
  const pipeline = getBlockedUsersPipelineStages(userId);
  return await UserProfile.aggregate(pipeline);
};

export const getFollowingAndMutuals = async (
  name: string,
  userId: string,
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT
): Promise<{ currentPage: number; totalPages: number; users: FollowListItem[] }> => {
  const startIndex = getPaginationSkip(page, limit);

  // Fetch the user's following and followers list
  const loggedInUser = await UserProfile.findOne({ [FIELD_USERS_ID]: userId }).select(SELECT_FOLLOWING_FOLLOWERS).lean();

  // Extract following and follower IDs
  const followingIds = new Set(loggedInUser?.[FIELD_FOLLOWING].map((f) => f.userId.toString()) || []);
  const followerIds = new Set(loggedInUser?.[FIELD_FOLLOWERS].map((f) => f.userId.toString()) || []);

  // Find mutual followers (users present in both sets)
  const mutualIds = [...followingIds].filter((id) => followerIds.has(id)).map((id) => new mongoose.Types.ObjectId(id));

  const nameFilter = buildNameFilter(name || '');

  const pipeline = getFollowingAndMutualsPipelineStages({
    mutualIds,
    nameFilter,
    skip: startIndex,
    limit,
  });
  const users = (await User.aggregate(pipeline)) as FollowListItem[];

  return {
    currentPage: page,
    totalPages: computeTotalPages(mutualIds?.length || 0, limit),
    users,
  };
};

// =============================================================================
// UNIVERSITY EMAIL & COMMUNITIES
// =============================================================================

export const addUniversityEmail = async (
  userId: string,
  universityEmail: string,
  universityName: string,
  communityId: string,
  communityLogoUrl: string
) => {
  // First, check if the user profile exists and get current communities
  const userProfile = await UserProfile.findOne({
    [FIELD_USERS_ID]: new mongoose.Types.ObjectId(userId),
  });

  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, ERR_USER_PROFILE_NOT_FOUND);
  }

  

  // Check if the university email already exists
  const emailExists = userProfile.email.some((email) => email.UniversityEmail === universityEmail);
  if (emailExists) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR_UNIVERSITY_EMAIL_ALREADY_EXISTS);
  }

  // Check if community already exists in communities array
  const communityExists = userProfile.communities.some((community) => community.communityId.toString() === communityId);

  let updateOperation: mongoose.mongo.UpdateFilter<UserProfileDocument> = {
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
    const newCommunity: UserCommunities = {
      communityId: toMongooseObjectId(communityId) as unknown as UserCommunities['communityId'],
      isVerified: true,
      communityGroups: [],
    };
    updateOperation.$push = {
      ...updateOperation.$push,
      communities: newCommunity,
    };
  }

  const filterQuery = {
    [FIELD_USERS_ID]: new mongoose.Types.ObjectId(userId),
    ...(communityExists && {
      'communities.communityId': new mongoose.Types.ObjectId(communityId),
    }),
  } as mongoose.FilterQuery<UserProfileDocument>;

  // Prepare options for findOneAndUpdate, omitting arrayFilters if not needed
  const updateOptions: mongoose.QueryOptions = { new: true };
  if (communityExists) {
    updateOptions.arrayFilters = [{ 'elem.communityId': new mongoose.Types.ObjectId(communityId) }];
  }

  const updatedUserProfile = await UserProfile.findOneAndUpdate(filterQuery, updateOperation, updateOptions);

  if (!updatedUserProfile) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, ERR_FAILED_TO_UPDATE_USER_PROFILE);
  }

  return updatedUserProfile;
};

// =============================================================================
// BLOCK / UNBLOCK
// =============================================================================

/**
 * Groups community groups by communityId
 */
const groupByCommunityId = (
  groups: Array<{ _id: mongoose.Types.ObjectId; communityId: mongoose.Types.ObjectId }>
): Record<string, mongoose.Types.ObjectId[]> => {
  return groups.reduce((acc, group) => {
    const key = group.communityId.toString();
    (acc[key] ??= []).push(group._id);
    return acc;
  }, {} as Record<string, mongoose.Types.ObjectId[]>);
};

/**
 * Validates that blocking operation is allowed. Returns the caller's profile (throws if invalid).
 */
const validateBlockOperation = (
  userProfile: UserProfileDocument | null,
  userToBlockProfile: UserProfileDocument | null
): UserProfileDocument => {
  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, ERR_USER_NOT_FOUND);
  }

  if (userProfile.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR_ADMIN_CANNOT_BLOCK);
  }

  if (userToBlockProfile?.adminCommunityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, ERR_CANNOT_BLOCK_ADMIN);
  }

  return userProfile;
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
      { [FIELD_USERS_ID]: userId },
      { $pull: { [FIELD_FOLLOWING]: { userId: userToBlock }, [FIELD_FOLLOWERS]: { userId: userToBlock } } }
    ),
    UserProfile.updateOne(
      { [FIELD_USERS_ID]: userToBlock },
      { $pull: { [FIELD_FOLLOWING]: { userId: userId }, [FIELD_FOLLOWERS]: { userId: userId } } }
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
          [FIELD_USERS_ID]: userId,
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
          [FIELD_USERS_ID]: userToBlock,
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
): Promise<{ status: BlockStatus; userId: mongoose.Types.ObjectId }> => {
  // Add user to blocked list
  await UserProfile.findOneAndUpdate(
    { [FIELD_USERS_ID]: userId },
    { $addToSet: { [FIELD_BLOCKED_USERS]: { userId: userToBlock } } },
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

  return { status: BLOCK_STATUS_BLOCKED, userId: userToBlock };
};

/**
 * Handles the unblocking logic when unblocking a user
 */
const handleUnblockUser = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<{ status: BlockStatus; userId: mongoose.Types.ObjectId }> => {
  await UserProfile.findOneAndUpdate(
    { [FIELD_USERS_ID]: userId },
    { $pull: { [FIELD_BLOCKED_USERS]: { userId: userToBlock } } },
    { new: true }
  );

  return { status: BLOCK_STATUS_UNBLOCKED, userId: userToBlock };
};

export const toggleBlock = async (
  userId: mongoose.Types.ObjectId,
  userToBlock: mongoose.Types.ObjectId
): Promise<{ status: BlockStatus; userId: mongoose.Types.ObjectId }> => {
  // Fetch all required data in parallel
  const [userProfile, userToBlockProfile, adminGroups, myAdminGroups] = await Promise.all([
    UserProfile.findOne({ [FIELD_USERS_ID]: userId }),
    UserProfile.findOne({ [FIELD_USERS_ID]: userToBlock }),
    communityGroupModel.find({ adminUserId: userToBlock }, { _id: 1, communityId: 1 }).lean(),
    communityGroupModel.find({ adminUserId: userId }, { _id: 1, communityId: 1 }).lean(),
  ]);

  // Validate the operation (returns validated profile or throws)
  const profile = validateBlockOperation(userProfile, userToBlockProfile);

  // Group admin groups by community ID
  const groupsByCommunity = groupByCommunityId(adminGroups);
  const myGroupsByCommunity = groupByCommunityId(myAdminGroups);

  // Check if user is already blocked
  const isBlocked = profile[FIELD_BLOCKED_USERS].some(
    (blockedUser) => blockedUser.userId.toString() === userToBlock.toString()
  );

  if (isBlocked) {
    return await handleUnblockUser(userId, userToBlock);
  } else {
    return await handleBlockUser(userId, userToBlock, groupsByCommunity, myGroupsByCommunity);
  }
};
