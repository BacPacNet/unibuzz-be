import { Schema } from 'mongoose';

interface communityPostCommentsInterface {
  communityId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  content: string;
  imageUrl?: { imageUrl: String; publicId: String };
}

export { communityPostCommentsInterface };
