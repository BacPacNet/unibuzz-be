import { Schema, model } from 'mongoose';
import { userPostInterface } from './userPost.interface';
import { userPostType } from '../../config/community.type';

const userPostSchema = new Schema<userPostInterface>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String },
    imageUrl: [{ imageUrl: String, publicId: String }],
    likeCount: [{ userId: String }],
    PostType: { type: String, enum: ['Private', 'Public'], default: userPostType.Public },
  },
  { timestamps: true }
);

const UserPostModel = model<userPostInterface>('UserPost', userPostSchema);

export default UserPostModel;
