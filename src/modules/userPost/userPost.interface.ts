import { Schema } from 'mongoose';
import { userPostType } from '../../config/community.type';

interface Like {
  userId: string;
}

interface userPostInterface {
  user_id: Schema.Types.ObjectId;
  content: string;
  imageUrl?: { imageUrl: String; publicId: String }[];
  likeCount: Like[];
  PostType: userPostType;
}

export { userPostInterface };
