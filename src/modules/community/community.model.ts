import { Schema, model } from 'mongoose';
import { communityInterface } from './community.interface';

const communitySchema = new Schema<communityInterface>({
  communityCoverUrl: { imageUrl: String, publicId: String },
  communityLogoUrl: { imageUrl: String, publicId: String },
  name: { type: String, required: true },
  adminId: { type: String, required: true },
  numberOfUser: Number,
  numberOfStudent: Number,
  numberOfFaculty: Number,
});

const communityModel = model<communityInterface>('community', communitySchema);

export default communityModel;
