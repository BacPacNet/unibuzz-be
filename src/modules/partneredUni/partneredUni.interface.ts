import { Schema } from 'mongoose';

export interface IPartneredUni {
  universityId: Schema.Types.ObjectId;
  communityId: Schema.Types.ObjectId;
}
