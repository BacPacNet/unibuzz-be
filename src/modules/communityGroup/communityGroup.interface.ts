import mongoose from 'mongoose';
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
  ],
  Educational: ['Course Discussion', 'Exam Prep', 'Study Materials', 'Research', 'Study Group', 'Peer Tutoring'],
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
  ],
  'Events & Activities': [
    'Fest',
    'Competition',
    'Talks & Webinar',
    'Workshop',
    'Social Meetup',
    'Event Organizing',
    'Volunteering',
  ],
  'Personal Growth': [
    'Mindfulness & Meditation',
    'Physical Health',
    'Leadership Development',
    'Stress Management',
    'Public Speaking',
    'Confidence Building',
    'Sex Education',
  ],
  'Advocacy and Awareness': [
    'Environmental Conservation',
    'Human Rights',
    'Gender Equality',
    'LGBTQ+',
    'Mental Health',
    'Animal Welfare',
    'Political Activism',
  ],
  'Professional Development': [
    'Entrepreneurship & Startups',
    'Career Mentorship',
    'Professional Workshops',
    'Internships',
    'Networking & Mixers',
    'Job Hunting',
    'Certificates & Licenses',
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
  ],
};

export enum status {
  pending = 'pending',
  rejected = 'rejected',
  accepted = 'accepted',
  default = 'default',
}

interface users {
  _id: mongoose.Types.ObjectId;
  //  userId: mongoose.Types.ObjectId;
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

export { communityGroupInterface };
