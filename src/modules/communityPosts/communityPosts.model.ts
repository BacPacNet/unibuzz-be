import { Schema, model } from 'mongoose';
import { communityPostsInterface } from './communityPosts.interface';
import { CommunityType } from '../../config/community.type';

// communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },

const communityPostSchema = new Schema<communityPostsInterface>(
  {
    communityId: { type: String, required: true },
    content: { type: String },
    imageUrl: [{ imageUrl: String, publicId: String }],
    likeCount: [{ userId: String }],
    communityPostsType: { type: String, enum: ['Private', 'Public'], default: CommunityType.Public },
  },
  { timestamps: true }
);

const CommunityPostModel = model<communityPostsInterface>('CommunityPost', communityPostSchema);

export default CommunityPostModel;
