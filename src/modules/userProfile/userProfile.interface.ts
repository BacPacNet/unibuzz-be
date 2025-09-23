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
  following: following[];
  followers: following[];
  isCommunityAdmin?: boolean;
  adminCommunityId?: string;
  statusChangeHistory: {
    updatedAt: Date;
    updatedFields: {
      field: string;
      oldValue: any;
      statusChangeHistory: any;
    };
  }[];
  blockedUsers: {
    userId: Schema.Types.ObjectId;
    blockedAt: Date;
  }[];
}

interface EditProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  affiliation: string;
  bio: string;
  city: string;
  country: string;
  degree: string;
  dob: string;
  major: string;
  occupation: string;
  phone_number: string;
  study_year: string;
  profilePicture: any;
  profile_dp: ProfileDp;
  role: string;
  university_name?: string;
  university_id?: string;
  universityLogo?: string;
}

interface ProfileDp {
  imageUrl: string;
  publicId: string;
}

export { UserProfileDocument, EditProfileRequest };
