import { Schema } from "mongoose";

interface UserProfileDocument {
    users_id: Schema.Types.ObjectId;
    profile_dp?: string;
    cover_dp?: string;
    bio?: string;
    phone_number?: string;
    dob?: Date;
    country?: string;
    city?: string;
    university_name?: string;
    study_year?: string;
    degree?: string;
    major?: string;
    affiliation?: string;
    occupation?: string;
    totalFilled: number;

  }

  export{
    UserProfileDocument
  }