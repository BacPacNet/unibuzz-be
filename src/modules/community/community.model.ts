import { Schema, model } from 'mongoose';
import { communityInterface } from './community.interface';

const communitySchema = new Schema<communityInterface>({
  communityCoverUrl: { imageUrl: String, publicId: String },
  communityLogoUrl: { imageUrl: String, publicId: String },
  name: { type: String, required: true, unique: true },
  adminId: { type: Schema.Types.ObjectId, ref: 'User' },
  university_id: { type: Schema.Types.ObjectId, ref: 'university', required: true, unique: true },
  numberOfStudent: Number,
  numberOfFaculty: Number,
  about: { type: String },
  assistantId: { type: String, unique: true, required: false },
  users: [
    {
      id: { type: Schema.Types.ObjectId, ref: 'User' },
      firstName: String,
      lastName: String,
      universityName: String,
      year: String,
      degree: String,
      major: String,
      profileImageUrl: String || null,
      occupation: String,
      affiliation: String,
      role: String,
    },
  ],
});

const communityModel = model<communityInterface>('community', communitySchema);

export default communityModel;
