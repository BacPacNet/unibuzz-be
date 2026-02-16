import { Schema } from 'mongoose';
import { status } from '../communityGroup/communityGroup.interface';
import { PaginationQuery } from '../../utils/common';
import { communityInterface } from '../community';

export enum UserRole {
  STUDENT = 'student',
  FACULTY = 'faculty',
  APPLICANT = 'applicant',
}

interface userProfileEmail {
  UniversityName: string;
  UniversityEmail: string;
  communityId: string;
  logo: string;
}

export interface FollowingEntry {
  userId: Schema.Types.ObjectId;
  isBlock?: boolean;
}

/** Following/follower item when userId is populated (e.g. in aggregates) */
export interface FollowingEntryPopulated {
  userId: { _id: Schema.Types.ObjectId };
  isBlock?: boolean;
}

/** Following/follower list item (userId may be ObjectId or populated with _id) */
export type FollowingListItem = FollowingEntry | FollowingEntryPopulated;

/** Shape of a user in the follow/follower list response (from User.aggregate pipeline) */
export interface FollowListItem {
  _id: Schema.Types.ObjectId;
  firstName: string;
  lastName: string;
  profile: {
    _id: Schema.Types.ObjectId;
    profile_dp?: { imageUrl: string; publicId: string };
    degree?: string;
    study_year?: string;
    major?: string;
    university_name?: string;
    role?: string;
    affiliation?: string;
    occupation?: string;
  };
  isFollowing: boolean;
}

export interface BlockedUserEntry {
  userId: Schema.Types.ObjectId;
  blockedAt?: Date;
}

export interface StatusChangeHistoryUpdatedField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface StatusChangeHistoryEntry {
  updatedAt: Date;
  updatedFields: StatusChangeHistoryUpdatedField[];
}

export interface CreateUserProfileBody {
  birthDate?: string;
  country?: string;
  city?: string;
  universityName?: string;
  year?: string;
  degree?: string;
  major?: string;
  occupation?: string;
  department?: string;
  universityId?: string | null;
  userType?: string;
  universityLogo?: string;
}

export interface UserCommunityGroup {
  id: string;
  status: status;
}

export interface UserCommunities {
  communityId: Schema.Types.ObjectId | string;
  isVerified: boolean;
  communityGroups: UserCommunityGroup[];
}

interface UserProfileDocument {
  users_id: Schema.Types.ObjectId;
  email: userProfileEmail[];
  displayEmail: string;
  communities: UserCommunities[];
  profile_dp?: { imageUrl: string; publicId: string };
  cover_dp?: { imageUrl: string; publicId: string };
  bio?: string;
  phone_number?: string;
  dob?: string;
  country?: string;
  city?: string;
  university_name?: string;
  universityLogo: string;
  university_id: Schema.Types.ObjectId;
  study_year?: string;
  degree?: string;
  major?: string;
  role: UserRole;
  affiliation?: string;
  occupation?: string;
  following: FollowingEntry[];
  followers: FollowingEntry[];
  isCommunityAdmin?: boolean;
  adminCommunityId?: Schema.Types.ObjectId | null;
  statusChangeHistory: StatusChangeHistoryEntry[];
  blockedUsers: BlockedUserEntry[];
}

interface EditProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  displayEmail?: string;
  gender?: string;
  affiliation?: string;
  bio?: string;
  city?: string;
  country?: string;
  degree?: string;
  dob?: string;
  major?: string;
  occupation?: string;
  phone_number?: string;
  study_year?: string;
  profilePicture?: any;
  profile_dp?: ProfileDp;
  role?: string;
  university_name?: string;
  university_id?: string;
  universityId?: string;
  universityLogo?: string;
}

interface ProfileDp {
  imageUrl: string;
  publicId: string;
}

/** UserProfile document with users_id populated (e.g. for getFollowersAndFollowing) */
export interface UserProfileWithPopulatedUser extends Omit<UserProfileDocument, 'users_id'> {
  _id: Schema.Types.ObjectId;
  users_id: { _id: Schema.Types.ObjectId; firstName: string; lastName: string } | null;
}

export interface AddUniversityEmailBody {
  universityName: string;
  universityEmail: string;
  UniversityOtp: string;
}

interface PaginationQueryWithUserId extends PaginationQuery {
  name?: string;
  userId?: string;
}

type CommunityUser = communityInterface['users'][number];


export { UserProfileDocument, EditProfileRequest,  PaginationQueryWithUserId, CommunityUser };
