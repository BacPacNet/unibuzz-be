import { Schema } from 'mongoose';

export enum Sortby {
  ASC = 'asc',
  DESC = 'desc',
}

interface Like {
  userId: string;
}
interface userPostCommentsInterface {
  userPostId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  commenterProfileId: Schema.Types.ObjectId;
  content: string;
  likeCount: Like[];
  imageUrl?: { imageUrl: String; publicId: String };
  replies: [Schema.Types.ObjectId];
  level: number;
}

export { userPostCommentsInterface };
