import { Schema } from 'mongoose';

interface Like {
  userId: string;
}
interface communityPostCommentsInterface {
  postId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  commenterProfileId: Schema.Types.ObjectId;
  content: string;
  likeCount: Like[];
  imageUrl?: { imageUrl: String; publicId: String };
  replies: [Schema.Types.ObjectId];
  level: number;
  isCommentVerified: boolean
}

export { communityPostCommentsInterface };
