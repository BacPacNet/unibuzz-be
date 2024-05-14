import { Schema, model } from 'mongoose';
import { communityPostsInterface } from './communityPosts.interface';
import { CommunityType } from '../../config/community.type';

const communityPostSchema = new Schema<communityPostsInterface>({
  communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
  content: { type: String },
  imageUrl: { type: String },
  likeCount: [{ userId: String }],
  communityPostsType: { type: String, enum: ['private', 'public'], default: CommunityType.Public },
});

const CommunityPostModel = model<communityPostsInterface>('CommunityPost', communityPostSchema);

export default CommunityPostModel;
