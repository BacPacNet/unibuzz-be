import { Schema, model } from 'mongoose';
import { communityPostCommentsInterface } from './communityPostsComments.interface';

const communityPostCommentsShema = new Schema<communityPostCommentsInterface>({
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'community',
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
  imageUrl: {
    type: String,
  },
});

const communityPostCommentsModel = model<communityPostCommentsInterface>(
  'communityPostComments',
  communityPostCommentsShema
);

export default communityPostCommentsModel;
