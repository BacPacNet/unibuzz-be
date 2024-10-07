import { Schema, model } from 'mongoose';
import { communityInterface } from './community.interface';

const communitySchema = new Schema<communityInterface>({
  communityCoverUrl: { imageUrl: String, publicId: String },
  communityLogoUrl: { imageUrl: String, publicId: String },
  name: { type: String, required: true, unique: true },
  adminId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  collegeID: { type: Schema.Types.ObjectId, ref: 'colleges', required: true, unique: true },
  numberOfUser: { type: Number, default: 0, min: 0 },
  numberOfStudent: Number,
  numberOfFaculty: Number,
  about: { type: String },
});

const communityModel = model<communityInterface>('community', communitySchema);

export default communityModel;
