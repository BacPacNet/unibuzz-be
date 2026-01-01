import { Schema, model } from 'mongoose';
import { UniversityUsersInterface } from './universityUsers.interface';

const universityUsersSchema = new Schema<UniversityUsersInterface>({
  universityId: { type: Schema.Types.ObjectId, ref: 'university', required: true },
  details: [
    {
      email: { type: String, required: true },
      name: { type: String, required: true },
      dob: { type: String, required: true },
      rollno: { type: String, required: true },
      mobileno: { type: String, required: true },
      status: { type: String, required: true },
      gender: { type: String, required: true },
      semester: { type: String, required: true },
      role: { type: String, enum: ['student', 'faculty'], required: true },
    },
  ],
});

const universityUsersModel = model<UniversityUsersInterface>('universityUsers', universityUsersSchema);

export default universityUsersModel;
