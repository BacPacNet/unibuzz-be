import { Schema } from 'mongoose';

interface communityPostCommentsInterface {
  communityId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  content: string;
  imageUrl?: string;
}

export { communityPostCommentsInterface };
