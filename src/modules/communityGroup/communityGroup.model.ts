import { Schema, model } from 'mongoose';
import { communityGroupInterface } from './communityGroup.interface';
import { communityGroupType } from '../../config/community.type';

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
  communityGroupLogoUrl: { imageUrl: String, publicId: String },
  communityGroupLogoCoverUrl: { imageUrl: String, publicId: String },
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
    enum: ['Private', 'Public'],
    default: communityGroupType.Public,
  },
});

const communityGroupModel = model<communityGroupInterface>('communityGroup', communityGroupSchema);

export default communityGroupModel;
