import { Schema } from 'mongoose';
import { CommunityType } from 'src/config/community.type';

interface Like {
  userId: string;
}

interface communityPostsInterface {
  communityId: Schema.Types.ObjectId;
  content: string;
  user_id: Schema.Types.ObjectId;
  imageUrl?: { imageUrl: String; publicId: String };
  likeCount: Like[];
  communityPostsType: CommunityType;
}

export { communityPostsInterface };
