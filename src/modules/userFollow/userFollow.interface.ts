import { Schema } from 'mongoose';

interface userFollowInterface {
  user_id: Schema.Types.ObjectId;
  following_user_id: Schema.Types.ObjectId;
}

export { userFollowInterface };
