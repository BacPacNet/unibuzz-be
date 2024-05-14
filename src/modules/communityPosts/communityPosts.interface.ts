import { Schema } from 'mongoose';
import { CommunityType } from 'src/config/community.type';

interface Like {
  userId: string;
}

interface communityPostsInterface {
  communityId: Schema.Types.ObjectId;
  content: string;
  imageUrl?: string;
  likeCount: Like[];
  communityPostsType: CommunityType;
}

export { communityPostsInterface };
