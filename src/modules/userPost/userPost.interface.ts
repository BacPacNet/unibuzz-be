import { Schema } from 'mongoose';

interface Like {
  userId: string;
}

interface userPostInterface {
  user_id: Schema.Types.ObjectId;
  content: string;
  imageUrl?: { imageUrl: String; publicId: String }[];
  likeCount: Like[];
}

export { userPostInterface };
