import { Request } from 'express';

export interface UserCommunityInfo {
  communityId: string;
  isVerified: boolean;
  communityGroups: Array<{
    id: string;
    status: string;
  }>;
}

export interface userIdExtend extends Request {
  userId?: string;
  userCommunity?: UserCommunityInfo;
}
