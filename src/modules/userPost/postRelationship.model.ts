import { Schema, model, Types } from 'mongoose';

export interface IPostRelationship {
  _id?: Types.ObjectId;
  userId?: Types.ObjectId;
  userPostId?: Types.ObjectId;
  communityId?: Types.ObjectId;
  communityPostId?: Types.ObjectId;
  communityGroupId?: Types.ObjectId;
  type: string;
  createdAt?: Date;
}

const PostRelationshipSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', index: true }, // for userPost
  userPostId: { type: Types.ObjectId, ref: 'UserPost' },

  communityId: { type: Types.ObjectId, ref: 'Community', index: true }, // for communityPost
  communityPostId: { type: Types.ObjectId, ref: 'CommunityPost' },

  communityGroupId: { type: Types.ObjectId, ref: 'CommunityGroup', index: true }, // for group posts

  type: { type: String, enum: ['user', 'community', 'group'], required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model<IPostRelationship>('PostRelationship', PostRelationshipSchema);
