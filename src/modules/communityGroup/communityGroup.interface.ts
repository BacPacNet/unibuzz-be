import mongoose from 'mongoose';
import { CommunityType } from '../../config/community.type';

interface communityGroupInterface {
  adminUserId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  communityGroupLogoUrl: { imageUrl: String; publicId: String };
  communityGroupLogoCoverUrl: { imageUrl: String; publicId: String };
  title: string;
  description: string;
  memberCount: number;
  communityGroupType: CommunityType;
}

export { communityGroupInterface };
