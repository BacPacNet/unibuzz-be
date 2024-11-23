import mongoose from 'mongoose';
import { communityGroupType } from '../../config/community.type';

interface communityGroupInterface {
  adminUserId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  communityGroupLogoUrl: { imageUrl: String; publicId: String };
  communityGroupLogoCoverUrl: { imageUrl: String; publicId: String };
  title: string;
  description: string;
  memberCount: number;
  communityGroupType: communityGroupType;
}

export { communityGroupInterface };
