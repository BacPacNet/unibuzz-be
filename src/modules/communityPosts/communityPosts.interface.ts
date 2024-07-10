import { Schema } from 'mongoose';
import { CommunityType } from 'src/config/community.type';

interface Like {
  userId: string;
}
interface image {
  imageUrl: String;
  publicId: String;
}

interface communityPostsInterface {
  communityId: Schema.Types.ObjectId;
  content: string;
  imageUrl?: image[];
  likeCount: Like[];
  communityPostsType: CommunityType;
}

export { communityPostsInterface };
