import { Schema } from 'mongoose';
import { communityPostStatus, CommunityType } from '../../config/community.type';

interface Like {
  userId: string;
}
interface image {
  imageUrl: String;
  publicId: String;
}

interface communityPostsInterface {
  communityId: Schema.Types.ObjectId;
  communityGroupId: Schema.Types.ObjectId;
  content: string;
  user_id: Schema.Types.ObjectId;
  imageUrl?: image[];
  likeCount: Like[];
  communityPostsType: CommunityType;
  isPostVerified: boolean;
  communityName: string;
  communityGroupName: string;
  isPostLive: boolean;
  postStatus: communityPostStatus;
}

export { communityPostsInterface };
