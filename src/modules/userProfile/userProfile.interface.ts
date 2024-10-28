import { Schema } from 'mongoose';

interface userProfileEmail {
  UniversityName: string;
  UniversityEmail: string;
}

interface following {
  userId: Schema.Types.ObjectId;
  isBlock: boolean;
}

interface UserProfileDocument {
  users_id: Schema.Types.ObjectId;
  email: userProfileEmail[];
  profile_dp?: { imageUrl: string; publicId: string };
  cover_dp?: { imageUrl: string; publicId: string };
  bio?: string;
  phone_number?: string;
  dob?: Date;
  country?: string;
  city?: string;
  university_name?: string;
  university_id: Schema.Types.ObjectId;
  study_year?: string;
  degree?: string;
  major?: string;
  affiliation?: string;
  occupation?: string;
  following: following[];
  followers: following[];
  totalFilled: number;
}

export { UserProfileDocument };
