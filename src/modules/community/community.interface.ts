import mongoose from 'mongoose';
import { CommunityGroupAccess, CommunityGroupJoinActionKey } from '../../config/community.type';

interface User {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  universityName: string;
  year: string;
  degree: string;
  major: string;
  occupation: string;
  affiliation: string;
  role: string;
  isVerified?: boolean;
}

interface communityInterface {
  _id: mongoose.Types.ObjectId;
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: mongoose.Types.ObjectId[];
  university_id: mongoose.Types.ObjectId;
  numberOfStudent: number;
  numberOfFaculty: number;
  about: string;
  users: User[];
  assistantId: string;
  communityGroups: mongoose.Types.ObjectId[];
}

interface GetCommunityUsersOptions {
  isVerified: boolean;
  searchQuery?: string | undefined;
  communityGroupId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  userId: string;
}

/** Community group item returned from filtered community aggregates. */
export interface FilteredCommunityGroup {
  adminUserId: mongoose.Types.ObjectId | string;
  communityGroupAccess?: CommunityGroupAccess | string;
  isRequestRequiredToJoinGroup?: boolean;
  users?: Array<{
    _id?: mongoose.Types.ObjectId | { toString?: () => string };
    isRequestAccepted?: boolean;
  }>;
  joinGroupActionKey?: CommunityGroupJoinActionKey | null;
  isOfficialTypeDisabled?: boolean;
  [key: string]: unknown;
}

/** Result shape of getUserFilteredCommunities (aggregate or empty fallback). */
export interface GetUserFilteredCommunitiesResult {
  _id: mongoose.Types.ObjectId | string;
  communityGroups: FilteredCommunityGroup[];
}

/** Request body for CreateCommunity */
interface CreateCommunityBody {
  university_id: string;
}

/** Query params for exportFilteredSuperAdminCommunity (same filters as list, no pagination) */
export interface ExportFilteredSuperAdminCommunityQuery {
  sort?: string;
  searchTerm?: string;
  selectedType?: string;
  selectedLabel?: string;
  selectedFilters?: string;
}

export { communityInterface, GetCommunityUsersOptions, CreateCommunityBody };
