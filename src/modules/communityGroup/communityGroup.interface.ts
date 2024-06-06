import mongoose from 'mongoose';
import { CommunityType } from '../../config/community.type';

interface communityGroupInterface {
  adminUserId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  communityGroupLogoUrl: string;
  communityGroupLogoCoverUrl: string;
  title: string;
  description: string;
  memberCount: number;
  communityGroupType: CommunityType;
}

export { communityGroupInterface };
