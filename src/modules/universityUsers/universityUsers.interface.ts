import mongoose from 'mongoose';

// Interfaces
export interface UniversityUserDetails {
  email: string;
  name: string;
  dob: string;
  rollno: string;
  mobileno: string;
  status: string;
  gender: string;
  semester: string;
  role: 'student' | 'faculty';
}

export interface UniversityUsersInterface {
  universityId: mongoose.Types.ObjectId;
  details: UniversityUserDetails[];
}
