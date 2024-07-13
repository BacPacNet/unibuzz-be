import { Schema } from 'mongoose';

interface Like {
  userId: string;
}
interface communityPostCommentsInterface {
  communityId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  content: string;
  likeCount: Like[];
  imageUrl?: { imageUrl: String; publicId: String };
}

export { communityPostCommentsInterface };
