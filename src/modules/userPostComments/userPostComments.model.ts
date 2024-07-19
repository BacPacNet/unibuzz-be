import { Schema, model } from 'mongoose';
import { userPostCommentsInterface } from './userPostComments.interface';

const userPostCommentsSchema = new Schema<userPostCommentsInterface>(
  {
    userPostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    commenterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    likeCount: [{ userId: String }],
    imageUrl: { imageUrl: String, publicId: String },
  },
  { timestamps: true }
);

const userPostCommentsModel = model<userPostCommentsInterface>('userPostComments', userPostCommentsSchema);

export default userPostCommentsModel;
