import mongoose, { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';
import { AccessAndRefreshTokens } from '../token/token.interfaces';

export const communityGroupRoleAccess = {
  Admin: 'Admin',
  Member: 'Member',
  Moderator: 'Moderator',
};

export const communityGroupRole = Object.keys(communityGroupRoleAccess);

interface communityGroupsInterface {
  communityGroupName: String;
  communityGroupId: String;
  role: string;
}

interface verifiedInterface {
  communityId: string;
  communityName: string;
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
}

export interface IUserDoc extends IUser, Document {
  isPasswordMatch(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken(email: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateUserBody = Partial<IUser>;

export type NewRegisteredUser = Omit<IUser, 'role' | 'isEmailVerified'>;

export type NewCreatedUser = Omit<IUser, 'isEmailVerified'>;

export interface IUserWithTokens {
  user: IUserDoc;
  tokens: AccessAndRefreshTokens;
}
