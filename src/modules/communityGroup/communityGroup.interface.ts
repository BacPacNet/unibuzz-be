import mongoose from 'mongoose';
import { communityGroupType } from '../../config/community.type';

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
  communityGroupType: communityGroupType;
  users: users[];
}

export { communityGroupInterface };
