import { Schema, model } from 'mongoose';
import { UserProfileDocument } from './userProfile.interface';

const userProfileSchema = new Schema<UserProfileDocument>({
  users_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: [{ UniversityName: String, UniversityEmail: String }],
  profile_dp: { imageUrl: String, publicId: String },
  cover_dp: { imageUrl: String, publicId: String },
  bio: String,
  phone_number: String,
  dob: Date,
  country: String,
  city: String,
  university_name: String,
  university_id: { type: Schema.Types.ObjectId, ref: 'colleges' },
  study_year: String,
  degree: String,
  major: String,
  affiliation: String,
  occupation: String,
  following: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      isBlock: {
        type: Boolean,
        default: false,
      },
    },
  ],
  followers: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      isBlock: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

const UserProfile = model<UserProfileDocument>('UserProfile', userProfileSchema);

export default UserProfile;
