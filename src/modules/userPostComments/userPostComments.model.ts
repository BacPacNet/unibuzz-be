import { Schema, model } from 'mongoose';
import { userPostCommentsInterface } from './userPostComments.interface';

const userPostCommentsSchema = new Schema<userPostCommentsInterface>(
  {
    userPostId: {
      type: Schema.Types.ObjectId,
      ref: 'UserPost',
    },
    commenterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    commenterProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    likeCount: [{ userId: String }],
    imageUrl: [{ imageUrl: String, publicId: String }],
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: 'userPostComments',
      },
    ],
    level: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const userPostCommentsModel = model<userPostCommentsInterface>('userPostComments', userPostCommentsSchema);

export default userPostCommentsModel;
