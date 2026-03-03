import { Schema, model } from 'mongoose';
import { IWhitelistRewardCommunity } from './whitelistRewardCommunity.interface';

const whitelistRewardCommunitySchema = new Schema<IWhitelistRewardCommunity>(
  {
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'community',
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const WhitelistRewardCommunityModel = model<IWhitelistRewardCommunity>(
  'whitelistRewardCommunity',
  whitelistRewardCommunitySchema
);

export default WhitelistRewardCommunityModel;
