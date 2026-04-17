import mongoose, { Model, Document, Types } from 'mongoose';
import { QueryResult } from '../paginate/paginate';
import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { UserProfileDocument } from '../userProfile/userProfile.interface';

export const communityGroupRoleAccess = {
  Admin: 'Admin',
  Member: 'Member',
  Moderator: 'Moderator',
};

export const communityGroupRole = Object.keys(communityGroupRoleAccess);

export interface communityGroupsInterface {
  communityGroupName: String;
  communityGroupId: String;
  role: string;
}

export interface verifiedInterface {
  communityId: string;
  communityName: string;
  role: string;
  communityGroups: communityGroupsInterface[];
}
interface unverifiedInterface {
  communityId: string;
  communityName: string;
  communityGroups: communityGroupsInterface[];
}

export interface IUser {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  gender: string;
  role: string;
  isEmailVerified: boolean;
  createdAt: Date | string;
  userVerifiedCommunities: verifiedInterface[];
  userUnVerifiedCommunities: unverifiedInterface[];
  profile: UserProfileDocument;
  isUserDeactive: boolean;
  isNewUser: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  referCode?: string;
  referredBy?: mongoose.Types.ObjectId | null;
}

export interface IUserDoc extends IUser, Document {
  isPasswordMatch(password: string): Promise<boolean>;
  isNewPasswordDifferent(newPassword: string): Promise<void>;
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken(email: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateUserBody = Partial<IUser>;

export type NewRegisteredUser = Omit<
  IUser,
  'role' | 'isEmailVerified' | 'profile' | 'isUserDeactive' | 'referCode' | 'referredBy'
> & {
  referralCode?: string;
};

export type NewCreatedUser = Omit<IUser, 'isEmailVerified' | 'profile' | 'isUserDeactive'>;

export interface IUserWithTokens {
  user: IUserDoc;
  tokens: AccessAndRefreshTokens;
}

/** Match stage used in getAllUser aggregation ($match stage) */
export interface GetAllUserMatchStage {
  _id: {
    $ne: mongoose.Types.ObjectId;
    $nin?: mongoose.Types.ObjectId[];
  };
  isDeleted: { $ne: true };
  'profile.blockedUsers': {
    $not: {
      $elemMatch: {
        userId: mongoose.Types.ObjectId;
      };
    };
  };
  firstName?: { $regex: RegExp };
  lastName?: { $regex: RegExp };
  'profile.university_name'?: { $regex: RegExp };
  $or?: GetAllUserOrCondition[];
}

/** Or-condition items used in getAllUser match stage */
export type GetAllUserOrCondition =
  | { $and: Array<Record<string, { $in: string[] }>> }
  | {
      'profile.study_year'?: { $in: string[] };
      'profile.major'?: { $in: string[] };
      'profile.occupation'?: { $in: string[] };
      'profile.affiliation'?: { $in: string[] };
      'profile.role'?: { $in: string[] };
    };

/** Query params for getAllUser (list users with filters) */
export interface GetAllUserQuery {
  page?: string;
  limit?: string;
  name?: string;
  universityName?: string;
  studyYear?: string;
  major?: string;
  occupation?: string;
  affiliation?: string;
  chatId?: string;
  role?: string;
}

/** Filter for user list/query (queryUsers / paginate) */
export interface IUserQueryFilter {
  name?: string;
  role?: string;
}

/** Query filter used in getUsersWithProfile (User.find) */
export interface GetUsersWithProfileQuery {
  $and: Array<
    | { _id: { $ne: string } }
    | { _id: { $nin: (Types.ObjectId | undefined)[] } }
    | { $or: [{ firstName: RegExp }, { lastName: RegExp }] }
  >;
  $or?: [{ firstName: RegExp }, { lastName: RegExp }];
}
