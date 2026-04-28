import mongoose, { Document } from 'mongoose';
import { CommunityGroupAccess, CommunityGroupLabel, CommunityGroupType } from '../../config/community.type';

export const allowedCategories = new Set([
  'Academic',
  'Educational',
  'Interest',
  'Events & Activities',
  'Personal Growth',
  'Advocacy and Awareness',
  'Professional Development',
  'Utility & Campus Life',
]);

export const allowedSubcategories: Record<string, string[]> = {
  Academic: [
    'Science',
    'Technology',
    'Arts and Humanities',
    'Social Sciences',
    'Education',
    'Business and Economics',
    'Health & Medicine',
    'Environmental Studies',
    'Laws & Policy',
    'Mathematics & Statistics',
    'Engineering',
    'Coding',
    'Robotics',
    'Philosophy & Religion',
    'Literature & Language',
    'Agriculture',
    'Architecture & Design',
    'Media & Communication',
    'Hospitality & Tourism',
    'Other',
  ],
  Educational: ['Course Discussion', 'Exam Prep', 'Study Materials', 'Research', 'Study Group', 'Peer Tutoring', 'Other'],
  Interest: [
    'Sports & Fitness',
    'Music & Performing Arts',
    'Gaming & Esports',
    'Outdoor Activities',
    'Crafting & DIY',
    'Culinary Arts',
    'Media',
    'Dance',
    'Travel & Exploration',
    'Literature',
    'Culture',
    'Finance & Advice',
    'Language Learning',
    'Memes & Fun',
    'Other',
  ],
  'Events & Activities': [
    'Fest',
    'Competition',
    'Talks & Webinar',
    'Workshop',
    'Social Meetup',
    'Event Organizing',
    'Volunteering',
    'Other',
  ],
  'Personal Growth': [
    'Mindfulness & Meditation',
    'Physical Health',
    'Leadership Development',
    'Stress Management',
    'Public Speaking',
    'Confidence Building',
    'Sex Education',
    'Other',
  ],
  'Advocacy and Awareness': [
    'Environmental Conservation',
    'Human Rights',
    'Gender Equality',
    'LGBTQ+',
    'Mental Health',
    'Animal Welfare',
    'Political Activism',
    'Other',
  ],
  'Professional Development': [
    'Entrepreneurship & Startups',
    'Career Mentorship',
    'Professional Workshops',
    'Internships',
    'Networking & Mixers',
    'Job Hunting',
    'Certificates & Licenses',
    'Other',
  ],
  'Utility & Campus Life': [
    'Cab Sharing',
    'Housing & Roommates',
    'Buy/Sell/Exchange',
    'Lost & Found',
    'Local Services',
    'Student Hacks',
    'Study Exchange',
    'Study Abroad',
    'Alumni Connections',
    'Other',
  ],
};

export enum status {
  pending = 'pending',
  rejected = 'rejected',
  accepted = 'accepted',
  default = 'default',
}

export interface users {
  _id: mongoose.Types.ObjectId;
  isRequestAccepted: boolean;
  firstName: String;
  lastName: String;
  year: String;
  degree: String;
  major: String;
  profileImageUrl: String | null;
  universityName: String;
  status: status;
  occupation: string;
  affiliation: string;
  role: 'student' | 'faculty' | 'applicant';
}

interface communityGroupInterface {
  _id: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  communityGroupLogoUrl: { imageUrl: String; publicId: String };
  communityGroupLogoCoverUrl: { imageUrl: String; publicId: String };
  title: string;
  description: string;
  memberCount: number;
  communityGroupType: CommunityGroupType;
  communityGroupAccess: CommunityGroupAccess;
  communityGroupLabel: CommunityGroupLabel;
  communityGroupCategory: Map<string, string[]>;
  users: users[];
  status: status;
  isCommunityGroupLive: boolean;
  inviteUsers: {
    userId: mongoose.Types.ObjectId;
  }[];
}


interface UpdateJoinRequestBody {
  notificationId: string;
  status: string;
  userId: string;
  adminId: string;
  communityGroupId: string;
}

interface ChangeStatusBody {
  communityGroupId: string;
  adminId: string;
  userId: string;
  text: string;
  status?: string;
  notificationId?: string;
}

interface CommunityGroupWithNotification extends Omit<communityGroupInterface, 'adminUserId'> {
  adminUserId: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId } | string;
  notificationId?: mongoose.Types.ObjectId | undefined;
  notificationTypes?: string | undefined;
  notificationStatus?: string | undefined;
}

interface CommunityGroupNotificationPayload {
  sender_id: mongoose.Types.ObjectId | string;
  receiverId: mongoose.Types.ObjectId | string;
  communityGroupId?: mongoose.Types.ObjectId | string;
  type: string;
  message: string;
}

/** Full user shape that can be sent in selectedUsers (create/update group) */
export interface SelectedUserItem {
  users_id: mongoose.Types.ObjectId | string;
  _id?: mongoose.Types.ObjectId | string;
  displayEmail?: string;
  adminCommunityId?: string | null;
  affiliation?: string;
  bio?: string;
  blockedUsers?: unknown[];
  city?: string;
  country?: string;
  createdAt?: string;
  degree?: string;
  dob?: string;
  firstName?: string;
  isVerified?: boolean;
  lastName?: string;
  major?: string;
  occupation?: string;
  phone_number?: string;
  profile_dp?: { imageUrl?: string; publicId?: string } | null;
  role?: string;
  study_year?: string;
  universityLogo?: string;
  university_id?: string;
  university_name?: string;
  __v?: number;
}

/** Body shape for updating a community group (e.g. from PATCH/PUT) */
export interface UpdateCommunityGroupBody {
  selectedUsers?: SelectedUserItem[];
  communityGroupCategory?: Record<string, string[]>;
  communityGroupAccess?: CommunityGroupAccess;
  title?: string;
  description?: string;
  communityGroupLogoUrl?: { imageUrl: string; publicId: string };
  communityGroupLogoCoverUrl?: { imageUrl: string; publicId: string };
  [key: string]: unknown;
}

/** Body shape for creating a community group (e.g. from POST) */
export interface CreateCommunityGroupBody {
  communityGroupCategory?: Record<string, string[]>;
  selectedUsers?: SelectedUserItem[];
  adminId?: string;
  memberList?: string[];
  communityGroupType?: string;
  communityGroupLabel?: CommunityGroupLabel;
  title?: string;
  description?: string;
  communityGroupLogoUrl?: { imageUrl: string; publicId: string };
  communityGroupLogoCoverUrl?: { imageUrl: string; publicId: string };
  [key: string]: unknown;
}

/** Minimal user shape needed to build a group member entry */
export type UserLike = { _id?: mongoose.Types.ObjectId; firstName?: string; lastName?: string };

/** Minimal profile shape needed to build a group member entry */
export type ProfileLike = {
  profile_dp?: { imageUrl?: string } | null;
  university_name?: string;
  study_year?: string;
  degree?: string;
  major?: string;
  occupation?: string;
  affiliation?: string;
  role?: string;
};

/** Minimal user doc shape for mapping to IDs (e.g. from lean query) */
export type UserIdLike = { _id: mongoose.Types.ObjectId };

/** Populated admin user shape (isDeleted, blockedUsers) */
export type PopulatedAdminLike = {
  _id: mongoose.Types.ObjectId;
  isDeleted?: boolean;
  blockedUsers?: { userId: mongoose.Types.ObjectId }[];
};

/** Blocked user reference in profile (userId may be ObjectId or lean representation) */
export type BlockedUserRef = { userId: mongoose.Types.ObjectId | { toString(): string } };

/** Lean member profile with users_id and blockedUsers */
export type MemberProfileLean = {
  users_id: mongoose.Types.ObjectId;
  blockedUsers?: BlockedUserRef[];
};

/** Pipeline output user shape for getCommunityGroupMembers */
export interface MemberWithVerified {
  isVerified?: boolean;
  [key: string]: unknown;
}

/** Community group document (model document + interface) */
export type CommunityGroupDocument = Document & communityGroupInterface;

export { communityGroupInterface, UpdateJoinRequestBody, ChangeStatusBody, CommunityGroupWithNotification, CommunityGroupNotificationPayload };
