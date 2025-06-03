import { Schema } from 'mongoose';
import { status } from '../communityGroup/communityGroup.interface';

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

interface following {
  userId: Schema.Types.ObjectId;
  isBlock: boolean;
}

export interface UserCommunityGroup {
  id: string;
  status: status;
}

export interface UserCommunities {
  communityId: string;
  isVerified: boolean;
  communityGroups: UserCommunityGroup[];
}

interface UserProfileDocument {
  users_id: Schema.Types.ObjectId;
  email: userProfileEmail[];
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
  following: following[];
  followers: following[];
  isCommunityAdmin?: boolean;
  adminCommunityId?: string;
}

export { UserProfileDocument };
