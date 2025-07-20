import { Schema, model, Types } from 'mongoose';

const PostRelationshipSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', index: true }, // for userPost
  userPostId: { type: Types.ObjectId, ref: 'UserPost' },

  communityId: { type: Types.ObjectId, ref: 'Community', index: true }, // for communityPost
  communityPostId: { type: Types.ObjectId, ref: 'CommunityPost' },

  communityGroupId: { type: Types.ObjectId, ref: 'CommunityGroup', index: true }, // for group posts

  type: { type: String, enum: ['user', 'community', 'group'], required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model('PostRelationship', PostRelationshipSchema);
