import { Schema, model } from 'mongoose';
import { communityPostCommentsInterface } from './communityPostsComments.interface';

const communityPostCommentsShema = new Schema<communityPostCommentsInterface>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPost',
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
    imageUrl: { imageUrl: String, publicId: String },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: 'communityPostComments',
      },
    ],
    level: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const communityPostCommentsModel = model<communityPostCommentsInterface>(
  'communityPostComments',
  communityPostCommentsShema
);

export default communityPostCommentsModel;
