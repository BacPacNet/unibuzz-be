import { Schema, model } from 'mongoose';
import { University } from './university.interface';

const UniversitySchema = new Schema<University>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  score: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  collegePage: { type: String },
  tuitionFee: { type: String },
  undergraduatePrograms: { type: Number },
  programs: [
    {
      program: { type: String, required: true },
      courses: [
        {
          name: { type: String, required: true },
          degrees: [
            {
              degreeTitle: { type: String, required: true },
              durationYears: { type: Number, required: true },
              description: { type: String, required: true },
              requirements: { type: String, required: true },
            },
          ],
        },
      ],
    },
  ],
});

// const UniversityModel = model<University>('University', UniversitySchema);
const UniversityModel = model<University>('college', UniversitySchema);

export default UniversityModel;
