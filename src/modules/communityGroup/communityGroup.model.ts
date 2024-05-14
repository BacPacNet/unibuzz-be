import { Schema, model } from 'mongoose';
import { communityGroupInterface } from './communityGroup.interface';
import { CommunityType } from '../../config/community.type';

const communityGroupSchema = new Schema<communityGroupInterface>({
  adminUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'community',
    required: true,
  },
  communityGroupLogoUrl: {
    type: String,
  },
  communityGroupLogoCoverUrl: {
    type: String,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  memberCount: {
    type: Number,
    default: 0,
  },
  communityGroupType: {
    type: String,
    enum: ['private', 'public'],
    default: CommunityType.Public,
  },
});

const communityGroupModel = model<communityGroupInterface>('communityGroup', communityGroupSchema);

export default communityGroupModel;
