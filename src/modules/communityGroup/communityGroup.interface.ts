import mongoose from 'mongoose';
import { communityGroupAccess, CommunityGroupType } from '../../config/community.type';

export const allowedCategories = new Set([
  'Academic Focus',
  'Recreation and Hobbies',
  'Advocacy and Awareness',
  'Personal Growth',
  'Professional Development',
  'Others',
]);

export const allowedSubcategories: Record<string, string[]> = {
  'Academic Focus': [
    'Science & Technology',
    'Arts & Humanities',
    'Social Sciences',
    'Education',
    'Business & Economics',
    'Health & Medicine',
    'Environmental Studies',
    'Law & Policy',
    'Mathematics & Statistics',
    'Engineering',
  ],
  'Recreation and Hobbies': [
    'Sports & Fitness',
    'Music & Performing Arts',
    'Gaming & Esports',
    'Outdoor Activities',
    'Crafting & DIY',
    'Culinary Arts',
    'Media Arts',
    'Dance',
    'Travel & Exploration',
    'Literature & Writing',
    'Others',
  ],
  'Advocacy and Awareness': [
    'Environmental Conservation',
    'Human Rights',
    'Gender Equality',
    'LGBTQ+ Advocacy',
    'Mental Health',
    'Disability Rights',
    'Animal Welfare',
    'Political Activism',
    'Scientific Education',
    'Others',
  ],
  'Personal Growth': [
    'Mindfulness & Meditation',
    'Physical Health',
    'Leadership Development',
    'Finance Advice',
    'Stress Management',
    'Public Speaking',
    'Confidence Building',
    'Sex Education',
    'Language Learning',
    'Others',
  ],
  'Professional Development': [
    'Entrepreneurship & Startups',
    'Career Mentorship',
    'Professional Workshops',
    'Internships',
    'Networking & Mixers',
    'Alumni Connections',
    'Job Hunting',
    'Certificates',
    'Business Communication',
    'Others',
  ],
  Others: [],
};

export enum status {
  pending = 'pending',
  rejected = 'rejected',
  accepted = 'accepted',
  default = 'default',
}

interface users {
  userId: mongoose.Types.ObjectId;
  isRequestAccepted: boolean;
  firstName: String;
  lastName: String;
  year: String;
  degree: String;
  major: String;
  profileImageUrl: String | null;
  universityName: String;
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
  communityGroupAccess: communityGroupAccess;
  communityGroupCategory: Map<string, string[]>;
  users: users[];
  status: status;
}

export { communityGroupInterface };
