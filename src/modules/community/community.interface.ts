import mongoose from 'mongoose';

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
  isVerified?: boolean
}

interface communityInterface {
  _id: mongoose.Types.ObjectId;
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: mongoose.Types.ObjectId;
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
  page?: number | undefined;
  limit?: number | undefined;
}

export { communityInterface,GetCommunityUsersOptions };
