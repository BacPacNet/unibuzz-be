import { Schema, model } from 'mongoose';
import { userFollowInterface } from './userFollow.interface';

const userFollowSchema = new Schema<userFollowInterface>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  following_user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

const followingRelationship = model<userFollowInterface>('followingRelationship', userFollowSchema);

export default followingRelationship;
